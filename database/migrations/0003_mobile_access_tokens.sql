CREATE TABLE IF NOT EXISTS mobile_access_tokens (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	token_hash TEXT NOT NULL UNIQUE,
	label TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	last_used_at TEXT,
	revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS mobile_access_tokens_user_id_idx ON mobile_access_tokens (user_id);
CREATE INDEX IF NOT EXISTS mobile_access_tokens_token_hash_idx ON mobile_access_tokens (token_hash);
