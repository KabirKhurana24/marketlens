'use strict';

const ACCESS_COOKIE = 'marketlens_access';
const REFRESH_COOKIE = 'marketlens_refresh';
const REFRESH_COOKIE_AGE = 30 * 24 * 60 * 60;

class AuthError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

function getConfig() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new AuthError('Hosted sign-in is not configured yet. Add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in Vercel Environment Variables. The Explore Demo button remains available.', 503);
  }
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Invalid protocol');
  } catch {
    throw new AuthError('SUPABASE_URL is not a valid URL. Check the Vercel environment variable.', 503);
  }
  return { url, key };
}

function sendJson(res, status, payload, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  for (const [name, value] of Object.entries(extraHeaders)) res.setHeader(name, value);
  res.end(JSON.stringify(payload));
}

function getCookie(req, name) {
  const header = req.headers?.cookie || '';
  const prefix = `${name}=`;
  const item = header.split(';').map(value => value.trim()).find(value => value.startsWith(prefix));
  if (!item) return null;
  try { return decodeURIComponent(item.slice(prefix.length)); }
  catch { return item.slice(prefix.length); }
}

function cookieString(req, name, value, maxAge) {
  const forwardedProto = String(req.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
  const secure = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production' || forwardedProto === 'https';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

function setSessionCookies(req, res, session) {
  if (!session?.access_token || !session?.refresh_token) return;
  const accessAge = Math.max(60, Math.min(Number(session.expires_in) || 3600, 24 * 60 * 60));
  res.setHeader('Set-Cookie', [
    cookieString(req, ACCESS_COOKIE, session.access_token, accessAge),
    cookieString(req, REFRESH_COOKIE, session.refresh_token, REFRESH_COOKIE_AGE)
  ]);
}

function clearSessionCookies(req, res) {
  res.setHeader('Set-Cookie', [
    cookieString(req, ACCESS_COOKIE, '', 0),
    cookieString(req, REFRESH_COOKIE, '', 0)
  ]);
}

async function parseBody(req) {
  if (req.body !== undefined) {
    if (Buffer.isBuffer(req.body)) {
      try { return JSON.parse(req.body.toString('utf8')); }
      catch { throw new AuthError('Invalid JSON request body.', 400); }
    }
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); }
      catch { throw new AuthError('Invalid JSON request body.', 400); }
    }
    if (req.body && typeof req.body === 'object') return req.body;
    return {};
  }

  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 16 * 1024) {
        reject(new AuthError('Request body is too large.', 413));
        req.destroy();
        return;
      }
      raw += chunk.toString('utf8');
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { reject(new AuthError('Invalid JSON request body.', 400)); }
    });
    req.on('error', reject);
  });
}

function validateSameOrigin(req) {
  const origin = req.headers?.origin;
  if (!origin) return;
  const host = req.headers?.['x-forwarded-host'] || req.headers?.host;
  if (!host) return;
  let originHost;
  try { originHost = new URL(origin).host; }
  catch { throw new AuthError('Invalid request origin.', 403); }
  if (originHost.toLowerCase() !== String(host).toLowerCase()) {
    throw new AuthError('Cross-origin authentication request blocked.', 403);
  }
}

async function supabaseAuth(endpoint, options = {}) {
  const { url, key } = getConfig();
  const headers = {
    apikey: key,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;

  let response;
  try {
    response = await fetch(`${url}/auth/v1/${endpoint}`, {
      method: options.method || 'GET',
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) })
    });
  } catch (error) {
    console.error('Supabase Auth network request failed:', error.message);
    throw new AuthError('Could not reach the authentication service. Please try again.', 502);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const rawMessage = payload.msg || payload.message || payload.error_description || payload.error || 'Authentication request failed.';
    const lower = String(rawMessage).toLowerCase();
    let status = response.status;
    if (lower.includes('invalid login credentials') || lower.includes('invalid email or password')) status = 401;
    if (lower.includes('already registered') || lower.includes('already exists')) status = 409;
    if (status >= 500) status = 502;
    throw new AuthError(String(rawMessage), status);
  }
  return payload;
}

function publicUser(user) {
  if (!user) return null;
  const metadata = user.user_metadata || {};
  return {
    name: metadata.full_name || metadata.name || user.email?.split('@')[0] || 'MarketLens user',
    email: user.email || ''
  };
}

async function currentUser(req, res) {
  const accessToken = getCookie(req, ACCESS_COOKIE);
  const refreshToken = getCookie(req, REFRESH_COOKIE);

  if (accessToken) {
    try {
      return await supabaseAuth('user', { accessToken });
    } catch (error) {
      if (![401, 403].includes(error.status)) throw error;
    }
  }

  if (!refreshToken) return null;
  try {
    const session = await supabaseAuth('token?grant_type=refresh_token', {
      method: 'POST',
      body: { refresh_token: refreshToken }
    });
    setSessionCookies(req, res, session);
    if (session.user) return session.user;
    return await supabaseAuth('user', { accessToken: session.access_token });
  } catch (error) {
    if ([400, 401, 403].includes(error.status)) {
      clearSessionCookies(req, res);
      return null;
    }
    throw error;
  }
}

function validateCredentials(email, password) {
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    throw new AuthError('Enter a valid email address.', 400);
  }
  if (password.length < 8 || password.length > 128) {
    throw new AuthError('Password must be between 8 and 128 characters.', 400);
  }
}

async function handleAuthRoute(action, req, res) {
  try {
    if (action === 'me') {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed.' }, { Allow: 'GET' });
      const user = await currentUser(req, res);
      if (!user) return sendJson(res, 401, { error: 'No active session.' });
      return sendJson(res, 200, { user: publicUser(user) });
    }

    if (!['register', 'login', 'logout'].includes(action)) {
      return sendJson(res, 404, { error: 'Unknown authentication endpoint.' });
    }
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' }, { Allow: 'POST' });
    validateSameOrigin(req);

    if (action === 'logout') {
      const token = getCookie(req, ACCESS_COOKIE);
      if (token) {
        try { await supabaseAuth('logout', { method: 'POST', accessToken: token }); }
        catch (error) { console.warn('Supabase logout returned an error; clearing local cookies anyway:', error.message); }
      }
      clearSessionCookies(req, res);
      return sendJson(res, 200, { ok: true });
    }

    const body = await parseBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    validateCredentials(email, password);

    if (action === 'register') {
      const name = String(body.name || '').trim();
      if (name.length < 2 || name.length > 80) throw new AuthError('Name must be between 2 and 80 characters.', 400);
      const result = await supabaseAuth('signup', {
        method: 'POST',
        body: { email, password, data: { full_name: name, name } }
      });
      if (result.access_token && result.refresh_token) {
        setSessionCookies(req, res, result);
        return sendJson(res, 201, { user: publicUser(result.user) });
      }
      return sendJson(res, 202, {
        requiresEmailConfirmation: true,
        user: publicUser(result.user),
        message: 'Your account has been created. Check your inbox for the verification email, then sign in.'
      });
    }

    const result = await supabaseAuth('token?grant_type=password', {
      method: 'POST',
      body: { email, password }
    });
    if (!result.access_token || !result.refresh_token || !result.user) {
      throw new AuthError('The authentication provider did not return a valid session. Please try again.', 502);
    }
    setSessionCookies(req, res, result);
    return sendJson(res, 200, { user: publicUser(result.user) });
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 500;
    if (status >= 500) console.error(`MarketLens auth route (${action}) failed:`, error.message);
    return sendJson(res, status, {
      error: status === 500 ? 'An unexpected authentication error occurred.' : error.message
    });
  }
}

module.exports = { handleAuthRoute };
