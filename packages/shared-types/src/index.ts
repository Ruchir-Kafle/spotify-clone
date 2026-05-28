export type RepeatMode = 'off' | 'playlist' | 'one';

export interface Song {
	id: string;
	path: string;
	title: string;
	artist: string;
	album: string;
	duration: number | null;
	trackNumber: number | null;
	discNumber: number | null;
	year: number | null;
	genre: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface Playlist {
	id: string;
	name: string;
	createdAt: string;
	updatedAt: string;
}

export interface PlaybackState {
	queue: string[];
	currentSongId: string | null;
	timestampSeconds: number;
	volume: number;
	repeatMode: RepeatMode;
	shuffleEnabled: boolean;
	shuffleState: unknown;
	updatedAt: string;
}
