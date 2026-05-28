# Tailscale Deployment

This app is intended to be reachable over your private Tailscale network, not the public internet.

## Target Shape

```text
iPhone / laptop on tailnet
  -> https://music-server.<tailnet>.ts.net
  -> Tailscale Serve on home server
  -> http://127.0.0.1:5173
  -> SvelteKit Node server
```

The Node process binds to `127.0.0.1`. Tailscale is the only remote entry point.

## Server Requirements

- Node.js 20.19 or newer
- pnpm 10.33 or newer
- Tailscale installed and logged in
- The repo checked out on the home server
- Your music directory available on the home server filesystem

## Build

From the repo root:

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
```

## Environment

Create a production env file from the example:

```bash
cp apps/web/.env.production.example apps/web/.env.production
chmod 600 apps/web/.env.production
```

Fill in:

```text
AUTH_SECRET
AUTH_GOOGLE_ID
AUTH_GOOGLE_SECRET
AUTH_TRUST_HOST=true
HOST=127.0.0.1
PORT=5173
```

Generate `AUTH_SECRET` with:

```bash
openssl rand -hex 32
```

For Google OAuth, add this authorized redirect URI for your Tailscale HTTPS name:

```text
https://music-server.<tailnet>.ts.net/auth/callback/google
```

If you also use local development, keep this redirect URI too:

```text
http://localhost:5173/auth/callback/google
```

## Run Manually

```bash
set -a
. apps/web/.env.production
set +a
pnpm start
```

Open locally on the server:

```text
http://127.0.0.1:5173/health
```

## Tailscale Serve

After the app is running locally, publish it only to your tailnet:

```bash
sudo tailscale serve --bg --https=443 http://127.0.0.1:5173
```

Check the configured serve routes:

```bash
tailscale serve status
```

Do not enable Tailscale Funnel for this app.

## systemd

The example unit assumes the repo lives at:

```text
/opt/music-server
```

Install:

```bash
sudo cp deploy/systemd/music-server.service.example /etc/systemd/system/music-server.service
sudo systemctl daemon-reload
sudo systemctl enable --now music-server
```

Inspect:

```bash
systemctl status music-server
journalctl -u music-server -f
```

Then enable Tailscale Serve:

```bash
sudo tailscale serve --bg --https=443 http://127.0.0.1:5173
```

## Music Folders

Add folders through the Settings UI or CLI:

```bash
pnpm library:add /path/to/music
pnpm scan
```

For live indexing:

```bash
pnpm scan:watch
```

Run the watcher in a separate systemd unit later if you want continuous background scanning.

## Firewall

The app process should not listen on a public interface. Keep:

```text
HOST=127.0.0.1
PORT=5173
```

You do not need to open port `5173` on your router. Remote access should come from Tailscale devices only.

## Updates

```bash
git pull
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
sudo systemctl restart music-server
```

## Rollback

If an update breaks, revert or checkout the previous revision, then rebuild and restart:

```bash
git checkout <known-good-revision>
pnpm install --frozen-lockfile
pnpm build
sudo systemctl restart music-server
```
