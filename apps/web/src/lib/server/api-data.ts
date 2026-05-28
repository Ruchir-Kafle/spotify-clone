import { migrateDatabase, openDatabase } from '@music/database';
import { error } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';

type RepeatMode = 'off' | 'playlist' | 'one';

interface SongRow {
	id: string;
	title: string;
	artist: string;
	album: string;
	duration: number | null;
	track_number: number | null;
	disc_number: number | null;
	year: number | null;
	genre: string | null;
	path: string;
	file_size: number | null;
	file_modified_at: string | null;
	created_at: string;
	updated_at: string;
}

interface PlaylistRow {
	id: string;
	name: string;
	song_count: number;
	created_at: string;
	updated_at: string;
}

interface PlaylistDetailRow {
	id: string;
	name: string;
	created_at: string;
	updated_at: string;
}

interface PlaybackStateRow {
	queue_json: string;
	current_song_id: string | null;
	timestamp_seconds: number;
	volume: number;
	repeat_mode: RepeatMode;
	shuffle_enabled: 0 | 1;
	shuffle_state_json: string | null;
	updated_at: string;
}

interface QueueStateJson {
	queueIds?: unknown;
	historyIds?: unknown;
}

interface ShuffleStateJson {
	shuffledQueueIds?: unknown;
}

export interface PlaybackStatePayload {
	queueIds?: unknown;
	historyIds?: unknown;
	currentSongId?: unknown;
	timestampSeconds?: unknown;
	volume?: unknown;
	repeatMode?: unknown;
	shuffleEnabled?: unknown;
	shuffledQueueIds?: unknown;
}

export function listSongs() {
	const db = openMigratedDatabase();

	try {
		return (
			db
				.prepare(
					`
						SELECT
							id,
							title,
							artist,
							album,
							duration,
							track_number,
							disc_number,
							year,
							genre,
							path,
							file_size,
							file_modified_at,
							created_at,
							updated_at
						FROM songs
						ORDER BY artist COLLATE NOCASE ASC, album COLLATE NOCASE ASC, track_number ASC, title COLLATE NOCASE ASC
					`
				)
				.all() as SongRow[]
		).map(mapSong);
	} finally {
		db.close();
	}
}

export function getSong(songId: string) {
	const db = openMigratedDatabase();

	try {
		const song = db
			.prepare(
				`
					SELECT
						id,
						title,
						artist,
						album,
						duration,
						track_number,
						disc_number,
						year,
						genre,
						path,
						file_size,
						file_modified_at,
						created_at,
						updated_at
					FROM songs
					WHERE id = ?
				`
			)
			.get(songId) as SongRow | undefined;

		return song ? mapSong(song) : undefined;
	} finally {
		db.close();
	}
}

export function listPlaylists() {
	const db = openMigratedDatabase();

	try {
		return (
			db
				.prepare(
					`
						SELECT
							playlists.id,
							playlists.name,
							COUNT(playlist_songs.song_id) AS song_count,
							playlists.created_at,
							playlists.updated_at
						FROM playlists
						LEFT JOIN playlist_songs ON playlist_songs.playlist_id = playlists.id
						GROUP BY playlists.id
						ORDER BY playlists.updated_at DESC, playlists.name COLLATE NOCASE ASC
					`
				)
				.all() as PlaylistRow[]
		).map((playlist) => ({
			id: playlist.id,
			name: playlist.name,
			songCount: playlist.song_count,
			createdAt: playlist.created_at,
			updatedAt: playlist.updated_at
		}));
	} finally {
		db.close();
	}
}

export function createPlaylist(name: string) {
	const id = randomUUID();
	const db = openMigratedDatabase();

	try {
		db.prepare('INSERT INTO playlists (id, name) VALUES (?, ?)').run(id, name);
		return getPlaylistWithOpenDatabase(db, id);
	} finally {
		db.close();
	}
}

export function getPlaylist(playlistId: string) {
	const db = openMigratedDatabase();

	try {
		return getPlaylistWithOpenDatabase(db, playlistId);
	} finally {
		db.close();
	}
}

