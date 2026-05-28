import { streamSongAudio } from '$lib/server/audio-stream';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, request }) => {
	return streamSongAudio(params.id, request);
};
