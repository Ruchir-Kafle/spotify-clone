import { handle as authHandle } from './auth';
import { authenticateMobileBearerToken } from '$lib/server/mobile-auth';
import { json, redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

const publicPrefixes = ['/auth', '/signin', '/health'];
const publicPaths = ['/favicon.ico', '/robots.txt'];

const authorizationHandle: Handle = async ({ event, resolve }) => {
	const pathname = event.url.pathname;

	if (isPublicPath(pathname) || isSvelteKitAsset(pathname)) {
		return resolve(event);
	}

	const session = await event.locals.auth();
	const mobileUser = isApiPath(pathname)
		? authenticateMobileBearerToken(event.request.headers.get('authorization'))
		: undefined;

	if (mobileUser) {
		event.locals.mobileUser = mobileUser;
	}

	if (!session?.user && !mobileUser) {
		if (isApiPath(pathname)) {
			return json({ error: 'Authentication required.' }, { status: 401 });
		}

		throw redirect(303, `/signin?callbackUrl=${encodeURIComponent(pathname + event.url.search)}`);
	}

	return resolve(event);
};

export const handle = sequence(authHandle, authorizationHandle);

function isPublicPath(pathname: string) {
	return (
		publicPaths.includes(pathname) || publicPrefixes.some((prefix) => pathname.startsWith(prefix))
	);
}

function isSvelteKitAsset(pathname: string) {
	return pathname.startsWith('/_app/') || pathname.startsWith('/@') || pathname.includes('/@fs/');
}

function isApiPath(pathname: string) {
	return pathname === '/api' || pathname.startsWith('/api/');
}
