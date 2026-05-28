import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	FlatList,
	Pressable,
	RefreshControl,
	SafeAreaView,
	StyleSheet,
	Text,
	View
} from 'react-native';
import TrackPlayer, {
	AppKilledPlaybackBehavior,
	Capability,
	Event,
	State,
	usePlaybackState,
	useProgress
} from 'react-native-track-player';
import { LoginScreen } from './src/components/LoginScreen';
import {
	audioUrl,
	fetchPlaylist,
	fetchPlaylists,
	fetchQueue,
	fetchSongs,
	updateQueue
} from './src/services/api';
import {
	clearStoredSession,
	loadStoredSession,
	saveStoredSession
} from './src/services/sessionStorage';
import type { MobileSession, Playlist, Song } from './src/types/api';

type Tab = 'library' | 'playlists';

export default function App() {
	const [session, setSession] = useState<MobileSession | undefined>();
	const [songs, setSongs] = useState<Song[]>([]);
	const [playlists, setPlaylists] = useState<Playlist[]>([]);
	const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | undefined>();
	const [tab, setTab] = useState<Tab>('library');
	const [currentSong, setCurrentSong] = useState<Song | undefined>();
	const [recentSongs, setRecentSongs] = useState<Song[]>([]);
	const [resumeSeconds, setResumeSeconds] = useState(0);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | undefined>();
	const playbackState = usePlaybackState();
	const progress = useProgress(500);

	useEffect(() => {
		void setupPlayer();
		void loadStoredSession().then((storedSession) => {
			setSession(storedSession);
			setLoading(false);
		});
	}, []);

	const refresh = useCallback(
		async (activeSession = session) => {
			if (!activeSession) {
				return;
			}

			setRefreshing(true);
			setError(undefined);

			try {
				const [nextSongs, nextPlaylists, queue] = await Promise.all([
					fetchSongs(activeSession),
					fetchPlaylists(activeSession),
					fetchQueue(activeSession)
				]);

				setSongs(nextSongs);
				setPlaylists(nextPlaylists);
				setCurrentSong(nextSongs.find((song) => song.id === queue.currentSongId));
				setResumeSeconds(queue.timestampSeconds);
				setRecentSongs(
					queue.historyIds
						.slice(-8)
						.reverse()
						.map((songId) => nextSongs.find((song) => song.id === songId))
						.filter((song): song is Song => Boolean(song))
				);
			} catch (requestError) {
				setError(
					requestError instanceof Error ? requestError.message : 'Unable to refresh library.'
				);
			} finally {
				setRefreshing(false);
			}
		},
		[session]
	);

	useEffect(() => {
		if (session) {
			void refresh(session);
		}
	}, [refresh, session]);

	useEffect(() => {
		if (!session || songs.length === 0) {
			return;
		}

		const subscriptions = [
			TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, (event) => {
				const songId = typeof event.track?.id === 'string' ? event.track.id : undefined;
				const nextSong = songId ? songs.find((song) => song.id === songId) : undefined;

				if (nextSong) {
					setCurrentSong(nextSong);
				}

				void persistNativeQueue(
					session,
					songs,
					event.index ?? 0,
					event.lastTrack?.id,
					event.lastPosition
				);
			}),
			TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (event) => {
				void persistNativeQueue(session, songs, undefined, undefined, event.position);
			})
		];

		return () => {
			for (const subscription of subscriptions) {
				subscription.remove();
			}
		};
	}, [session, songs]);

	const isPlaying = useMemo(() => playbackState.state === State.Playing, [playbackState.state]);

	if (loading) {
		return (
			<SafeAreaView style={styles.centered}>
				<ActivityIndicator color="#34d399" />
			</SafeAreaView>
		);
	}

	if (!session) {
		return (
			<LoginScreen
				onLogin={(nextSession) => {
					setSession(nextSession);
					void saveStoredSession(nextSession);
				}}
			/>
		);
	}

	const visibleSongs = selectedPlaylist?.songs ?? songs;

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.header}>
				<View>
					<Text style={styles.eyebrow}>{session.user.email ?? 'Signed in'}</Text>
					<Text style={styles.title}>Music Server</Text>
				</View>
				<Pressable
					style={styles.signOutButton}
					onPress={() => {
						setSession(undefined);
						setSongs([]);
						setPlaylists([]);
						setCurrentSong(undefined);
						void clearStoredSession();
						void TrackPlayer.reset();
					}}
				>
					<Text style={styles.signOutText}>Sign out</Text>
				</Pressable>
			</View>

			<View style={styles.tabs}>
				<TabButton active={tab === 'library'} label="Library" onPress={() => setTab('library')} />
				<TabButton
					active={tab === 'playlists'}
					label="Playlists"
					onPress={() => setTab('playlists')}
				/>
			</View>

			{error ? <Text style={styles.error}>{error}</Text> : null}

			{tab === 'library' ? (
				<FlatList
					data={visibleSongs}
					keyExtractor={(song) => song.id}
					refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
					contentContainerStyle={styles.listContent}
					renderItem={({ item, index }) => (
						<SongRow
							song={item}
							onPress={() => playSongs(session, visibleSongs, index, setCurrentSong)}
						/>
					)}
					ListFooterComponent={
						recentSongs.length > 0 ? (
							<View style={styles.recentSection}>
								<Text style={styles.sectionTitle}>Recent history</Text>
								{recentSongs.map((song, index) => (
									<SongRow
										key={song.id}
										song={song}
										onPress={() => playSongs(session, recentSongs, index, setCurrentSong)}
									/>
								))}
							</View>
						) : null
					}
					ListHeaderComponent={
						selectedPlaylist ? (
							<Pressable style={styles.backRow} onPress={() => setSelectedPlaylist(undefined)}>
								<Text style={styles.backText}>All songs</Text>
							</Pressable>
						) : currentSong ? (
							<ContinueListening
								song={currentSong}
								position={resumeSeconds}
								onPress={() => {
									const index = songs.findIndex((song) => song.id === currentSong.id);

									if (index >= 0) {
										void playSongs(session, songs, index, setCurrentSong, resumeSeconds);
									}
								}}
							/>
						) : null
					}
				/>
			) : (
				<FlatList
					data={playlists}
					keyExtractor={(playlist) => playlist.id}
					refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
					contentContainerStyle={styles.listContent}
					renderItem={({ item }) => (
						<PlaylistRow
							playlist={item}
							onPress={async () => {
								const playlist = await fetchPlaylist(session, item.id);
								setSelectedPlaylist(playlist);
								setTab('library');
							}}
						/>
					)}
				/>
			)}

			<PlayerBar
				currentSong={currentSong}
				isPlaying={isPlaying}
				position={progress.position}
				duration={progress.duration}
			/>
		</SafeAreaView>
	);
}

