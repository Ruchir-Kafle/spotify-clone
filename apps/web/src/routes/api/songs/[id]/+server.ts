import { getSong } from '$lib/server/api-data';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
	const song = getSong(params.id);

	if (!song) {
		error(404, 'Song not found.');
	}

	return json({ song });
};
