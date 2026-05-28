# Milestone 3 Log - Library UI

Date completed: 2026-05-28

## Goal

Display indexed music in the web app with search, sorting, and virtualization. Do not implement playback.

## Implemented Scope

- Added a SvelteKit server load for reading indexed song metadata from SQLite.
- Added a Spotify-inspired dark library layout.
- Added an indexed song list.
- Added instant client-side search over loaded metadata.
- Added sortable columns.
- Added fixed-row virtualization for large libraries.
- Added empty states for no indexed songs and no search matches.

## Architecture

### Server Data Loading

Added:

```text
apps/web/src/routes/+page.server.ts
```

The server load:

- opens the SQLite database through `@music/database`
- runs migrations to keep the schema current
- reads metadata rows from `songs`
- maps snake_case database fields to frontend-friendly camelCase values
- closes the database connection after loading

This is intentionally not a public REST API. The master spec reserves authenticated REST endpoints for Milestone 8.

### Web App Dependency

Updated:

```text
apps/web/package.json
```

Added workspace dependency:

```text
@music/database
```

This lets the SvelteKit server load reuse the existing SQLite connection and migration helpers.

### Library View

Updated:

```text
apps/web/src/routes/+page.svelte
```

The page now includes:

- left navigation/sidebar
- indexed song count
- library header
- search input
- metadata table
- no-song empty state
- no-match empty state

The UI remains scoped to library browsing only. There are no playback controls or fake playback elements.

## Search

Search runs instantly in the browser over metadata already loaded by SvelteKit.

Search fields:

- title
- artist
- album
- year

Matching behavior:

- case-insensitive
- accent-insensitive
- token-based
- supports simple subsequence matching for fuzzy-ish results
- scores stronger title, artist, and album matches higher

This keeps the milestone practical for a 10,000-song personal library without introducing an API layer early.

## Sorting

Sortable fields:

- title
- artist
- album
- year
- duration

Clicking a selected sort column toggles ascending and descending order.

## Virtualization

The song list uses fixed-height row virtualization.

Implementation details:

- row height: 60px
- overscan rows: 8
- visible window calculated from scroll position and container height
- total scroll height preserved with an inner spacer
- only visible rows plus overscan are rendered

This avoids rendering every row at once for large indexed libraries.

## Out Of Scope

Not implemented in this milestone:

- playback
- queueing
- playlists
- Google OAuth
- REST API
- music streaming routes
- remote clients
- mobile app

## Verification

Commands to run for this milestone:

```bash
pnpm install
pnpm check
pnpm lint
pnpm build
```

Manual verification:

- open the web app
- confirm indexed songs render when the database has scanned music
- confirm empty state renders when no songs are indexed
- type in the search box and confirm results update immediately
- click table headers and confirm sorting changes
- scroll a long list and confirm only the visible rows render
