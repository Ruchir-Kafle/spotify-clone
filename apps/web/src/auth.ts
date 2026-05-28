import { migrateDatabase, openDatabase } from '@music/database';
import { SvelteKitAuth } from '@auth/sveltekit';
import Google from '@auth/sveltekit/providers/google';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { createHash, randomUUID } from 'node:crypto';

export const { handle, signIn, signOut } = SvelteKitAuth(async () => ({
	providers: [
		Google({
			clientId: env.AUTH_GOOGLE_ID,
			clientSecret: env.AUTH_GOOGLE_SECRET
		})
	],
	secret:
		env.AUTH_SECRET ||
		(dev ? 'music-server-local-development-secret-do-not-use-in-production' : undefined),
	trustHost: dev || env.AUTH_TRUST_HOST === 'true',
	session: {
		strategy: 'jwt',
		maxAge: 60 * 60 * 24 * 30
	},
	callbacks: {
		async signIn({ user, account, profile }) {
			if (account?.provider !== 'google' || !user.email) {
				return false;
			}

			const googleId = account.providerAccountId ?? stringProfileValue(profile, 'sub');
			upsertGoogleUser({
				email: user.email,
				name: user.name ?? null,
				googleId,
				avatarUrl: user.image ?? stringProfileValue(profile, 'picture') ?? null
			});

			return true;
		},
		async session({ session, token }) {
			if (session.user && typeof token.sub === 'string') {
				session.user.id = stableUserId(token.sub);
			}

			return session;
		}
	},
	pages: {
		signIn: '/signin'
	}
}));

interface GoogleUserInput {
	email: string;
	name: string | null;
	googleId: string | undefined;
	avatarUrl: string | null;
}

function upsertGoogleUser(user: GoogleUserInput) {
	const db = openDatabase();

	try {
		migrateDatabase(db);

		const existingUser = db
			.prepare('SELECT id FROM users WHERE google_id = ? OR email = ?')
			.get(user.googleId ?? null, user.email) as { id: string } | undefined;

		db.prepare(
			`
				INSERT INTO users (id, email, name, google_id, avatar_url, updated_at)
				VALUES (@id, @email, @name, @googleId, @avatarUrl, CURRENT_TIMESTAMP)
				ON CONFLICT(email) DO UPDATE SET
					name = excluded.name,
					google_id = excluded.google_id,
					avatar_url = excluded.avatar_url,
					updated_at = CURRENT_TIMESTAMP
			`
		).run({
			id: existingUser?.id ?? randomUUID(),
			email: user.email,
			name: user.name,
			googleId: user.googleId ?? null,
			avatarUrl: user.avatarUrl
		});
	} finally {
		db.close();
	}
}

function stableUserId(value: string) {
	return createHash('sha256').update(value).digest('hex');
}

function stringProfileValue(profile: unknown, key: string) {
	if (!profile || typeof profile !== 'object' || !(key in profile)) {
		return undefined;
	}

	const value = (profile as Record<string, unknown>)[key];
	return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}
