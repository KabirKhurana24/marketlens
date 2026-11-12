# MarketLens deployment/authentication rewrite

This patch separates local development from hosted authentication.

## Folder layout after applying the patch

```text
marketlens/
  api/
    auth/
      login.js
      logout.js
      me.js
      register.js
  data/
  docs/
  lib/
    supabase-auth.js
  index.html
  app.js
  auth.css
  styles.css
  local-server.js
  package.json
  vercel.json
```

**Important:** move the current root `server.js` to `local-server.js` (or replace it with the `local-server.js` in this patch), and make sure there is no root-level `server.js` left. The root `server.js` is a long-running local HTTP server, not a Vercel Function. The Vercel API routes now live in `api/auth/`.

## 1. Apply the files

1. Extract this patch ZIP into your existing MarketLens repository folder, allowing `package.json`, `vercel.json`, and `local-server.js` to be replaced/added.
2. Delete the old root `server.js` after confirming `local-server.js` is present.
3. Apply the small `app.js` and `auth.css` edits in `docs/APP_JS_PATCH.md`.
4. Keep your existing `index.html`, `app.js`, `auth.css`, `styles.css`, `data/`, and `docs/` project assets.

## 2. Create/configure Supabase Auth

1. Create a Supabase project.
2. Open **Project Settings → API** and copy the Project URL and the publishable key (or legacy anon key).
3. In Supabase **Authentication → URL Configuration**, set the Site URL to your deployed MarketLens URL, for example `https://YOUR-PROJECT.vercel.app`.
4. Add that same URL to the allowed redirect URLs.
5. In **Authentication → Providers → Email**, configure email/password sign-in. Keep email confirmation enabled for a real account flow; the UI now displays the confirmation message.

Do not use the Supabase `service_role` / secret key in this project. The API uses only the publishable/anon key; passwords are verified by Supabase Auth.

## 3. Add Vercel environment variables

In Vercel → Project → Settings → Environment Variables, add:

```text
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

The code also accepts `SUPABASE_ANON_KEY` as the key variable name for older Supabase projects. Add variables to Production and Preview as appropriate, save, and redeploy.

## 4. Vercel build settings

In Vercel → Settings → Build and Deployment:

- Framework Preset: **Other**
- Root Directory: the folder containing `index.html` and `api/`
- Build Command: **blank**
- Output Directory: **blank** (or `.` if the project settings require an explicit override)
- Install Command: **blank/default**

Do not set the Build Command to `npm run dev` or `npm start`. Those commands are for local development only. Vercel automatically discovers functions under `/api` and serves the root HTML/CSS/JS as static files.

## 5. Local development

From the project root:

```powershell
npm run dev
```

Open `http://localhost:5173`. Local registration/login continues to use the local prototype store. Hosted registration/login uses Supabase through Vercel's `/api/auth/*` functions.

## 6. Commit and deploy

```powershell
git add -A
git commit -m "Separate local server and add Vercel Supabase auth"
git push origin main
```

Vercel should deploy automatically from `main`.

## 7. Smoke tests after deployment

Open these URLs:

- `/` — should render the MarketLens login screen, not a 500 error.
- `/api/auth/me` — should return JSON `401` when signed out, not `FUNCTION_INVOCATION_FAILED`.
- Click **Explore the live demo** — should open the dashboard without requiring an account.
- Register an account — with email confirmation enabled, the UI should say to check the inbox.
- Verify the email, then sign in.
- Sign out and sign back in; the API refreshes the session using an HttpOnly refresh cookie.

If `/` still gives a 500 after removing root `server.js` and clearing the Vercel Build Command override, inspect the new deployment's Build Logs and Runtime Logs. This patch removes the local server from Vercel's root and supplies explicit `/api` handlers; it cannot correct a Vercel project setting that points to a different root directory/deployment.
