import type { MobileSession, Playlist, QueueState, Song } from '../types/api';

interface RequestOptions extends RequestInit {
	token: string;
}

export function normalizeServerUrl(value: string) {
	return value.trim().replace(/\/+$/, '');
}

export async function apiRequest<T>(serverUrl: string, path: string, options: RequestOptions) {
	const response = await fetch(`${serverUrl}${path}`, {
		...options,
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			Authorization: `Bearer ${options.token}`,
			...options.headers
		}
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(body || `Request failed with ${response.status}`);
	}

	if (response.status === 204) {
		return undefined as T;
	}

	return (await response.json()) as T;
}

export async function fetchSongs(session: MobileSession) {
	const data = await apiRequest<{ songs: Song[] }>(session.serverUrl, '/api/songs', {
		method: 'GET',
		token: session.token
	});

	return data.songs;
}

export async function fetchPlaylists(session: MobileSession) {
	const data = await apiRequest<{ playlists: Playlist[] }>(session.serverUrl, '/api/playlists', {
		method: 'GET',
		token: session.token
	});

	return data.playlists;
}

export async function fetchPlaylist(session: MobileSession, playlistId: string) {
	const data = await apiRequest<{ playlist: Playlist }>(
		session.serverUrl,
		`/api/playlists/${playlistId}`,
		{
			method: 'GET',
			token: session.token
		}
	);

	return data.playlist;
}

export async function fetchQueue(session: MobileSession) {
	const data = await apiRequest<{ queue: QueueState }>(session.serverUrl, '/api/queue', {
		method: 'GET',
		token: session.token
	});

	return data.queue;
}

export function audioUrl(session: MobileSession, songId: string) {
	return `${session.serverUrl}/api/songs/${songId}/audio`;
}
