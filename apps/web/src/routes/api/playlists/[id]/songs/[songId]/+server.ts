import { removeSongFromPlaylist } from '$lib/server/api-data';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = ({ params }) => {
	return json({
		playlist: removeSongFromPlaylist(params.id, params.songId)
	});
};
