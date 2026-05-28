import { deletePlaylist, getPlaylist, normalizeName, renamePlaylist } from '$lib/server/api-data';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
	const playlist = getPlaylist(params.id);

	if (!playlist) {
		error(404, 'Playlist not found.');
	}

	return json({ playlist });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const payload = (await request.json()) as { name?: unknown };
	const name = normalizeName(payload.name);

	if (!name) {
		error(400, 'Playlist name is required.');
	}

	const playlist = renamePlaylist(params.id, name);

	if (!playlist) {
		error(404, 'Playlist not found.');
	}

	return json({ playlist });
};

export const DELETE: RequestHandler = ({ params }) => {
	if (!deletePlaylist(params.id)) {
		error(404, 'Playlist not found.');
	}

	return new Response(null, { status: 204 });
};
