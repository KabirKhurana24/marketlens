const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname);
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 5173);
const AUTH_DIR = path.resolve(ROOT, '..', '.marketlens-auth');
const USER_STORE = path.join(AUTH_DIR, 'users.json');
const SESSION_MAX_AGE = 7 * 24 * 60 * 60;
const sessions = new Map();
let users = [];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8'
};

function loadUsers() {
  try {
    const stored = JSON.parse(fs.readFileSync(USER_STORE, 'utf8'));
    users = Array.isArray(stored) ? stored : [];
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('Could not read local auth store:', error.message);
    users = [];
  }
}

function saveUsers() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const tempPath = `${USER_STORE}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(users, null, 2), { mode: 0o600 });
  fs.renameSync(tempPath, USER_STORE);
}

function sendJson(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 16 * 1024) {
        reject(new Error('Request is too large.'));
        req.destroy();
        return;
      }
      body += chunk.toString('utf8');
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('Invalid request body.')); }
    });
    req.on('error', reject);
  });
}

function getSessionToken(req) {
  const cookies = (req.headers.cookie || '').split(';');
  const pair = cookies.map(value => value.trim()).find(value => value.startsWith('marketlens_session='));
  return pair ? pair.slice('marketlens_session='.length) : null;
}

function sessionCookie(token, maxAge = SESSION_MAX_AGE) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `marketlens_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

function publicUser(user) {
  return { name: user.name, email: user.email };
}

function createSession(user, res) {
  const token = crypto.randomBytes(32).toString('base64url');
  sessions.set(token, { email: user.email, expiresAt: Date.now() + SESSION_MAX_AGE * 1000 });
  res.setHeader('Set-Cookie', sessionCookie(token));
  return publicUser(user);
}

function getSessionUser(req) {
  const token = getSessionToken(req);
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return users.find(user => user.email === session.email) || null;
}

async function handleAuth(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/auth/me') {
    const user = getSessionUser(req);
    return user ? sendJson(res, 200, { user: publicUser(user) }) : sendJson(res, 401, { error: 'No active session.' });
  }

  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' }, { Allow: 'GET, POST' });

  let body;
  try { body = await readJson(req); }
  catch (error) { return sendJson(res, 400, { error: error.message }); }

  if (pathname === '/api/auth/register') {
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (name.length < 2 || name.length > 80) return sendJson(res, 400, { error: 'Name must be between 2 and 80 characters.' });
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return sendJson(res, 400, { error: 'Enter a valid email address.' });
    if (password.length < 8 || password.length > 128) return sendJson(res, 400, { error: 'Password must be between 8 and 128 characters.' });
    if (users.some(user => user.email === email)) return sendJson(res, 409, { error: 'An account with this email already exists. Sign in instead.' });
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');
    const user = { name, email, salt, passwordHash, createdAt: new Date().toISOString() };
    users.push(user);
    try { saveUsers(); }
    catch (error) {
      users = users.filter(existing => existing.email !== email);
      console.error('Could not save local account:', error);
      return sendJson(res, 500, { error: 'Could not save the account on this machine.' });
    }
    const safeUser = createSession(user, res);
    return sendJson(res, 201, { user: safeUser });
  }

  if (pathname === '/api/auth/login') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const user = users.find(candidate => candidate.email === email);
    if (!user || password.length > 128) return sendJson(res, 401, { error: 'Email or password is incorrect.' });
    const attemptedHash = crypto.scryptSync(password, user.salt, 64);
    const storedHash = Buffer.from(user.passwordHash, 'hex');
    if (storedHash.length !== attemptedHash.length || !crypto.timingSafeEqual(attemptedHash, storedHash)) {
      return sendJson(res, 401, { error: 'Email or password is incorrect.' });
    }
    const safeUser = createSession(user, res);
    return sendJson(res, 200, { user: safeUser });
  }

  if (pathname === '/api/auth/logout') {
    const token = getSessionToken(req);
    if (token) sessions.delete(token);
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) });
  }

  return sendJson(res, 404, { error: 'Unknown authentication endpoint.' });
}

loadUsers();

const server = http.createServer(async (req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad request');
    return;
  }

  if (pathname.startsWith('/api/auth/')) {
    await handleAuth(req, res, pathname);
    return;
  }

  const relativePath = pathname.replace(/^\/+/, '') || 'index.html';
  const filePath = path.resolve(ROOT, relativePath);
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    const resolvedPath = !statError && stats.isDirectory() ? path.join(filePath, 'index.html') : filePath;
    fs.readFile(resolvedPath, (readError, content) => {
      if (readError) {
        res.writeHead(readError.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(readError.code === 'ENOENT' ? 'Not found' : 'Server error');
        return;
      }
      const contentType = MIME_TYPES[path.extname(resolvedPath).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
      if (req.method === 'HEAD') res.end();
      else res.end(content);
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`MarketLens is running at http://${HOST}:${PORT}`);
  console.log('Local prototype authentication is enabled. Account records are stored outside the project folder.');
  console.log('Press Ctrl+C to stop the local server.');
});
