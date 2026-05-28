import { handle as authHandle } from './auth';
import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

const publicPrefixes = ['/auth', '/signin', '/health'];
const publicPaths = ['/favicon.ico', '/robots.txt'];

const authorizationHandle: Handle = async ({ event, resolve }) => {
	const pathname = event.url.pathname;

	if (isPublicPath(pathname) || isSvelteKitAsset(pathname)) {
		return resolve(event);
	}

	const session = await event.locals.auth();

	if (!session?.user) {
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
