import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';

export interface DatabaseConfig {
	path?: string;
	migrationsDir?: string;
}

export type MusicDatabase = Database.Database;

export function findWorkspaceRoot(startDir = process.cwd()) {
	let currentDir = startDir;
	const { root } = parse(startDir);

	while (currentDir !== root) {
		if (existsSync(join(currentDir, 'pnpm-workspace.yaml'))) {
			return currentDir;
		}

		currentDir = dirname(currentDir);
	}

	return startDir;
}

export function defaultDatabasePath(cwd = process.cwd()) {
	return join(findWorkspaceRoot(cwd), 'database', 'app.db');
}

export function defaultMigrationsDir(cwd = process.cwd()) {
	return join(findWorkspaceRoot(cwd), 'database', 'migrations');
}

export function openDatabase(config: DatabaseConfig = {}): MusicDatabase {
	const databasePath = config.path ?? defaultDatabasePath();
	mkdirSync(dirname(databasePath), { recursive: true });

	const db = new Database(databasePath);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');

	return db;
}

export function migrateDatabase(db: MusicDatabase, migrationsDir = defaultMigrationsDir()) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		);
	`);

	const applied = new Set(
		db
			.prepare('SELECT version FROM schema_migrations')
			.all()
			.map((row) => (row as { version: string }).version)
	);

	const migrations = readdirSync(migrationsDir)
		.filter((file) => file.endsWith('.sql'))
		.sort();

	const applyMigration = db.transaction((version: string, sql: string) => {
		db.exec(sql);
		db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(version);
	});

	for (const migration of migrations) {
		if (applied.has(migration)) {
			continue;
		}

		applyMigration(migration, readFileSync(join(migrationsDir, migration), 'utf8'));
	}
}
