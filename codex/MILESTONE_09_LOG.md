# Milestone 9 - Tailscale Deployment

## Scope

Milestone 9 prepares the app for private-network deployment through Tailscale. The app now builds as a runnable Node server, has production environment templates, includes a systemd service example, and has a deployment guide that avoids public internet exposure.

## Files Changed

- `apps/web/svelte.config.js`
  - Switched from `@sveltejs/adapter-auto` to `@sveltejs/adapter-node`.
- `apps/web/package.json`
  - Added `start` script for the built Node server.
  - Added `@sveltejs/adapter-node`.
- `package.json`
  - Added root `start` script.
- `apps/web/.env.production.example`
  - Added production placeholder values for Auth.js, Google OAuth, and server bind settings.
- `.gitignore`
  - Allowed `.env.production.example` files while keeping real `.env*` files ignored.
- `deploy/systemd/music-server.service.example`
  - Added a production service example for a home server.
- `docs/TAILSCALE_DEPLOYMENT.md`
  - Added the private Tailscale deployment guide.
- `pnpm-lock.yaml`
  - Updated for `@sveltejs/adapter-node`.

## Deployment Shape

```text
Tailnet device
  -> Tailscale HTTPS name
  -> Tailscale Serve
  -> http://127.0.0.1:5173
  -> SvelteKit Node server
```

The app is configured to bind to localhost in production examples:

```text
HOST=127.0.0.1
PORT=5173
```

Remote access should come through Tailscale only. Tailscale Funnel is intentionally not part of this milestone.

## Environment Notes

Production uses:

```text
apps/web/.env.production
```

The committed file is only:

```text
apps/web/.env.production.example
```

Real secrets remain gitignored.

## Commands Added

```bash
pnpm start
pnpm --filter @music/web start
```

After `pnpm build`, these run the `apps/web/build` Node output from `adapter-node`.

## Verification

- `pnpm --filter @music/web format`
- `pnpm check`
- `pnpm lint`
- `pnpm build`
- Started the built server on `127.0.0.1:4174` with temporary command-line environment values.
- Verified `http://127.0.0.1:4174/health` returned `200`.
- Stopped the temporary production smoke-test process after verification.
