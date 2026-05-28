import { findWorkspaceRoot, migrateDatabase, openDatabase } from '@music/database';
import { scanLibrary } from '@music/scanner';
import { fail, redirect } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import { realpath, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Actions } from './$types';

interface MusicDirectoryRow {
	id: string;
	path: string;
	created_at: string;
	updated_at: string;
}

export function load() {
	const db = openDatabase();

	try {
		migrateDatabase(db);

		const directories = db
			.prepare(
				`
					SELECT id, path, created_at, updated_at
					FROM music_directories
					ORDER BY path COLLATE NOCASE ASC
				`
			)
			.all() as MusicDirectoryRow[];

		return {
			directories: directories.map((directory) => ({
				id: directory.id,
				path: directory.path,
				createdAt: directory.created_at,
				updatedAt: directory.updated_at
			}))
		};
	} finally {
		db.close();
	}
}

export const actions = {
	addDirectory: async ({ request }) => {
		const formData = await request.formData();
		const path = String(formData.get('path') ?? '').trim();

		if (!path) {
			return fail(400, { message: 'Choose a folder path first.', path });
		}

		const db = openDatabase();

		try {
			migrateDatabase(db);

			const normalizedPath = await normalizeDirectoryPath(path);
			const id = createStableId(normalizedPath);

			db.prepare(
				`
					INSERT INTO music_directories (id, path)
					VALUES (@id, @path)
					ON CONFLICT(path) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
				`
			).run({ id, path: normalizedPath });

			await scanLibrary({ db, path: normalizedPath });
		} catch (error) {
			return fail(400, {
				message: error instanceof Error ? error.message : 'Could not save that folder.',
				path
			});
		} finally {
			db.close();
		}

		redirect(303, '/settings');
	},

	removeDirectory: async ({ request }) => {
		const formData = await request.formData();
		const path = String(formData.get('path') ?? '').trim();

		if (!path) {
			return fail(400, { message: 'Missing folder path.' });
		}

		const db = openDatabase();

		try {
			migrateDatabase(db);
			db.prepare('DELETE FROM music_directories WHERE path = ?').run(path);
		} finally {
			db.close();
		}

		redirect(303, '/settings');
	},

	scanDirectories: async () => {
		const db = openDatabase();

		try {
			migrateDatabase(db);
			await scanLibrary({ db });
		} catch (error) {
			return fail(400, {
				message: error instanceof Error ? error.message : 'Could not scan configured folders.'
			});
		} finally {
			db.close();
		}

		redirect(303, '/settings');
	}
} satisfies Actions;

async function normalizeDirectoryPath(path: string) {
	const normalizedPath = await realpath(resolve(findWorkspaceRoot(), path));
	const pathStat = await stat(normalizedPath);

	if (!pathStat.isDirectory()) {
		throw new Error(`${normalizedPath} is not a directory.`);
	}

	return normalizedPath;
}

function createStableId(value: string) {
	return createHash('sha256').update(value).digest('hex');
}
