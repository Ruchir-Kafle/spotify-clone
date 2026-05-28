import { getPlaybackState, updatePlaybackState } from '$lib/server/api-data';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	return json({
		playbackState: getPlaybackState()
	});
};

export const POST: RequestHandler = async ({ request }) => {
	const payload = (await request.json()) as Record<string, unknown>;

	return json({
		ok: true,
		playbackState: updatePlaybackState(payload)
	});
};
