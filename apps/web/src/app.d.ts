import type { DefaultSession } from '@auth/core/types';

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
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
