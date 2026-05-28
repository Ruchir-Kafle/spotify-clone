import { migrateDatabase, openDatabase } from '@music/database';

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
	created_at: string;
	updated_at: string;
}

interface PlaybackStateRow {
	queue_json: string;
	current_song_id: string | null;
	timestamp_seconds: number;
	volume: number;
	repeat_mode: 'off' | 'playlist' | 'one';
	shuffle_enabled: 0 | 1;
	shuffle_state_json: string | null;
}

interface QueueStateJson {
	queueIds?: unknown;
	historyIds?: unknown;
}

interface ShuffleStateJson {
	shuffledQueueIds?: unknown;
}

export function load() {
	const db = openDatabase();

	try {
		migrateDatabase(db);

		const songs = db
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
						created_at,
						updated_at
					FROM songs
					ORDER BY artist COLLATE NOCASE ASC, album COLLATE NOCASE ASC, track_number ASC, title COLLATE NOCASE ASC
				`
			)
			.all() as SongRow[];
		const playbackState = db
			.prepare(
				`
					SELECT
						queue_json,
						current_song_id,
						timestamp_seconds,
						volume,
						repeat_mode,
						shuffle_enabled,
						shuffle_state_json
					FROM playback_state
					WHERE id = 1
				`
			)
			.get() as PlaybackStateRow | undefined;

		return {
			songs: songs.map((song) => ({
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
				createdAt: song.created_at,
				updatedAt: song.updated_at
			})),
			playbackState: normalizePlaybackState(playbackState)
		};
	} finally {
		db.close();
	}
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
		shuffledQueueIds: stringArray(shuffleState.shuffledQueueIds)
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

function stringArray(value: unknown) {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === 'string')
		: [];
}
