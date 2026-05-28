CREATE TABLE IF NOT EXISTS users (
	id TEXT PRIMARY KEY,
	email TEXT NOT NULL UNIQUE,
	name TEXT,
	google_id TEXT UNIQUE,
	avatar_url TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS songs (
	id TEXT PRIMARY KEY,
	path TEXT NOT NULL UNIQUE,
	title TEXT NOT NULL,
	artist TEXT NOT NULL DEFAULT 'Unknown Artist',
	album TEXT NOT NULL DEFAULT 'Unknown Album',
	duration REAL,
	track_number INTEGER,
	disc_number INTEGER,
	year INTEGER,
	genre TEXT,
	file_size INTEGER,
	file_modified_at TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS songs_artist_idx ON songs (artist);
CREATE INDEX IF NOT EXISTS songs_album_idx ON songs (album);
CREATE INDEX IF NOT EXISTS songs_title_idx ON songs (title);

CREATE TABLE IF NOT EXISTS playlists (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS playlist_songs (
	playlist_id TEXT NOT NULL REFERENCES playlists (id) ON DELETE CASCADE,
	song_id TEXT NOT NULL REFERENCES songs (id) ON DELETE CASCADE,
	order_index INTEGER NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (playlist_id, song_id),
	UNIQUE (playlist_id, order_index)
);

CREATE TABLE IF NOT EXISTS playback_state (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	queue_json TEXT NOT NULL DEFAULT '[]',
	current_song_id TEXT REFERENCES songs (id) ON DELETE SET NULL,
	timestamp_seconds REAL NOT NULL DEFAULT 0,
	volume REAL NOT NULL DEFAULT 1,
	repeat_mode TEXT NOT NULL DEFAULT 'off' CHECK (repeat_mode IN ('off', 'playlist', 'one')),
	shuffle_enabled INTEGER NOT NULL DEFAULT 0 CHECK (shuffle_enabled IN (0, 1)),
	shuffle_state_json TEXT,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO playback_state (id) VALUES (1);

CREATE TABLE IF NOT EXISTS schema_migrations (
	version TEXT PRIMARY KEY,
	applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
