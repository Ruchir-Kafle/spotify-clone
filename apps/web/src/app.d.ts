import type { DefaultSession } from '@auth/core/types';
import type { MobileAuthenticatedUser } from '$lib/server/mobile-auth';

import '@auth/sveltekit';

declare module '@auth/core/types' {
	interface Session {
		user?: DefaultSession['user'] & {
			id?: string;
		};
	}
}

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			mobileUser?: MobileAuthenticatedUser;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
