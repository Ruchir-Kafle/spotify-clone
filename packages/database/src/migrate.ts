import { migrateDatabase, openDatabase } from './index.js';

const db = openDatabase();

try {
	migrateDatabase(db);
	console.log('Database migrations applied.');
} finally {
	db.close();
}
