import { migrateDatabase, openDatabase } from '@music/database';
import { fail, redirect } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import type { Actions } from './$types';

interface PlaylistRow {
	id: string;
	name: string;
	song_count: number;
	created_at: string;
	updated_at: string;
}

export function load() {
	const db = openDatabase();

	try {
		migrateDatabase(db);

		const playlists = db
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
			.all() as PlaylistRow[];

		return {
			playlists: playlists.map((playlist) => ({
				id: playlist.id,
				name: playlist.name,
				songCount: playlist.song_count,
				createdAt: playlist.created_at,
				updatedAt: playlist.updated_at
			}))
		};
	} finally {
		db.close();
	}
}

export const actions = {
	createPlaylist: async ({ request }) => {
		const formData = await request.formData();
		const name = normalizeName(formData.get('name'));

		if (!name) {
			return fail(400, { message: 'Playlist name is required.', name });
		}

		const id = randomUUID();
		const db = openDatabase();

		try {
			migrateDatabase(db);
			db.prepare('INSERT INTO playlists (id, name) VALUES (?, ?)').run(id, name);
		} finally {
			db.close();
		}

		redirect(303, `/playlists/${id}`);
	},

	renamePlaylist: async ({ request }) => {
		const formData = await request.formData();
		const playlistId = String(formData.get('playlistId') ?? '');
		const name = normalizeName(formData.get('name'));

		if (!playlistId || !name) {
			return fail(400, { message: 'Playlist and name are required.', name });
		}

		const db = openDatabase();

		try {
			migrateDatabase(db);
			db.prepare('UPDATE playlists SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
				name,
				playlistId
			);
		} finally {
			db.close();
		}

		redirect(303, '/playlists');
	},

	deletePlaylist: async ({ request }) => {
		const formData = await request.formData();
		const playlistId = String(formData.get('playlistId') ?? '');

		if (!playlistId) {
			return fail(400, { message: 'Playlist is required.' });
		}

		const db = openDatabase();

		try {
			migrateDatabase(db);
			db.prepare('DELETE FROM playlists WHERE id = ?').run(playlistId);
		} finally {
			db.close();
		}

		redirect(303, '/playlists');
	}
} satisfies Actions;

function normalizeName(value: FormDataEntryValue | null) {
	const name = String(value ?? '').trim();
	return name.length > 0 ? name : undefined;
}
