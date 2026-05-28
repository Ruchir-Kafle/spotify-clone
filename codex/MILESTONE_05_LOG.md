# Milestone 5 Log - Queue System

Date completed: 2026-05-28

## Goal

Implement Spotify-like queue behavior on top of real web playback.

## Implemented Scope

- Added persistent playback queue state.
- Added queue history.
- Added next-up queue behavior.
- Added visible queue drawer.
- Added jump-to-track behavior from the queue drawer.
- Added deterministic shuffle.
- Added repeat modes.
- Added previous-button threshold behavior.
- Added playback state restore on page load.

## Persistence

Updated:

```text
apps/web/src/routes/+page.server.ts
```

The page server load now reads `playback_state` from SQLite and returns:

- `queueIds`
- `historyIds`
- `currentSongId`
- `timestampSeconds`
- `volume`
- `repeatMode`
- `shuffleEnabled`
- `shuffledQueueIds`

Added:

```text
apps/web/src/routes/playback-state/+server.ts
```

This endpoint persists playback state into the existing `playback_state` table.

Storage details:

- queue and history are stored in `queue_json`
- current song is stored in `current_song_id`
- timestamp is stored in `timestamp_seconds`
- volume is stored in `volume`
- repeat mode is stored in `repeat_mode`
- shuffle toggle is stored in `shuffle_enabled`
- deterministic shuffle order is stored in `shuffle_state_json`

No new database migration was required because the Milestone 1 schema already included `playback_state`.

## Queue Behavior

The Library page now owns a real queue model:

- `queueIds`
- `historyIds`
- `shuffledQueueIds`
- `currentSong`
- `repeatMode`
- `shuffleEnabled`

Clicking a library row starts playback and sets the active queue from the current sorted/filtered Library list.

The queue drawer shows:

- Now playing
- Next up
- History

Clicking a track in the queue drawer jumps directly to that track.

## Previous Button

Previous behavior follows the Spotify-style rule from the project spec:

- if current playback time is greater than 3 seconds, restart the current song
- otherwise, move to the previous song from history
- if history is empty, fall back to the previous item in the active queue order

## Repeat Modes

Implemented modes:

- `off`
- `playlist`
- `one`

Behavior:

- repeat off stops at the end of the queue
- repeat playlist loops back to the first queued song
- repeat one restarts the current song

## Shuffle

Shuffle behavior:

- uses a deterministic shuffled queue order
- keeps the current song at the front when shuffle is enabled
- avoids reshuffling randomly on every song change
- preserves previous-button behavior through the history stack

## UI Changes

Updated:

```text
apps/web/src/routes/+page.svelte
```

Added controls:

- shuffle
- repeat
- queue drawer toggle

Added queue drawer:

- current song
- next-up list
- recent history
- jump-to-track buttons

## Out Of Scope

Not implemented in this milestone:

- playlists
- drag-and-drop playlist ordering
- OAuth
- authenticated REST APIs
- cross-device sync
- mobile queue sync

## Verification

Commands run:

```bash
pnpm check
pnpm lint
pnpm build
```

Manual/API verification:

- opened the Library page and confirmed queue controls render
- posted a playback state payload to `/playback-state`
- confirmed SQLite updated `playback_state`
- reset the test state to a neutral local state

Expected interactive checks:

- click a song row and confirm it plays
- open the queue drawer
- confirm next-up is populated
- click next and previous
- toggle shuffle and confirm order remains stable
- cycle repeat modes and confirm end-of-song behavior changes
