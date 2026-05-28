export interface Song {
	id: string;
	title: string;
	artist: string;
	album: string;
	duration: number | null;
	trackNumber: number | null;
	discNumber: number | null;
	year: number | null;
	genre: string | null;
	path: string;
	fileSize: number | null;
	fileModifiedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface Playlist {
	id: string;
	name: string;
	songCount?: number;
	songs?: Song[];
	createdAt: string;
	updatedAt: string;
}

export interface QueueState {
	queueIds: string[];
	historyIds: string[];
	currentSongId: string | null;
	timestampSeconds: number;
	volume: number;
	repeatMode: 'off' | 'playlist' | 'one';
	shuffleEnabled: boolean;
	shuffledQueueIds: string[];
	updatedAt: string | null;
}

export interface MobileSession {
	serverUrl: string;
	token: string;
	user: {
		id?: string;
		email?: string | null;
		name?: string | null;
		image?: string | null;
	};
}