function TabButton({
	active,
	label,
	onPress
}: {
	active: boolean;
	label: string;
	onPress: () => void;
}) {
	return (
		<Pressable style={[styles.tabButton, active && styles.tabButtonActive]} onPress={onPress}>
			<Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
		</Pressable>
	);
}

function SongRow({ song, onPress }: { song: Song; onPress: () => void }) {
	return (
		<Pressable style={styles.row} onPress={onPress}>
			<View style={styles.rowText}>
				<Text numberOfLines={1} style={styles.rowTitle}>
					{song.title}
				</Text>
				<Text numberOfLines={1} style={styles.rowSubtitle}>
					{song.artist} - {song.album}
				</Text>
			</View>
			<Text style={styles.duration}>{formatDuration(song.duration)}</Text>
		</Pressable>
	);
}

function PlaylistRow({ playlist, onPress }: { playlist: Playlist; onPress: () => void }) {
	return (
		<Pressable style={styles.row} onPress={onPress}>
			<View style={styles.rowText}>
				<Text numberOfLines={1} style={styles.rowTitle}>
					{playlist.name}
				</Text>
				<Text style={styles.rowSubtitle}>
					{playlist.songCount ?? playlist.songs?.length ?? 0}{' '}
					{(playlist.songCount ?? playlist.songs?.length ?? 0) === 1 ? 'song' : 'songs'}
				</Text>
			</View>
		</Pressable>
	);
}

