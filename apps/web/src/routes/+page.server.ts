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
			}))
		};
	} finally {
		db.close();
	}
}
