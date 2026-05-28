import { migrateDatabase, openDatabase } from '@music/database';
import {
	addMusicDirectory,
	listMusicDirectories,
	removeMusicDirectory,
	scanLibrary,
	watchLibrary
} from './index.js';
import { isAbsolute, resolve } from 'node:path';

const [, , command, ...args] = process.argv;

const db = openDatabase();
migrateDatabase(db);

try {
	switch (command) {
		case 'add-dir': {
			const path = resolveUserPath(requirePathArgument(args[0], 'add-dir'));
			const directory = await addMusicDirectory(db, path);
			console.log(`Added music directory: ${directory?.path}`);
			break;
		}

		case 'list-dirs': {
			const directories = listMusicDirectories(db);

			if (directories.length === 0) {
				console.log('No music directories configured.');
				break;
			}

			for (const directory of directories) {
				console.log(directory.path);
			}

			break;
		}

		case 'remove-dir': {
			const path = resolveUserPath(requirePathArgument(args[0], 'remove-dir'));
			const changes = await removeMusicDirectory(db, path);
			console.log(
				changes > 0 ? `Removed music directory: ${path}` : `Directory was not configured: ${path}`
			);
			break;
		}

		case 'scan': {
			const result = await scanLibrary({
				db,
				path: args[0] ? resolveUserPath(args[0]) : undefined
			});
			console.log(
				`Scan complete. Files: ${result.scannedFiles}, indexed: ${result.indexedSongs}, removed: ${result.removedSongs}, failed: ${result.failedFiles.length}`
			);

			for (const failedFile of result.failedFiles) {
				console.error(`Failed: ${failedFile.path} - ${failedFile.error}`);
			}

			process.exitCode = result.failedFiles.length > 0 ? 1 : 0;
			break;
		}

		case 'watch': {
			const watcher = await watchLibrary({
				db,
				path: args[0] ? resolveUserPath(args[0]) : undefined
			});
			console.log(
				`Watching ${watcher.directories.length} music director${watcher.directories.length === 1 ? 'y' : 'ies'}:`
			);

			for (const directory of watcher.directories) {
				console.log(`- ${directory}`);
			}

			const shutdown = async () => {
				await watcher.close();
				process.exit(0);
			};

			process.once('SIGINT', () => void shutdown());
			process.once('SIGTERM', () => void shutdown());
			break;
		}

		default:
			printUsage();
			process.exitCode = command ? 1 : 0;
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
} finally {
	if (command !== 'watch') {
		db.close();
	}
}

function requirePathArgument(path: string | undefined, commandName: string) {
	if (!path) {
		throw new Error(
			`Missing path. Usage: pnpm library:${commandName === 'add-dir' ? 'add' : 'remove'} <path>`
		);
	}

	return path;
}

function resolveUserPath(path: string) {
	return isAbsolute(path) ? path : resolve(process.env.INIT_CWD ?? process.cwd(), path);
}

function printUsage() {
	console.log(`Usage:
  pnpm library:add <path>
  pnpm library:list
  pnpm library:remove <path>
  pnpm scan [path]
  pnpm scan:watch [path]`);
}
