# Milestone 10 - React Native App

## Scope

Milestone 10 adds the native mobile client foundation for iPhone. The app can log in through the existing Google/Auth.js web flow, exchange that authenticated session for a mobile bearer token, list the library and playlists, and play authenticated streams with background playback and lock screen controls wired through React Native Track Player.

## Files Changed

- `apps/mobile/**`
  - Added an Expo React Native app.
  - Added login, library, playlist, and player UI.
  - Added mobile API client helpers.
  - Added AsyncStorage-backed session persistence.
  - Added Track Player service for background playback and remote controls.
- `apps/web/src/lib/server/mobile-auth.ts`
  - Added mobile access token creation and bearer-token authentication.
- `apps/web/src/routes/api/mobile-token/+server.ts`
  - Added authenticated session-to-mobile-token exchange endpoint.
- `apps/web/src/hooks.server.ts`
  - Allows `/api/*` authentication through either Auth.js session cookies or mobile bearer tokens.
- `apps/web/src/routes/api/me/+server.ts`
  - Returns mobile bearer identity when present.
- `database/migrations/0003_mobile_access_tokens.sql`
  - Added hashed, revocable mobile access token storage.
- `package.json`
  - Added `pnpm mobile` and `pnpm mobile:ios`.
  - Added mobile TypeScript checks to `pnpm check`.
- `pnpm-lock.yaml`
  - Updated for Expo, React Native, WebView, AsyncStorage, and Track Player dependencies.

## Mobile App Surface

- Server URL entry
- Google login in an embedded WebView
- Mobile bearer token exchange through `/api/mobile-token`
- Stored session with AsyncStorage
- Library list
- Playlist list and playlist drill-in
- Native playback queue
- Authenticated API streaming
- Background audio setup
- Lock screen capabilities:
  - play
  - pause
  - next
  - previous
  - seek

## Authentication Design

The app does not include Google OAuth client secrets. Instead:

1. The user enters the server URL.
2. The app opens the server's `/signin` route in a WebView.
3. The user signs in through the existing Auth.js Google flow.
4. WebView JavaScript calls `/api/mobile-token` using the authenticated cookie session.
5. The server returns a one-time visible bearer token.
6. The mobile app stores the token and uses it for `/api/*` calls.
7. The server stores only a SHA-256 hash of the token.

## Native Playback Notes

The app uses `react-native-track-player`, which requires a native development build. Expo Go is not enough for this library. Use:

```bash
pnpm mobile:ios
```

or an equivalent Expo development build workflow.

## Commands Added

```bash
pnpm mobile
pnpm mobile:ios
pnpm --filter @music/mobile check
```

## Verification

- `pnpm --filter @music/mobile check`
- `pnpm format`
- `pnpm check`
- `pnpm lint`
- `pnpm build`
- `pnpm --filter @music/mobile exec expo config --type public`
- Started Expo Metro on `http://localhost:8082`.

## Known Follow-Up

- Playlist creation/editing is still web/API-first; the mobile app currently browses playlists and plays songs.
- Cross-device playback sync and recent history polish belong to Milestone 11.
