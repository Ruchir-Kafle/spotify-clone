import { addSongToPlaylist, reorderPlaylistSongs, stringArray } from '$lib/server/api-data';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const payload = (await request.json()) as { songId?: unknown };
	const songId = typeof payload.songId === 'string' ? payload.songId : undefined;

	if (!songId) {
		error(400, 'Song id is required.');
	}

	return json({ playlist: addSongToPlaylist(params.id, songId) });
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const payload = (await request.json()) as { songIds?: unknown };
	const songIds = stringArray(payload.songIds);

	return json({ playlist: reorderPlaylistSongs(params.id, songIds) });
};
