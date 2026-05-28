# Milestone 7 - Google OAuth

## Scope

Milestone 7 adds the first authentication layer for the music server. The web app is now private by default, uses Google OAuth through Auth.js, stores a local user record on successful sign-in, and exposes sign-in/sign-out routes.

## Files Changed

- `apps/web/package.json`
  - Added `@auth/sveltekit`.
- `apps/web/src/auth.ts`
  - Configured Auth.js with the Google provider.
  - Enabled JWT-backed sessions.
  - Upserts Google users into the existing `users` table.
  - Runs database migrations before touching user records.
- `apps/web/src/hooks.server.ts`
  - Composes the Auth.js request handler with a path-based authorization guard.
  - Protects the app by default and redirects anonymous users to `/signin`.
  - Leaves `/auth/*`, `/signin`, `/health`, and SvelteKit/Vite assets public.
- `apps/web/src/routes/+layout.server.ts`
  - Loads the active session for pages through `event.locals.auth()`.
- `apps/web/src/app.d.ts`
  - Imports Auth.js SvelteKit types.
  - Extends session user data with an optional local `id`.
- `apps/web/src/routes/signin/*`
  - Adds a Google sign-in page and server action.
- `apps/web/src/routes/signout/*`
  - Adds a sign-out confirmation page and server action.
- `apps/web/src/routes/health/+server.ts`
  - Adds a public health endpoint for basic process checks.
- `apps/web/.env.example`
  - Documents the required OAuth and Auth.js environment variables.
- Main app pages
  - Added a `Sign out` navigation entry to the Library, Settings, Playlists, and Playlist Detail sidebars.

## Implementation Notes

- Auth.js mounts its provider callbacks under `/auth` by default, so the Google OAuth callback URL should be:

```text
http://localhost:5173/auth/callback/google
```

- The local user record is keyed by email and Google account id where available. This keeps a stable SQLite record ready for later per-user playlists, preferences, and access rules.
- Authentication is currently app-wide: once Milestone 7 credentials are configured, every normal app route requires a session.
- Local development trusts the Vite host automatically and uses a dev-only fallback Auth.js secret so the sign-in shell can boot before OAuth credentials are configured. Production still requires `AUTH_SECRET`, and deployments should set `AUTH_TRUST_HOST="true"` when deployed behind a trusted host/proxy.
- The existing scanner and local database are still single-install focused. OAuth establishes identity, but ownership boundaries for songs and settings can be layered in later milestones.

## Environment

Create a local, gitignored `.env` file for the web app with:

```text
AUTH_SECRET="replace-with-at-least-32-random-characters"
AUTH_GOOGLE_ID="your-google-oauth-client-id"
AUTH_GOOGLE_SECRET="your-google-oauth-client-secret"
AUTH_TRUST_HOST="true"
```

For local development, the Google OAuth client should allow:

```text
http://localhost:5173/auth/callback/google
```

## Verification

- `pnpm --filter @music/web format`
- `pnpm --filter @music/web check`
- `pnpm --filter @music/web lint`

All verification commands passed after the Auth.js type augmentation and session callback cleanup.
