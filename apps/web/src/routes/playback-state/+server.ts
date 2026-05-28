import { migrateDatabase, openDatabase } from '@music/database';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type RepeatMode = 'off' | 'playlist' | 'one';

interface PlaybackStatePayload {
	queueIds?: unknown;
	historyIds?: unknown;
	currentSongId?: unknown;
	timestampSeconds?: unknown;
	volume?: unknown;
	repeatMode?: unknown;
	shuffleEnabled?: unknown;
	shuffledQueueIds?: unknown;
}

export const POST: RequestHandler = async ({ request }) => {
	const payload = (await request.json()) as PlaybackStatePayload;
	const queueIds = stringArray(payload.queueIds);
	const historyIds = stringArray(payload.historyIds);
	const currentSongId = typeof payload.currentSongId === 'string' ? payload.currentSongId : null;
	const timestampSeconds = finiteNumber(payload.timestampSeconds, 0);
	const volume = clamp(finiteNumber(payload.volume, 0.9), 0, 1);
	const repeatMode = normalizeRepeatMode(payload.repeatMode);
	const shuffleEnabled = payload.shuffleEnabled === true;
	const shuffledQueueIds = stringArray(payload.shuffledQueueIds);

	const db = openDatabase();

	try {
		migrateDatabase(db);
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

		return json({ ok: true });
	} finally {
		db.close();
	}
};

function stringArray(value: unknown) {
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
