# Milestone 8 - API Layer

## Scope

Milestone 8 adds authenticated REST endpoints for remote clients. The web UI keeps working through its existing pages and actions, while future clients can now use JSON endpoints for library data, playlists, streaming, and queue state.

## Files Changed

- `apps/web/src/hooks.server.ts`
  - Keeps page redirects for browser routes.
  - Returns JSON `401` for unauthenticated `/api/*` requests.
- `apps/web/src/lib/server/api-data.ts`
  - Centralizes API database reads and writes.
  - Provides reusable song, playlist, and playback/queue helpers.
- `apps/web/src/lib/server/audio-stream.ts`
  - Extracts secure range-aware audio streaming into a shared helper.
  - Reused by both the existing web player route and the new API streaming route.
- `apps/web/src/routes/songs/[id]/audio/+server.ts`
  - Replaced local streaming implementation with the shared streaming helper.
- `apps/web/src/routes/api/**`
  - Added authenticated REST endpoints.

## Endpoints

All `/api/*` endpoints require an Auth.js session.

```text
GET    /api/me
GET    /api/songs
GET    /api/songs/:id
GET    /api/songs/:id/audio
GET    /api/playlists
POST   /api/playlists
GET    /api/playlists/:id
PATCH  /api/playlists/:id
DELETE /api/playlists/:id
POST   /api/playlists/:id/songs
PUT    /api/playlists/:id/songs
DELETE /api/playlists/:id/songs/:songId
GET    /api/queue
PUT    /api/queue
```

## Request Shapes

Create playlist:

```json
{
	"name": "Road trip"
}
```

Rename playlist:

```json
{
	"name": "New name"
}
```

Add song to playlist:

```json
{
	"songId": "song-id"
}
```

Reorder playlist songs:

```json
{
	"songIds": ["song-id-1", "song-id-2"]
}
```

Update queue:

```json
{
	"queueIds": ["song-id-1"],
	"historyIds": [],
	"currentSongId": "song-id-1",
	"timestampSeconds": 12.5,
	"volume": 0.9,
	"repeatMode": "off",
	"shuffleEnabled": false,
	"shuffledQueueIds": []
}
```

## Implementation Notes

- The API currently uses the same global SQLite tables as the web UI. OAuth identity exists, but per-user data partitioning is still a later layer.
- Audio streaming preserves byte-range support, content length, content type detection, and configured-folder containment checks.
- API clients that are not signed in receive:

```json
{
	"error": "Authentication required."
}
```

with HTTP status `401`.

## Verification

- `pnpm --filter @music/web format`
- `pnpm --filter @music/web check`
- `pnpm --filter @music/web lint`
- `pnpm build`
- `curl -i http://localhost:5173/api/songs`
  - Verified unauthenticated API requests return JSON `401`.
- `curl -i http://localhost:5173/health`
  - Verified the public health endpoint still returns `200`.