function ContinueListening({
	song,
	position,
	onPress
}: {
	song: Song;
	position: number;
	onPress: () => void;
}) {
	return (
		<View style={styles.continueCard}>
			<View style={styles.rowText}>
				<Text style={styles.sectionTitle}>Continue listening</Text>
				<Text numberOfLines={1} style={styles.rowTitle}>
					{song.title}
				</Text>
				<Text style={styles.rowSubtitle}>
					{song.artist} at {formatDuration(position)}
				</Text>
			</View>
			<Pressable style={styles.playButton} onPress={onPress}>
				<Text style={styles.playButtonText}>Resume</Text>
			</Pressable>
		</View>
	);
}

function PlayerBar({
	currentSong,
	isPlaying,
	position,
	duration
}: {
	currentSong?: Song;
	isPlaying: boolean;
	position: number;
	duration: number;
}) {
	if (!currentSong) {
		return null;
	}

	return (
		<View style={styles.player}>
			<View style={styles.playerText}>
				<Text numberOfLines={1} style={styles.playerTitle}>
					{currentSong.title}
				</Text>
				<Text style={styles.playerSubtitle}>
					{formatDuration(position)} / {formatDuration(duration || currentSong.duration)}
				</Text>
			</View>
			<Pressable
				style={styles.playButton}
				onPress={() => {
					void (isPlaying ? TrackPlayer.pause() : TrackPlayer.play());
				}}
			>
				<Text style={styles.playButtonText}>{isPlaying ? 'Pause' : 'Play'}</Text>
			</Pressable>
		</View>
	);
}

async function setupPlayer() {
	try {
		await TrackPlayer.setupPlayer();
		await TrackPlayer.updateOptions({
			android: {
				appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback
			},
			progressUpdateEventInterval: 10,
			capabilities: [
				Capability.Play,
				Capability.Pause,
				Capability.SkipToNext,
				Capability.SkipToPrevious,
				Capability.SeekTo
			],
			compactCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext]
		});
	} catch {
		// TrackPlayer throws if setup was already completed during fast refresh.
	}
}

async function playSongs(
	session: MobileSession,
	songs: Song[],
	startIndex: number,
	setCurrentSong: (song: Song) => void,
	initialPosition = 0
) {
	const tracks = songs.map((song) => ({
		id: song.id,
		url: audioUrl(session, song.id),
		title: song.title,
		artist: song.artist,
		album: song.album,
		duration: song.duration ?? undefined,
		headers: {
			Authorization: `Bearer ${session.token}`
		}
	}));

	await TrackPlayer.reset();
	await TrackPlayer.add(tracks);
	await TrackPlayer.skip(startIndex, initialPosition);
	setCurrentSong(songs[startIndex]);
	await persistQueueState(session, songs, startIndex, [], initialPosition);
	await TrackPlayer.play();
}

async function persistNativeQueue(
	session: MobileSession,
	songs: Song[],
	activeIndex?: number,
	lastTrackId?: string | number,
	position = 0
) {
	const currentIndex =
		activeIndex ??
		(await TrackPlayer.getActiveTrackIndex()
			.then((index) => index ?? 0)
			.catch(() => 0));
	const previousTrackId = typeof lastTrackId === 'string' ? lastTrackId : undefined;

	await persistQueueState(
		session,
		songs,
		currentIndex,
		previousTrackId ? [previousTrackId] : [],
		position
	);
}

