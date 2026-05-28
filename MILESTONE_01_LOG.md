# Milestone 1 Log - Project Foundation

Date completed: 2026-05-28

## Goal

Set up the project foundation without implementing playback, scanning, authentication, playlists, or API behavior.

## Implemented Scope

- Created a pnpm monorepo.
- Added a SvelteKit web app using TypeScript and TailwindCSS.
- Added shared TypeScript configuration.
- Added linting and formatting setup.
- Added a SQLite database package with a real connection helper and migration runner.
- Added the first SQLite schema migration.
- Added root scripts for common development tasks.

## Architecture Added

### Root Workspace

Added:

- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `.gitignore`
- `.prettierrc`
- `.prettierignore`

The workspace includes:

- `apps/*`
- `packages/*`

Root scripts:

- `pnpm dev`
- `pnpm build`
- `pnpm check`
- `pnpm lint`
- `pnpm format`
- `pnpm db:migrate`

### Web App

Created the SvelteKit app at:

```text
apps/web
```

The app was scaffolded with:

- SvelteKit
- TypeScript
- TailwindCSS
- ESLint
- Prettier

The generated starter page was replaced with a minimal project foundation screen. No library UI, playback UI, scanner UI, auth UI, or placeholder feature logic was added.

### Shared Types Package

Created:

```text
packages/shared-types
```

Initial exported types:

- `RepeatMode`
- `Song`
- `Playlist`
- `PlaybackState`

These types mirror the master spec's intended data model but do not implement future milestone behavior.

### Database Package

Created:

```text
packages/database
```

Implemented:

- `openDatabase`
- `migrateDatabase`
- workspace root discovery
- default database path resolution
- default migrations path resolution

SQLite driver:

```text
better-sqlite3
```

The database helper enables:

- WAL mode
- foreign key enforcement
- migration tracking through `schema_migrations`

### Initial Migration

Added:

```text
database/migrations/0001_initial.sql
```

Tables created:

- `users`
- `songs`
- `playlists`
- `playlist_songs`
- `playback_state`
- `schema_migrations`

Indexes created:

- `songs_artist_idx`
- `songs_album_idx`
- `songs_title_idx`

This migration establishes the schema foundation only. It does not implement scanner, playlist, playback, or auth behavior.

## Important Decisions

- Used pnpm workspaces because the spec calls for a monorepo with apps and packages.
- Kept the web app minimal because Milestone 1 is foundation only.
- Used `better-sqlite3` for direct SQLite access because it is stable, synchronous, and simple for a local self-hosted app.
- Put migrations in the repo-level `database/migrations` directory so all packages share one database history.
- Added workspace-root discovery so package scripts can run from filtered pnpm commands and still locate the root database folder.

## Verification

Commands run successfully:

```bash
pnpm install
pnpm db:migrate
pnpm check
pnpm lint
pnpm build
```

The SvelteKit app was also started successfully at:

```text
http://localhost:5173/
```

## Out Of Scope

Not implemented in this milestone:

- playback
- scanner
- metadata parsing
- playlists
- Google OAuth
- REST API
- streaming routes
- mobile app
- deployment
