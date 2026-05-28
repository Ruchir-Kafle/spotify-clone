import type { MusicDatabase } from '@music/database';
import { migrateDatabase, openDatabase } from '@music/database';
import chokidar from 'chokidar';
import { parseFile } from 'music-metadata';
import { createHash, randomUUID } from 'node:crypto';
import { opendir, realpath, stat } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';

const SUPPORTED_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.m4a', '.ogg']);
const WATCH_DEBOUNCE_MS = 300;

export interface ScanOptions {
	db?: MusicDatabase;
	path?: string;
	removeMissing?: boolean;
}

export interface ScanResult {
	scannedFiles: number;
	indexedSongs: number;
	removedSongs: number;
	failedFiles: Array<{ path: string; error: string }>;
}

export interface MusicDirectoryRow {
	id: string;
	path: string;
	created_at: string;
	updated_at: string;
}

interface SongFileMetadata {
	path: string;
	title: string;
	artist: string;
	album: string;
	duration: number | null;
	trackNumber: number | null;
	discNumber: number | null;
	year: number | null;
	genre: string | null;
	fileSize: number;
	fileModifiedAt: string;
}

export function isSupportedAudioFile(path: string) {
	return SUPPORTED_EXTENSIONS.has(extname(path).toLowerCase());
}

export function supportedAudioExtensions() {
	return [...SUPPORTED_EXTENSIONS];
}

export async function normalizeDirectoryPath(path: string) {
	return await realpath(resolve(path));
}

export async function addMusicDirectory(db: MusicDatabase, directoryPath: string) {
	const normalizedPath = await normalizeDirectoryPath(directoryPath);
	const directoryStat = await stat(normalizedPath);

	if (!directoryStat.isDirectory()) {
		throw new Error(`${normalizedPath} is not a directory`);
	}

	const id = createStableId(normalizedPath);

	db.prepare(
		`
			INSERT INTO music_directories (id, path)
			VALUES (@id, @path)
			ON CONFLICT(path) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
		`
	).run({ id, path: normalizedPath });

	return getMusicDirectory(db, normalizedPath);
}

export function listMusicDirectories(db: MusicDatabase) {
	return db
		.prepare('SELECT id, path, created_at, updated_at FROM music_directories ORDER BY path ASC')
		.all() as MusicDirectoryRow[];
}

export function getMusicDirectory(db: MusicDatabase, directoryPath: string) {
	return db
		.prepare('SELECT id, path, created_at, updated_at FROM music_directories WHERE path = ?')
		.get(directoryPath) as MusicDirectoryRow | undefined;
}

export async function removeMusicDirectory(db: MusicDatabase, directoryPath: string) {
	const normalizedPath = await normalizeDirectoryPath(directoryPath);
	const result = db.prepare('DELETE FROM music_directories WHERE path = ?').run(normalizedPath);
	return result.changes;
}

export async function scanLibrary(options: ScanOptions = {}): Promise<ScanResult> {
	const db = options.db ?? openDatabase();
	const ownsDatabase = !options.db;

	try {
		migrateDatabase(db);
		const directories = options.path
			? [{ path: await normalizeDirectoryPath(options.path) }]
			: listMusicDirectories(db);

		if (directories.length === 0) {
			throw new Error('No music directories configured. Add one with: pnpm library:add <path>');
		}

		const result: ScanResult = {
			scannedFiles: 0,
			indexedSongs: 0,
			removedSongs: 0,
			failedFiles: []
		};

		for (const directory of directories) {
			const seenPaths = new Set<string>();

			for await (const filePath of walkAudioFiles(directory.path)) {
				result.scannedFiles += 1;
				seenPaths.add(filePath);

				try {
					await indexAudioFile(db, filePath);
					result.indexedSongs += 1;
				} catch (error) {
					result.failedFiles.push({ path: filePath, error: errorMessage(error) });
				}
			}

			if (options.removeMissing ?? true) {
				result.removedSongs += removeMissingSongs(db, directory.path, seenPaths);
			}
		}

		return result;
	} finally {
		if (ownsDatabase) {
			db.close();
		}
	}
}

