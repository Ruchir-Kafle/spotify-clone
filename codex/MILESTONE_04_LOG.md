# Milestone 4 Log - Playback

Date completed: 2026-05-28

## Goal

Implement real local audio playback in the web app. Do not implement OAuth, playlists, or the full queue system.

## Implemented Scope

- Added secure song audio streaming by indexed song id.
- Added HTTP range request support for seeking.
- Added browser playback through a real `<audio>` element.
- Added play and pause controls.
- Added seek controls.
- Added previous and next controls over the currently visible Library ordering.
- Added volume control.
- Added current song display in a bottom player.

## Audio Streaming

Added:

```text
apps/web/src/routes/songs/[id]/audio/+server.ts
```

The route:

- accepts a song id
- looks up the file path from SQLite
- validates the song exists in the indexed `songs` table
- validates the resolved file path is inside a configured music directory
- streams the audio file
- supports `Range` headers
- returns `206 Partial Content` for byte ranges
- returns `416` for invalid ranges
- uses content types for supported formats

Supported streamed formats:

- MP3
- FLAC
- WAV
- M4A
- OGG

The route never accepts an arbitrary filesystem path from the client.

## Web Player

Updated:

```text
apps/web/src/routes/+page.svelte
```

The Library page now includes:

- row click playback
- active song state
- bottom player bar
- play/pause button
- previous button
- next button
- seek slider
- elapsed time
- duration
- volume slider

Previous and next currently use the visible sorted/filtered song list. This is intentionally simpler than the future Spotify-like queue, which belongs to Milestone 5.

## Dependencies

Updated:

```text
apps/web/package.json
```

Added:

```text
@lucide/svelte
```

Used for playback control icons.

## Out Of Scope

Not implemented in this milestone:

- queue history
- shuffle
- repeat
- playlists
- persistent playback state
- Google OAuth
- authenticated APIs
- mobile background playback

## Verification

Commands to run:

```bash
pnpm install
pnpm check
pnpm lint
pnpm build
```

Manual verification:

- open the Library page
- click a song row
- confirm real audio plays
- pause and resume playback
- drag the seek slider
- adjust volume
- use previous and next

Route verification:

```bash
curl -I -H 'Range: bytes=0-99' http://localhost:5173/songs/<song-id>/audio
```

Expected response:

```text
HTTP/1.1 206 Partial Content
accept-ranges: bytes
content-range: bytes 0-99/<file-size>
content-type: audio/<format>
```
