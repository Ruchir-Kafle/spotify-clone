import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const session = await locals.auth();

	return json({
		user: locals.mobileUser ?? session?.user ?? null
	});
};
