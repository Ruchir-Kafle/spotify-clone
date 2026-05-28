# Spotify-Style Self-Hosted Music Platform — Master Project Specification

## Project Vision

Build a **Spotify-inspired self-hosted music platform** for personal use and learning.

The system should:
- Stream music stored locally on a home server
- Be accessible remotely from all personal devices
- Support a native-feeling iPhone experience with background playback
- Feel similar to Spotify in queueing and playback behavior
- Prioritize functionality, maintainability, security, and learning value

This is intentionally a **learning-focused engineering project** and should be built in incremental milestones.

The project goal is **NOT** to create a perfect Spotify clone.

The goal is:
> Build a high-quality self-hosted music ecosystem with a Spotify-like experience.

---

# Core Requirements

## Non-Negotiable Requirements

The app MUST support:

### Music Library
- Scan configured local directories
- Recursive folder scanning
- Automatic indexing
- Metadata extraction
- Fast search
- Large library support (10,000+ songs)

### Playback
- Play / pause
- Seek
- Next / previous
- Queue management
- Repeat modes
- Shuffle
- Playback persistence
- Resume previous session

### Playlists
- Create playlists
- Rename playlists
- Delete playlists
- Drag-and-drop reorder
- Persistent storage

### Security
- Google OAuth authentication
- Private network access via Tailscale
- Session security
- Secure API authorization

### Mobile
- Native iPhone app eventually
- Background playback
- Lock screen controls
- Queue sync

---

# Fixed Architecture Decisions

These are fixed and should NOT be changed by Codex unless explicitly instructed.

## Frontend (Web)
- SvelteKit
- TypeScript
- TailwindCSS

Purpose:
- Main interface during early development
- Admin UI
- Desktop usage
- Browser playback

## Backend
- Node.js
- TypeScript
- REST API
- WebSockets only when useful

Responsibilities:
- Filesystem scanning
- Metadata indexing
- Music streaming
- Queue management
- Playlist persistence
- Authentication
- Search
- Playback state

## Database
- SQLite

Reasoning:
- Lightweight
- Fast
- No infrastructure cost
- Ideal for self-hosting
- Excellent for large local libraries
- Easy migrations

## Mobile App (Later Phase)
- React Native

Reasoning:
- Better background audio support
- Better media controls on iOS
- Easier Spotify-like behavior

## Networking
- Tailscale ONLY for remote access initially

Do NOT:
- Require port forwarding
- Expose raw ports publicly
- Assume public internet deployment

Architecture should assume:
> Private VPN network via Tailscale.

---

# Security Model

## Authentication
Use:
- Google OAuth

Requirements:
- Session-based authentication
- Secure cookies
- CSRF protection
- Persistent login sessions

Use a mature authentication library.

Recommended:
- Auth.js

Do NOT implement OAuth manually.

## Authorization Rules
Every API route should require authentication except:
- OAuth callbacks
- health check routes

All music endpoints must validate session state.

## Filesystem Security
NEVER expose arbitrary filesystem access.

Allowed:
```ts
/music-library/
```

Forbidden:
```ts
GET /file?path=C:/Users/
```

Only files inside configured music directories should ever be accessible.

---

# Remote Access Model

Remote access will use:

- Tailscale installed on home server
- Tailscale installed on iPhone
- Same authenticated account

Traffic assumptions:
- encrypted
- private
- not publicly exposed

The app should still require Google login.

Security layers:

Layer 1:
Tailscale private network

Layer 2:
Google OAuth authentication

This is intentional defense-in-depth.

---

# Music Library Requirements

## Supported Formats
- MP3
- FLAC
- WAV
- M4A
- OGG

## Metadata Extraction
Extract:
- title
- artist
- album
- duration
- track number
- disc number
- year
- genre (optional)

## Metadata Fallback Rules
If missing:

Title:
- filename

Artist:
- Unknown Artist

Album:
- Unknown Album

## File Watching
Use efficient file watchers.

DO NOT constantly rescan entire directories.

Automatically detect:
- added files
- removed files
- modified metadata

---

# Spotify Behavior Rules

Playback behavior should feel like Spotify.

## Repeat Modes

### Repeat Off
Stop at end of queue.

### Repeat Playlist
Loop entire playlist indefinitely.

### Repeat One
Loop current song forever.

## Shuffle Rules
Shuffle must:
- avoid immediate repeats
- preserve history
- allow previous button behavior
- feel natural

Do NOT reshuffle randomly every song.

Use a deterministic shuffled queue.

## Previous Button Rules
If song progress > threshold:
- restart song

Else:
- previous track

## Queue Rules
Queue must support:
- visible queue
- history stack
- next-up list
- jump to track

Queue behavior should remain stable.

---

# UI / UX Requirements

Create a Spotify-inspired dark theme.

Do NOT clone Spotify exactly.

## Layout

### Left Sidebar
- playlists
- library
- navigation

### Center Area
- library view
- playlist view
- search results

### Bottom Player
- play/pause
- next/previous
- seek bar
- volume
- repeat button
- shuffle button
- queue button
- current song title

## Search
Search should be:
- instant
- fuzzy
- performant

Target:
10,000+ songs.

Use virtualization for long lists.

---

