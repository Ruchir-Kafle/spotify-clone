import { createMobileAccessToken } from '$lib/server/mobile-auth';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
	const session = await locals.auth();
	const email = session?.user?.email;

	if (!email) {
		error(401, 'Authentication required.');
	}

	const payload = (await request.json().catch(() => ({}))) as { label?: unknown };
	const label =
		typeof payload.label === 'string' && payload.label.trim() ? payload.label.trim() : null;
	const mobileToken = createMobileAccessToken(email, label);

	if (!mobileToken) {
		error(404, 'Authenticated user was not found.');
	}

	return json(mobileToken, { status: 201 });
};