export function renamePlaylist(playlistId: string, name: string) {
	const db = openMigratedDatabase();

	try {
		const result = db
			.prepare('UPDATE playlists SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
			.run(name, playlistId);

		if (result.changes === 0) {
			return undefined;
		}

		return getPlaylistWithOpenDatabase(db, playlistId);
	} finally {
		db.close();
	}
}

export function deletePlaylist(playlistId: string) {
	const db = openMigratedDatabase();

	try {
		return db.prepare('DELETE FROM playlists WHERE id = ?').run(playlistId).changes > 0;
	} finally {
		db.close();
	}
}

export function addSongToPlaylist(playlistId: string, songId: string) {
	const db = openMigratedDatabase();

	try {
		if (!playlistExists(db, playlistId)) {
			error(404, 'Playlist not found.');
		}

		if (!songExists(db, songId)) {
			error(404, 'Song not found.');
		}

		const nextOrder = (
			db
				.prepare(
					'SELECT COALESCE(MAX(order_index), -1) + 1 AS next_order FROM playlist_songs WHERE playlist_id = ?'
				)
				.get(playlistId) as { next_order: number }
		).next_order;

		db.prepare(
			`
				INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, order_index)
				VALUES (?, ?, ?)
			`
		).run(playlistId, songId, nextOrder);
		db.prepare('UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(playlistId);

		return getPlaylistWithOpenDatabase(db, playlistId);
	} finally {
		db.close();
	}
}

export function removeSongFromPlaylist(playlistId: string, songId: string) {
	const db = openMigratedDatabase();

	try {
		if (!playlistExists(db, playlistId)) {
			error(404, 'Playlist not found.');
		}

		db.prepare('DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?').run(
			playlistId,
			songId
		);
		reorderPersistedSongs(db, playlistId, currentSongIds(db, playlistId));
		return getPlaylistWithOpenDatabase(db, playlistId);
	} finally {
		db.close();
	}
}

export function reorderPlaylistSongs(playlistId: string, songIds: string[]) {
	const db = openMigratedDatabase();

	try {
		if (!playlistExists(db, playlistId)) {
			error(404, 'Playlist not found.');
		}

		const existingIds = new Set(currentSongIds(db, playlistId));
		const normalizedIds = songIds.filter((songId) => existingIds.has(songId));

		if (
			normalizedIds.length !== existingIds.size ||
			new Set(normalizedIds).size !== existingIds.size
		) {
			error(400, 'Playlist order must include every playlist song exactly once.');
		}

		reorderPersistedSongs(db, playlistId, normalizedIds);
		return getPlaylistWithOpenDatabase(db, playlistId);
	} finally {
		db.close();
	}
}

export function getPlaybackState() {
	const db = openMigratedDatabase();

	try {
		const row = db
			.prepare(
				`
					SELECT
						queue_json,
						current_song_id,
						timestamp_seconds,
						volume,
						repeat_mode,
						shuffle_enabled,
						shuffle_state_json,
						updated_at
					FROM playback_state
					WHERE id = 1
				`
			)
			.get() as PlaybackStateRow | undefined;

		return normalizePlaybackState(row);
	} finally {
		db.close();
	}
}

export function updatePlaybackState(payload: PlaybackStatePayload) {
	const db = openMigratedDatabase();

	try {
		const current = getPlaybackStateWithOpenDatabase(db);
		const queueIds =
			payload.queueIds === undefined ? current.queueIds : stringArray(payload.queueIds);
		const historyIds =
			payload.historyIds === undefined ? current.historyIds : stringArray(payload.historyIds);
		const currentSongId =
			payload.currentSongId === undefined
				? current.currentSongId
				: typeof payload.currentSongId === 'string'
					? payload.currentSongId
					: null;
		const timestampSeconds =
			payload.timestampSeconds === undefined
				? current.timestampSeconds
				: finiteNumber(payload.timestampSeconds, 0);
		const volume =
			payload.volume === undefined
				? current.volume
				: clamp(finiteNumber(payload.volume, 0.9), 0, 1);
		const repeatMode =
			payload.repeatMode === undefined
				? current.repeatMode
				: normalizeRepeatMode(payload.repeatMode);
		const shuffleEnabled =
			payload.shuffleEnabled === undefined
				? current.shuffleEnabled
				: payload.shuffleEnabled === true;
		const shuffledQueueIds =
			payload.shuffledQueueIds === undefined
				? current.shuffledQueueIds
				: stringArray(payload.shuffledQueueIds);

		db.prepare(
			`
				UPDATE playback_state
				SET
					queue_json = @queueJson,
					current_song_id = @currentSongId,
					timestamp_seconds = @timestampSeconds,
					volume = @volume,
					repeat_mode = @repeatMode,
					shuffle_enabled = @shuffleEnabled,
					shuffle_state_json = @shuffleStateJson,
					updated_at = CURRENT_TIMESTAMP
				WHERE id = 1
			`
		).run({
			queueJson: JSON.stringify({ queueIds, historyIds }),
			currentSongId,
			timestampSeconds,
			volume,
			repeatMode,
			shuffleEnabled: shuffleEnabled ? 1 : 0,
			shuffleStateJson: JSON.stringify({ shuffledQueueIds })
		});

		return getPlaybackStateWithOpenDatabase(db);
	} finally {
		db.close();
	}
}

function getPlaylistWithOpenDatabase(db: ReturnType<typeof openDatabase>, playlistId: string) {
	const playlist = db
		.prepare('SELECT id, name, created_at, updated_at FROM playlists WHERE id = ?')
		.get(playlistId) as PlaylistDetailRow | undefined;

	if (!playlist) {
		return undefined;
	}

	const songs = db
		.prepare(
			`
				SELECT
					songs.id,
					songs.title,
					songs.artist,
					songs.album,
					songs.duration,
					songs.track_number,
					songs.disc_number,
					songs.year,
					songs.genre,
					songs.path,
					songs.file_size,
					songs.file_modified_at,
					songs.created_at,
					songs.updated_at
				FROM playlist_songs
				JOIN songs ON songs.id = playlist_songs.song_id
				WHERE playlist_songs.playlist_id = ?
				ORDER BY playlist_songs.order_index ASC
			`
		)
		.all(playlistId) as SongRow[];

	return {
		id: playlist.id,
		name: playlist.name,
		createdAt: playlist.created_at,
		updatedAt: playlist.updated_at,
		songs: songs.map(mapSong)
	};
}

function getPlaybackStateWithOpenDatabase(db: ReturnType<typeof openDatabase>) {
	const row = db
		.prepare(
			`
				SELECT
					queue_json,
					current_song_id,
					timestamp_seconds,
					volume,
					repeat_mode,
					shuffle_enabled,
					shuffle_state_json,
					updated_at
				FROM playback_state
				WHERE id = 1
			`
		)
		.get() as PlaybackStateRow | undefined;

	return normalizePlaybackState(row);
}

function openMigratedDatabase() {
	const db = openDatabase();
	migrateDatabase(db);
	return db;
}

function mapSong(song: SongRow) {
	return {
		id: song.id,
		title: song.title,
		artist: song.artist,
		album: song.album,
		duration: song.duration,
		trackNumber: song.track_number,
		discNumber: song.disc_number,
		year: song.year,
		genre: song.genre,
		path: song.path,
		fileSize: song.file_size,
		fileModifiedAt: song.file_modified_at,
		createdAt: song.created_at,
		updatedAt: song.updated_at
	};
}

function playlistExists(db: ReturnType<typeof openDatabase>, playlistId: string) {
	return Boolean(db.prepare('SELECT 1 FROM playlists WHERE id = ?').get(playlistId));
}

function songExists(db: ReturnType<typeof openDatabase>, songId: string) {
	return Boolean(db.prepare('SELECT 1 FROM songs WHERE id = ?').get(songId));
}

function currentSongIds(db: ReturnType<typeof openDatabase>, playlistId: string) {
	return (
		db
			.prepare('SELECT song_id FROM playlist_songs WHERE playlist_id = ? ORDER BY order_index ASC')
			.all(playlistId) as { song_id: string }[]
	).map((row) => row.song_id);
}

function reorderPersistedSongs(
	db: ReturnType<typeof openDatabase>,
	playlistId: string,
	songIds: string[]
) {
	const transaction = db.transaction(() => {
		db.prepare('DELETE FROM playlist_songs WHERE playlist_id = ?').run(playlistId);

		const insertSong = db.prepare(
			'INSERT INTO playlist_songs (playlist_id, song_id, order_index) VALUES (?, ?, ?)'
		);

		for (const [index, songId] of songIds.entries()) {
			insertSong.run(playlistId, songId, index);
		}

		db.prepare('UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(playlistId);
	});

	transaction();
}

function normalizePlaybackState(row: PlaybackStateRow | undefined) {
	const queueState = parseJson<QueueStateJson>(row?.queue_json, {});
	const shuffleState = parseJson<ShuffleStateJson>(row?.shuffle_state_json, {});

	return {
		queueIds: stringArray(queueState.queueIds),
		historyIds: stringArray(queueState.historyIds),
		currentSongId: row?.current_song_id ?? null,
		timestampSeconds: row?.timestamp_seconds ?? 0,
		volume: row?.volume ?? 0.9,
		repeatMode: row?.repeat_mode ?? 'off',
		shuffleEnabled: row?.shuffle_enabled === 1,
		shuffledQueueIds: stringArray(shuffleState.shuffledQueueIds),
		updatedAt: row?.updated_at ?? null
	};
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
	if (!value) {
		return fallback;
	}

	try {
		return JSON.parse(value) as T;
	} catch {
		return fallback;
	}
}

export function normalizeName(value: unknown) {
	const name = typeof value === 'string' ? value.trim() : '';
	return name.length > 0 ? name : undefined;
}

export function stringArray(value: unknown) {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === 'string')
		: [];
}

function finiteNumber(value: unknown, fallback: number) {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value));
}

function normalizeRepeatMode(value: unknown): RepeatMode {
	return value === 'playlist' || value === 'one' ? value : 'off';
}