# Persistence Requirements

Persist:
- music directory
- playlists
- queue state
- current song
- timestamp position
- volume
- repeat mode
- shuffle state
- recently played

On restart:
restore previous session.

---

# Performance Constraints

Optimize for:
- 10k+ songs
- fast search
- low memory usage
- quick library loading
- smooth playback

Avoid:
- loading entire audio files into memory
- expensive rescans
- blocking filesystem operations

Prefer:
- indexing
- pagination
- caching metadata only

---

# Recommended Folder Structure

```text
project-root/
│
├── apps/
│   ├── web/
│   │   ├── src/
│   │   ├── routes/
│   │   ├── lib/
│   │   └── components/
│   │
│   └── mobile/
│       └── react-native-app/
│
├── packages/
│   ├── shared-types/
│   ├── database/
│   ├── auth/
│   ├── playback-engine/
│   ├── metadata-indexer/
│   ├── scanner/
│   └── api/
│
├── database/
│   ├── migrations/
│   └── app.db
│
└── media/
```

---

# Database Intent

## songs
- id
- path
- title
- artist
- album
- duration
- track_number
- created_at

## playlists
- id
- name
- created_at

## playlist_songs
- playlist_id
- song_id
- order_index

## users
- id
- email
- name
- google_id
- avatar_url

## playback_state
- queue
- current_song
- timestamp
- repeat_mode
- shuffle_state

---

# Critical Instructions For Codex

## DO NOT OVERENGINEER

Build incrementally.

Do NOT build future phases early.

If a feature is not requested in the current milestone:
DO NOT IMPLEMENT IT.

## NO PLACEHOLDER LOGIC

Everything must work for real.

Do NOT fake:
- playback
- queueing
- OAuth
- streaming
- database logic

## MVP FIRST

Always prioritize:
working software > fancy architecture.

## ASK BEFORE MAJOR CHANGES

Do not swap:
- frameworks
- databases
- auth systems
- playback libraries

without approval.

---

# Implementation Milestones

## Milestone 1 — Project Foundation

Goal:
Set up project architecture.

Build:
- monorepo structure
- SvelteKit
- SQLite setup
- TypeScript
- Tailwind
- linting
- formatting

DO NOT implement playback.

---

## Milestone 2 — Music Scanner

Goal:
Scan local folders.

Build:
- directory selection
- recursive scan
- supported format detection
- metadata parsing
- SQLite insertion
- file watching

DO NOT implement playlists.

---

## Milestone 3 — Library UI

Goal:
Display indexed music.

Build:
- searchable song list
- sorting
- virtualization
- library UI

DO NOT implement playback.

---

## Milestone 4 — Playback Engine

Goal:
Play local audio.

Build:
- play
- pause
- seek
- next
- previous
- volume

Playback must be real.

---

## Milestone 5 — Queue System

Goal:
Spotify-like queue.

Build:
- queue
- history
- shuffle
- repeat
- next-up behavior

---

## Milestone 6 — Playlists

Goal:
Playlist management.

Build:
- create
- rename
- delete
- reorder
- persistence

---

## Milestone 7 — Google OAuth

Goal:
Authentication.

Build:
- Google OAuth
- session handling
- protected routes

Use Auth.js.

Do NOT implement custom auth.

---

## Milestone 8 — API Layer

Goal:
Enable remote clients.

Build:
- REST endpoints
- authenticated APIs
- music streaming routes
- playlist APIs
- queue APIs

---

## Milestone 9 — Tailscale Deployment

Goal:
Remote access.

Build:
- deployment guide
- configuration
- environment setup

No public internet exposure.

---

## Milestone 10 — React Native App

Goal:
Native iPhone app.

Build:
- login
- library
- playback
- playlists
- background playback
- lock screen controls

---

## Milestone 11 — Sync & Polish

Goal:
Spotify-like feel.

Build:
- cross-device sync
- continue listening
- recent history
- polish
- performance improvements

---

# Copy/Paste Prompt Sections For Codex

## Prompt 1 — Foundation

Only implement Milestone 1.
Do not continue beyond it.
Propose architecture before writing code.
No placeholder logic.

## Prompt 2 — Scanner

Only implement Milestone 2.
Do not continue beyond it.
Use efficient filesystem watching.
Metadata parsing must be real.

## Prompt 3 — Library UI

Only implement Milestone 3.
Do not implement playback.
Optimize for 10,000+ songs.

## Prompt 4 — Playback

Only implement Milestone 4.
Playback must be real.
Do not implement OAuth.

## Prompt 5 — Queue

Only implement Milestone 5.
Implement Spotify-like behavior.

## Prompt 6 — Playlists

Only implement Milestone 6.
Persist playlist state.

## Prompt 7 — OAuth

Only implement Milestone 7.
Use Google OAuth via Auth.js.
No custom auth.

## Prompt 8 — API

Only implement Milestone 8.
Create authenticated REST APIs.

## Prompt 9 — Deployment

Only implement Milestone 9.
Assume Tailscale deployment.

## Prompt 10 — Mobile

Only implement Milestone 10.
Use React Native.
Support background playback.

## Prompt 11 — Polish

Only implement Milestone 11.
Focus on stability and Spotify-like UX.

