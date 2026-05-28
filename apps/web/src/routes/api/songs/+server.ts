import { listSongs } from '$lib/server/api-data';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	return json({
		songs: listSongs()
	});
};