export async function watchLibrary(options: ScanOptions = {}) {
	const db = options.db ?? openDatabase();
	migrateDatabase(db);

	const directories = options.path
		? [{ path: await normalizeDirectoryPath(options.path) }]
		: listMusicDirectories(db);

	if (directories.length === 0) {
		throw new Error('No music directories configured. Add one with: pnpm library:add <path>');
	}

	const watcher = chokidar.watch(
		directories.map((directory) => directory.path),
		{
			ignoreInitial: true,
			persistent: true,
			awaitWriteFinish: {
				stabilityThreshold: 1200,
				pollInterval: 100
			}
		}
	);

	const pending = new Map<string, NodeJS.Timeout>();

	const scheduleIndex = (filePath: string) => {
		if (!isSupportedAudioFile(filePath)) {
			return;
		}

		clearTimeout(pending.get(filePath));
		pending.set(
			filePath,
			setTimeout(() => {
				pending.delete(filePath);
				void indexAudioFile(db, filePath).catch((error) => {
					console.error(`Failed to index ${filePath}: ${errorMessage(error)}`);
				});
			}, WATCH_DEBOUNCE_MS)
		);
	};

	const removeFile = (filePath: string) => {
		if (!isSupportedAudioFile(filePath)) {
			return;
		}

		clearTimeout(pending.get(filePath));
		pending.delete(filePath);
		db.prepare('DELETE FROM songs WHERE path = ?').run(filePath);
	};

	watcher.on('add', scheduleIndex);
	watcher.on('change', scheduleIndex);
	watcher.on('unlink', removeFile);

	return {
		directories: directories.map((directory) => directory.path),
		close: async () => {
			for (const timeout of pending.values()) {
				clearTimeout(timeout);
			}

			await watcher.close();

			if (!options.db) {
				db.close();
			}
		}
	};
}

export async function indexAudioFile(db: MusicDatabase, filePath: string) {
	const normalizedPath = await realpath(resolve(filePath));

	if (!isSupportedAudioFile(normalizedPath)) {
		return;
	}

	const metadata = await readSongFileMetadata(normalizedPath);
	upsertSong(db, metadata);
}

async function* walkAudioFiles(directoryPath: string): AsyncGenerator<string> {
	const directory = await opendir(directoryPath);

	for await (const entry of directory) {
		const entryPath = join(directoryPath, entry.name);

		if (entry.isDirectory()) {
			yield* walkAudioFiles(entryPath);
			continue;
		}

		if (entry.isFile() && isSupportedAudioFile(entryPath)) {
			yield await realpath(entryPath);
		}
	}
}

async function readSongFileMetadata(filePath: string): Promise<SongFileMetadata> {
	const [metadata, fileStat] = await Promise.all([
		parseFile(filePath, { duration: true }),
		stat(filePath)
	]);

	const title = firstText(metadata.common.title) ?? basename(filePath, extname(filePath));
	const artist =
		firstText(metadata.common.artist) ??
		firstText(metadata.common.artists?.[0]) ??
		'Unknown Artist';
	const album = firstText(metadata.common.album) ?? 'Unknown Album';

	return {
		path: filePath,
		title,
		artist,
		album,
		duration: finiteNumber(metadata.format.duration),
		trackNumber: finiteNumber(metadata.common.track.no),
		discNumber: finiteNumber(metadata.common.disk.no),
		year: finiteNumber(metadata.common.year),
		genre: firstText(metadata.common.genre?.[0]) ?? null,
		fileSize: fileStat.size,
		fileModifiedAt: fileStat.mtime.toISOString()
	};
}

function upsertSong(db: MusicDatabase, metadata: SongFileMetadata) {
	const existing = db.prepare('SELECT id FROM songs WHERE path = ?').get(metadata.path) as
		| { id: string }
		| undefined;

	db.prepare(
		`
			INSERT INTO songs (
				id,
				path,
				title,
				artist,
				album,
				duration,
				track_number,
				disc_number,
				year,
				genre,
				file_size,
				file_modified_at,
				updated_at
			)
			VALUES (
				@id,
				@path,
				@title,
				@artist,
				@album,
				@duration,
				@trackNumber,
				@discNumber,
				@year,
				@genre,
				@fileSize,
				@fileModifiedAt,
				CURRENT_TIMESTAMP
			)
			ON CONFLICT(path) DO UPDATE SET
				title = excluded.title,
				artist = excluded.artist,
				album = excluded.album,
				duration = excluded.duration,
				track_number = excluded.track_number,
				disc_number = excluded.disc_number,
				year = excluded.year,
				genre = excluded.genre,
				file_size = excluded.file_size,
				file_modified_at = excluded.file_modified_at,
				updated_at = CURRENT_TIMESTAMP
		`
	).run({
		...metadata,
		id: existing?.id ?? randomUUID()
	});
}

function removeMissingSongs(db: MusicDatabase, directoryPath: string, seenPaths: Set<string>) {
	const rows = db
		.prepare("SELECT path FROM songs WHERE path LIKE ? ESCAPE '\\'")
		.all(`${escapeLike(directoryPath)}/%`) as {
		path: string;
	}[];

	let removed = 0;

	const removeSong = db.prepare('DELETE FROM songs WHERE path = ?');

	for (const row of rows) {
		if (!seenPaths.has(row.path)) {
			removed += removeSong.run(row.path).changes;
		}
	}

	return removed;
}

function createStableId(value: string) {
	return createHash('sha256').update(value).digest('hex');
}

function firstText(value: unknown) {
	if (typeof value !== 'string') {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function finiteNumber(value: unknown) {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function escapeLike(value: string) {
	return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}
