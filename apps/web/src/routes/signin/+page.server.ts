import { signIn } from '../../auth';
import { env } from '$env/dynamic/private';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	googleOAuthConfigured: hasGoogleOAuthConfig()
});

export const actions: Actions = {
	default: async (event) => {
		if (!hasGoogleOAuthConfig()) {
			return fail(400, {
				message: 'Google OAuth is not configured yet. Add apps/web/.env and restart the dev server.'
			});
		}

		return signIn(event);
	}
};

function hasGoogleOAuthConfig() {
	return Boolean(
		env.AUTH_GOOGLE_ID &&
		env.AUTH_GOOGLE_SECRET &&
		env.AUTH_GOOGLE_ID !== 'your-google-oauth-client-id' &&
		env.AUTH_GOOGLE_SECRET !== 'your-google-oauth-client-secret'
	);
}
