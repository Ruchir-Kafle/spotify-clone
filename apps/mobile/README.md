# Music Server Mobile

React Native iPhone client for the self-hosted music server.

## Run

```bash
pnpm mobile
```

For an iOS development build:

```bash
pnpm mobile:ios
```

## Login Flow

1. Enter the server URL.
   - Simulator local dev can use `http://localhost:5173`.
   - A physical iPhone should use the Tailscale HTTPS URL from the deployment guide.
2. Sign in with Google in the embedded web login.
3. The web session exchanges for a mobile bearer token through `/api/mobile-token`.
4. The app stores the server URL and token in AsyncStorage.

## Playback

Playback uses `react-native-track-player` so audio can continue in the background and expose lock screen controls. Stream URLs use the authenticated `/api/songs/:id/audio` endpoint with a bearer token header.

## Current Surface

- Google/Auth.js login bridge
- Library list
- Playlist list and playlist drill-in
- Native playback queue
- Background playback setup
- Lock screen play/pause/seek/next/previous capabilities
