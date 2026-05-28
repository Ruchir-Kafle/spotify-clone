import { createPlaylist, listPlaylists, normalizeName } from '$lib/server/api-data';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	return json({
		playlists: listPlaylists()
	});
};

export const POST: RequestHandler = async ({ request }) => {
	const payload = (await request.json()) as { name?: unknown };
	const name = normalizeName(payload.name);

	if (!name) {
		error(400, 'Playlist name is required.');
	}

	return json({ playlist: createPlaylist(name) }, { status: 201 });
};
