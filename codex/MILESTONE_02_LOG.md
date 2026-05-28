# Milestone 2 Log - Music Scanner

Date completed: 2026-05-28

## Goal

Implement real local music scanning while avoiding playlists, playback, authentication, library UI, and API work.

## Implemented Scope

- Added configurable music directories.
- Added recursive folder scanning.
- Added supported audio format detection.
- Added real metadata parsing.
- Added SQLite insertion and update behavior.
- Added missing-file cleanup.
- Added efficient filesystem watching.
- Added scanner CLI commands through root package scripts.

## Packages Added

### Scanner Package

Created:

```text
packages/scanner
```

Primary files:

- `packages/scanner/src/index.ts`
- `packages/scanner/src/cli.ts`
- `packages/scanner/package.json`
- `packages/scanner/tsconfig.json`

Dependencies:

- `music-metadata`
- `chokidar`
- `@music/database`

## Database Changes

Added migration:

```text
database/migrations/0002_music_directories.sql
```

Created table:

```text
music_directories
```

Columns:

- `id`
- `path`
- `created_at`
- `updated_at`

Created index:

- `music_directories_path_idx`

The `songs` table from Milestone 1 is reused for scanner output.

## Scanner Behavior

### Supported Formats

The scanner supports:

- `.mp3`
- `.flac`
- `.wav`
- `.m4a`
- `.ogg`

Detection is extension-based before metadata parsing, which avoids attempting to parse unsupported files.

### Directory Configuration

The scanner stores configured music directories in SQLite.

Paths are normalized with `realpath` and resolved from the user's command invocation directory, not from the scanner package directory. This matters because pnpm filtered scripts execute inside the package folder.

### Recursive Scan

The scanner recursively walks configured directories with async filesystem APIs.

For each supported audio file:

- resolves the real file path
- parses metadata with `music-metadata`
- reads file size and modification time
- inserts or updates the corresponding `songs` row

### Metadata Extraction

Extracted fields:

- `title`
- `artist`
- `album`
- `duration`
- `track_number`
- `disc_number`
- `year`
- `genre`
- `file_size`
- `file_modified_at`

Fallback behavior:

- title falls back to filename without extension
- artist falls back to `Unknown Artist`
- album falls back to `Unknown Album`

### SQLite Upsert

Songs are keyed by unique file path.

Existing song rows are updated on rescan while preserving their existing `id`. New songs receive a UUID.

### Missing File Cleanup

After a scan, files previously indexed under a scanned music directory are removed from `songs` if they are no longer present on disk.

Directory matching uses a directory-prefix `LIKE` query with escaping to avoid accidentally matching sibling paths.

### File Watching

Implemented `watchLibrary` using `chokidar`.

Watcher behavior:

- watches configured directories
- ignores initial scan events
- waits for writes to stabilize
- indexes added files
- re-indexes changed files
- deletes unlinked files from SQLite
- debounces repeated file events

## CLI Commands

Root scripts added:

```bash
pnpm library:add <path>
pnpm library:list
pnpm library:remove <path>
pnpm scan [path]
pnpm scan:watch [path]
```

Package-level command:

```bash
pnpm --filter @music/scanner scanner <command>
```

CLI commands:

- `add-dir`
- `list-dirs`
- `remove-dir`
- `scan`
- `watch`

## Shared Types Updated

Updated:

```text
packages/shared-types/src/index.ts
```

Added:

- `MusicDirectory`

## Verification

Commands run successfully:

```bash
pnpm install
pnpm db:migrate
pnpm library:add ./media
pnpm library:list
pnpm scan
pnpm check
pnpm lint
pnpm build
```

Additional verification:

- generated a small WAV file in `media/`
- ran `pnpm scan`
- confirmed a `songs` row was inserted
- confirmed metadata fallback behavior:
  - title: filename
  - artist: `Unknown Artist`
  - album: `Unknown Album`
  - duration: parsed as 1 second
- ran watcher with `pnpm scan:watch`
- added a WAV file while watcher was running
- confirmed watcher inserted the song
- removed temporary WAV files
- reran `pnpm scan`
- confirmed missing song rows were removed

Configured library directory after verification:

```text
/home/ruchir/Documents/spotify-clone/media
```

## Out Of Scope

Not implemented in this milestone:

- library UI
- search UI
- playback
- queueing
- playlists
- Google OAuth
- REST API
- music streaming routes
- mobile app