async function persistQueueState(
	session: MobileSession,
	songs: Song[],
	currentIndex: number,
	additionalHistoryIds: string[],
	position: number
) {
	const queueIds = songs.map((song) => song.id);
	const currentSongId = queueIds[currentIndex] ?? null;

	await updateQueue(session, {
		queueIds,
		...(additionalHistoryIds.length > 0 ? { historyIds: additionalHistoryIds } : {}),
		currentSongId,
		timestampSeconds: Math.max(0, position),
		volume: 1,
		repeatMode: 'off',
		shuffleEnabled: false,
		shuffledQueueIds: []
	}).catch(() => {
		// Playback should stay responsive even when sync is temporarily unavailable.
	});
}

function formatDuration(duration: number | null | undefined) {
	if (!duration || !Number.isFinite(duration)) {
		return '0:00';
	}

	const minutes = Math.floor(duration / 60);
	const seconds = Math.floor(duration % 60)
		.toString()
		.padStart(2, '0');

	return `${minutes}:${seconds}`;
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#09090b'
	},
	centered: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#09090b'
	},
	header: {
		paddingHorizontal: 18,
		paddingTop: 12,
		paddingBottom: 16,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between'
	},
	eyebrow: {
		color: '#34d399',
		fontSize: 11,
		fontWeight: '700'
	},
	title: {
		color: '#fafafa',
		fontSize: 28,
		fontWeight: '800'
	},
	signOutButton: {
		borderWidth: 1,
		borderColor: '#3f3f46',
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 8
	},
	signOutText: {
		color: '#d4d4d8',
		fontWeight: '700'
	},
	tabs: {
		flexDirection: 'row',
		gap: 8,
		paddingHorizontal: 18,
		paddingBottom: 10
	},
	tabButton: {
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#3f3f46',
		paddingHorizontal: 14,
		paddingVertical: 9
	},
	tabButtonActive: {
		backgroundColor: '#34d399',
		borderColor: '#34d399'
	},
	tabText: {
		color: '#d4d4d8',
		fontWeight: '700'
	},
	tabTextActive: {
		color: '#052e16'
	},
	error: {
		marginHorizontal: 18,
		marginVertical: 8,
		color: '#fbbf24'
	},
	listContent: {
		paddingBottom: 116
	},
	backRow: {
		marginHorizontal: 18,
		marginVertical: 8,
		paddingVertical: 10
	},
	backText: {
		color: '#34d399',
		fontWeight: '800'
	},
	continueCard: {
		marginHorizontal: 18,
		marginBottom: 12,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: '#3f3f46',
		backgroundColor: '#18181b',
		padding: 14,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12
	},
	recentSection: {
		paddingTop: 16,
		paddingBottom: 10
	},
	sectionTitle: {
		marginBottom: 8,
		color: '#34d399',
		fontSize: 12,
		fontWeight: '800',
		textTransform: 'uppercase'
	},
	row: {
		minHeight: 62,
		paddingHorizontal: 18,
		paddingVertical: 10,
		borderBottomWidth: 1,
		borderBottomColor: '#18181b',
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12
	},
	rowText: {
		flex: 1
	},
	rowTitle: {
		color: '#fafafa',
		fontSize: 15,
		fontWeight: '700'
	},
	rowSubtitle: {
		marginTop: 4,
		color: '#a1a1aa',
		fontSize: 13
	},
	duration: {
		color: '#71717a',
		fontVariant: ['tabular-nums']
	},
	player: {
		position: 'absolute',
		left: 12,
		right: 12,
		bottom: 18,
		minHeight: 72,
		borderRadius: 12,
		backgroundColor: '#18181b',
		borderWidth: 1,
		borderColor: '#3f3f46',
		padding: 12,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12
	},
	playerText: {
		flex: 1
	},
	playerTitle: {
		color: '#fafafa',
		fontWeight: '800'
	},
	playerSubtitle: {
		marginTop: 4,
		color: '#a1a1aa'
	},
	playButton: {
		height: 42,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 8,
		backgroundColor: '#34d399',
		paddingHorizontal: 16
	},
	playButtonText: {
		color: '#052e16',
		fontWeight: '900'
	}
});
