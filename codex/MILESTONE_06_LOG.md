# Milestone 6 Log - Playlists

Date completed: 2026-05-28

## Goal

Implement persistent playlist management. Do not implement OAuth, public APIs, or mobile behavior.

## Implemented Scope

- Added playlist overview page.
- Added playlist creation.
- Added playlist rename.
- Added playlist delete.
- Added individual playlist detail/editor page.
- Added songs to playlists.
- Removed songs from playlists.
- Added drag-and-drop playlist reordering.
- Persisted playlist ordering in SQLite.
- Fixed playlist detail state syncing so newly added and removed songs show immediately after form actions.

## Routes Added

### Playlist Overview

Added:

```text
apps/web/src/routes/playlists/+page.server.ts
apps/web/src/routes/playlists/+page.svelte
```

The overview page supports:

- list playlists
- show song counts
- create playlists
- rename playlists
- delete playlists
- open a playlist detail page

### Playlist Detail

Added:

```text
apps/web/src/routes/playlists/[id]/+page.server.ts
apps/web/src/routes/playlists/[id]/+page.svelte
```

The detail page supports:

- show playlist songs in persisted order
- add songs from the indexed library
- search available songs before adding
- remove songs
- rename the playlist
- delete the playlist
- drag songs into a new order
- save the reordered song list

## Database Usage

Used existing Milestone 1 tables:

- `playlists`
- `playlist_songs`
- `songs`

No migration was required.

Playlist creation inserts into:

```text
playlists
```

Playlist membership and order are stored in:

```text
playlist_songs
```

Fields used:

- `playlist_id`
- `song_id`
- `order_index`

Reorder implementation deletes and reinserts playlist memberships inside a SQLite transaction so `order_index` remains contiguous and avoids unique-index conflicts.

## Navigation

Updated existing sidebars so `Playlists` links to:

```text
/playlists
```

Updated files:

- `apps/web/src/routes/+page.svelte`
- `apps/web/src/routes/settings/+page.svelte`

## Drag And Drop

The playlist detail page uses native browser drag-and-drop:

- drag a playlist song row
- drop it on another row
- local order updates immediately
- `Save Order` persists the new order

Rows include explicit ARIA list roles to avoid accessibility warnings.

## Live Updates

The playlist detail page keeps a local `orderedSongs` state for drag-and-drop. That local state is now synchronized whenever the server-loaded playlist song ids change, so add/remove form actions update the visible list immediately after the action completes.

Add/remove forms use normal SvelteKit form navigation so the page follows the action redirect and loads the fresh playlist data reliably.

## Verification

Commands run:

```bash
pnpm check
pnpm lint
pnpm build
```

Manual/API verification:

- created a temporary playlist through the SvelteKit form action
- added two indexed songs
- reordered the songs
- renamed the playlist
- verified SQLite rows reflected the new order
- deleted the temporary playlist
- verified no temporary playlist remained

## Out Of Scope

Not implemented in this milestone:

- playlist playback as a special source beyond normal song playback
- playlist cover art
- OAuth ownership
- authenticated playlist APIs
- cross-device playlist sync
- mobile playlist UI
