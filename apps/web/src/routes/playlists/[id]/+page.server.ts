import { migrateDatabase, openDatabase } from '@music/database';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

interface PlaylistRow {
	id: string;
	name: string;
	created_at: string;
	updated_at: string;
}

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

export const load: PageServerLoad = ({ params }) => {
	const db = openDatabase();

	try {
		migrateDatabase(db);

		const playlist = db
			.prepare('SELECT id, name, created_at, updated_at FROM playlists WHERE id = ?')
			.get(params.id) as PlaylistRow | undefined;

		if (!playlist) {
			error(404, 'Playlist not found.');
		}

		const playlistSongs = db
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
						songs.created_at,
						songs.updated_at
					FROM playlist_songs
					JOIN songs ON songs.id = playlist_songs.song_id
					WHERE playlist_songs.playlist_id = ?
					ORDER BY playlist_songs.order_index ASC
				`
			)
			.all(params.id) as SongRow[];

		const availableSongs = db
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
						songs.created_at,
						songs.updated_at
					FROM songs
					WHERE songs.id NOT IN (
						SELECT song_id FROM playlist_songs WHERE playlist_id = ?
					)
					ORDER BY songs.artist COLLATE NOCASE ASC, songs.album COLLATE NOCASE ASC, songs.track_number ASC, songs.title COLLATE NOCASE ASC
				`
			)
			.all(params.id) as SongRow[];

		return {
			playlist: {
				id: playlist.id,
				name: playlist.name,
				createdAt: playlist.created_at,
				updatedAt: playlist.updated_at,
				songs: playlistSongs.map(mapSong)
			},
			availableSongs: availableSongs.map(mapSong)
		};
	} finally {
		db.close();
	}
};

export const actions = {
	renamePlaylist: async ({ params, request }) => {
		const formData = await request.formData();
		const name = normalizeName(formData.get('name'));

		if (!name) {
			return fail(400, { message: 'Playlist name is required.', name });
		}

		const db = openDatabase();

		try {
			migrateDatabase(db);
			db.prepare('UPDATE playlists SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
				name,
				params.id
			);
		} finally {
			db.close();
		}

		redirect(303, `/playlists/${params.id}`);
	},

	deletePlaylist: async ({ params }) => {
		const db = openDatabase();

		try {
			migrateDatabase(db);
			db.prepare('DELETE FROM playlists WHERE id = ?').run(params.id);
		} finally {
			db.close();
		}

		redirect(303, '/playlists');
	},

	addSong: async ({ params, request }) => {
		const formData = await request.formData();
		const songId = String(formData.get('songId') ?? '');

		if (!songId) {
			return fail(400, { message: 'Choose a song to add.' });
		}

		const db = openDatabase();

		try {
			migrateDatabase(db);
			const nextOrder = (
				db
					.prepare(
						'SELECT COALESCE(MAX(order_index), -1) + 1 AS next_order FROM playlist_songs WHERE playlist_id = ?'
					)
					.get(params.id) as { next_order: number }
			).next_order;

			db.prepare(
				`
					INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, order_index)
					VALUES (?, ?, ?)
				`
			).run(params.id, songId, nextOrder);
			db.prepare('UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(params.id);
		} finally {
			db.close();
		}

		redirect(303, `/playlists/${params.id}`);
	},

	removeSong: async ({ params, request }) => {
		const formData = await request.formData();
		const songId = String(formData.get('songId') ?? '');

		if (!songId) {
			return fail(400, { message: 'Song is required.' });
		}

		const db = openDatabase();

		try {
			migrateDatabase(db);
			db.prepare('DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?').run(
				params.id,
				songId
			);
			reorderPersistedSongs(db, params.id, currentSongIds(db, params.id));
		} finally {
			db.close();
		}

		redirect(303, `/playlists/${params.id}`);
	},

	reorderSongs: async ({ params, request }) => {
		const formData = await request.formData();
		const orderJson = String(formData.get('orderJson') ?? '[]');
		const songIds = parseSongIds(orderJson);

		const db = openDatabase();

		try {
			migrateDatabase(db);
			const existingIds = new Set(currentSongIds(db, params.id));
			const normalizedIds = songIds.filter((songId) => existingIds.has(songId));

			if (normalizedIds.length !== existingIds.size) {
				return fail(400, { message: 'Playlist order did not include every song.' });
			}

			reorderPersistedSongs(db, params.id, normalizedIds);
		} finally {
			db.close();
		}

		redirect(303, `/playlists/${params.id}`);
	}
} satisfies Actions;

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
		createdAt: song.created_at,
		updatedAt: song.updated_at
	};
}

function normalizeName(value: FormDataEntryValue | null) {
	const name = String(value ?? '').trim();
	return name.length > 0 ? name : undefined;
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

function parseSongIds(value: string) {
	try {
		const parsed = JSON.parse(value) as unknown;
		return Array.isArray(parsed)
			? parsed.filter((item): item is string => typeof item === 'string')
			: [];
	} catch {
		return [];
	}
}
