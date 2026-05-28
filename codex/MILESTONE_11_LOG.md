# Milestone 11 - Sync & Polish

## Scope

Milestone 11 adds the first cross-device playback sync and continue-listening polish pass. The web app and mobile app now share the same queue/playback state contract, and the playback state endpoint supports partial updates so devices can update progress without clobbering the queue or history.

## Files Changed

- `apps/web/src/lib/server/api-data.ts`
  - Updated playback-state writes to merge partial payloads with the current persisted state.
  - Prevents mobile progress updates from clearing queue/history fields.
- `apps/web/src/routes/playback-state/+server.ts`
  - Reused the shared playback-state API helpers.
  - Added `GET` support.
  - Returns the updated playback state after writes.
- `apps/web/src/routes/+page.server.ts`
  - Includes `playback_state.updated_at` in the initial page data.
- `apps/web/src/routes/+page.svelte`
  - Polls `/api/queue` when local playback is idle.
  - Applies newer remote playback state for cross-device handoff.
  - Shows a sync notice when remote state is applied.
  - Adds a continue-listening card with saved timestamp.
- `apps/mobile/src/services/api.ts`
  - Added `updateQueue`.
- `apps/mobile/App.tsx`
  - Writes native playback queue/progress changes back to the server.
  - Restores current song and timestamp from server queue state.
  - Adds continue-listening and recent-history UI sections.
  - Enables Track Player progress events for periodic sync.

## Behavior

- Web playback persists queue, current song, timestamp, volume, repeat, shuffle, and history.
- Mobile playback persists current queue, current song, timestamp, and recent track transitions.
- Web refreshes remote playback state every eight seconds while idle and visible.
- Continue-listening appears when a saved song exists and local playback is paused.
- Recent history is derived from persisted playback history.

## Implementation Notes

- Sync is intentionally conservative: the web app does not apply remote state while local playback is active.
- This milestone keeps the existing single-install/global playback state model. Per-user playback state can be layered later if the app becomes multi-user.
- The mobile app uses partial queue updates so progress sync does not erase server-side state.

## Verification

- `pnpm format`
- `pnpm check`
- `pnpm lint`
- `pnpm build`

All verification commands passed.
