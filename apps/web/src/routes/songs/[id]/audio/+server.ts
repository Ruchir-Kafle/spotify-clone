import { migrateDatabase, openDatabase } from '@music/database';
import { error } from '@sveltejs/kit';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { extname, relative, sep } from 'node:path';
import { Readable } from 'node:stream';
import type { RequestHandler } from './$types';

interface SongPathRow {
	path: string;
}

interface MusicDirectoryPathRow {
	path: string;
}

const CONTENT_TYPES = new Map([
	['.mp3', 'audio/mpeg'],
	['.flac', 'audio/flac'],
	['.wav', 'audio/wav'],
	['.m4a', 'audio/mp4'],
	['.ogg', 'audio/ogg']
]);

export const GET: RequestHandler = async ({ params, request }) => {
	const db = openDatabase();

	try {
		migrateDatabase(db);

		const song = db.prepare('SELECT path FROM songs WHERE id = ?').get(params.id) as
			| SongPathRow
			| undefined;

		if (!song) {
			error(404, 'Song not found.');
		}

		const directories = db
			.prepare('SELECT path FROM music_directories')
			.all() as MusicDirectoryPathRow[];
		const songPath = await realpathIfExists(song.path);

		if (!songPath) {
			error(404, 'Song file not found.');
		}

		const allowedDirectories = (
			await Promise.all(directories.map((directory) => realpathIfExists(directory.path)))
		).filter((path) => path !== undefined);

		if (!allowedDirectories.some((directory) => isPathInsideDirectory(songPath, directory))) {
			error(403, 'Song is outside configured music directories.');
		}

		const fileStat = await stat(songPath);

		if (!fileStat.isFile()) {
			error(404, 'Song file not found.');
		}

		const range = request.headers.get('range');
		const contentType =
			CONTENT_TYPES.get(extname(songPath).toLowerCase()) ?? 'application/octet-stream';

		if (!range) {
			return new Response(Readable.toWeb(createReadStream(songPath)) as ReadableStream, {
				headers: {
					'Accept-Ranges': 'bytes',
					'Content-Length': String(fileStat.size),
					'Content-Type': contentType
				}
			});
		}

		const parsedRange = parseRange(range, fileStat.size);

		if (!parsedRange) {
			return new Response(null, {
				status: 416,
				headers: {
					'Content-Range': `bytes */${fileStat.size}`
				}
			});
		}

		const { start, end } = parsedRange;
		const chunkSize = end - start + 1;

		return new Response(
			Readable.toWeb(createReadStream(songPath, { start, end })) as ReadableStream,
			{
				status: 206,
				headers: {
					'Accept-Ranges': 'bytes',
					'Content-Length': String(chunkSize),
					'Content-Range': `bytes ${start}-${end}/${fileStat.size}`,
					'Content-Type': contentType
				}
			}
		);
	} finally {
		db.close();
	}
};

function isPathInsideDirectory(path: string, directory: string) {
	const relativePath = relative(directory, path);
	return relativePath.length > 0 && !relativePath.startsWith('..') && !relativePath.startsWith(sep);
}

async function realpathIfExists(path: string) {
	try {
		return await realpath(path);
	} catch {
		return undefined;
	}
}

function parseRange(range: string, fileSize: number) {
	const match = /^bytes=(\d*)-(\d*)$/.exec(range);

	if (!match) {
		return undefined;
	}

	const [, rawStart, rawEnd] = match;

	if (!rawStart && !rawEnd) {
		return undefined;
	}

	let start = rawStart ? Number(rawStart) : fileSize - Number(rawEnd);
	let end = rawEnd ? Number(rawEnd) : fileSize - 1;

	if (!Number.isInteger(start) || !Number.isInteger(end)) {
		return undefined;
	}

	start = Math.max(0, start);
	end = Math.min(fileSize - 1, end);

	if (start > end || start >= fileSize) {
		return undefined;
	}

	return { start, end };
}
