import { migrateDatabase, openDatabase } from '@music/database';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

interface UserRow {
	id: string;
	email: string;
	name: string | null;
	avatar_url: string | null;
}

export interface MobileAuthenticatedUser {
	id: string;
	email: string;
	name: string | null;
	image: string | null;
}

export function createMobileAccessToken(email: string, label: string | null) {
	const token = `ms_${randomBytes(32).toString('base64url')}`;
	const db = openDatabase();

	try {
		migrateDatabase(db);

		const user = db
			.prepare('SELECT id, email, name, avatar_url FROM users WHERE email = ?')
			.get(email) as UserRow | undefined;

		if (!user) {
			return undefined;
		}

		db.prepare(
			`
				INSERT INTO mobile_access_tokens (id, user_id, token_hash, label)
				VALUES (?, ?, ?, ?)
			`
		).run(randomUUID(), user.id, hashToken(token), label);

		return {
			token,
			user: mapUser(user)
		};
	} finally {
		db.close();
	}
}

export function authenticateMobileBearerToken(authorizationHeader: string | null) {
	const token = bearerToken(authorizationHeader);

	if (!token) {
		return undefined;
	}

	const db = openDatabase();

	try {
		migrateDatabase(db);

		const user = db
			.prepare(
				`
					SELECT users.id, users.email, users.name, users.avatar_url
					FROM mobile_access_tokens
					JOIN users ON users.id = mobile_access_tokens.user_id
					WHERE mobile_access_tokens.token_hash = ?
						AND mobile_access_tokens.revoked_at IS NULL
				`
			)
			.get(hashToken(token)) as UserRow | undefined;

		if (!user) {
			return undefined;
		}

		db.prepare(
			'UPDATE mobile_access_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE token_hash = ?'
		).run(hashToken(token));

		return mapUser(user);
	} finally {
		db.close();
	}
}

function bearerToken(authorizationHeader: string | null) {
	if (!authorizationHeader?.startsWith('Bearer ')) {
		return undefined;
	}

	const token = authorizationHeader.slice('Bearer '.length).trim();
	return token.length > 0 ? token : undefined;
}

function hashToken(token: string) {
	return createHash('sha256').update(token).digest('hex');
}

function mapUser(user: UserRow): MobileAuthenticatedUser {
	return {
		id: user.id,
		email: user.email,
		name: user.name,
		image: user.avatar_url
	};
}
