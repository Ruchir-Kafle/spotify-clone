import { getPlaybackState, updatePlaybackState } from '$lib/server/api-data';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	return json({
		queue: getPlaybackState()
	});
};

export const PUT: RequestHandler = async ({ request }) => {
	const payload = (await request.json()) as Record<string, unknown>;

	return json({
		queue: updatePlaybackState(payload)
	});
};
