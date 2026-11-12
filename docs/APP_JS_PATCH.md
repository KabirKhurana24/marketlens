# Required small patch to app.js

The current frontend already calls `/api/auth/me`, `/api/auth/register`, `/api/auth/login` and `/api/auth/logout`. The new Vercel functions preserve those URLs.

## 1. Update the signup description

In `setAuthMode()` replace:

```js
? 'Set up a local MarketLens account to save your own workspace session.'
```

with:

```js
? 'Create a secure account to access your workspace from this browser.'
```

## 2. Replace `showAuthError`

Replace the existing function:

```js
function showAuthError(message) {
  $('#auth-error').textContent = message;
}
```

with:

```js
function showAuthError(message, type = 'error') {
  const element = $('#auth-error');
  element.textContent = message;
  element.classList.toggle('is-success', type === 'success');
}
```

## 3. Handle email verification after signup

Inside the `auth-form` submit handler, replace:

```js
const result = await requestAuth(path, payload);
enterWorkspace(result.user, 'account');
```

with:

```js
const result = await requestAuth(path, payload);
if (result.requiresEmailConfirmation) {
  showAuthError(result.message || 'Account created. Check your email to verify it, then sign in.', 'success');
  $('#auth-password').value = '';
  return;
}
if (!result.user) throw new Error('Authentication did not return a user. Please try again.');
enterWorkspace(result.user, 'account');
```

## 4. Add the success style to the end of `auth.css`

```css
.auth-error.is-success:not(:empty) {
  color: #18745f;
  background: #eefaf5;
  border-color: #cceee0;
}
```

That is the only frontend logic patch needed for the hosted login/register endpoints. The existing Explore Demo button remains independent and does not require Supabase.
