<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		ListMusic,
		Pause,
		Play,
		Repeat,
		Repeat1,
		Shuffle,
		SkipBack,
		SkipForward,
		Volume2,
		X
	} from '@lucide/svelte';
	import { onMount, tick } from 'svelte';
	import type { PageData } from './$types';

	type SortKey = 'title' | 'artist' | 'album' | 'duration' | 'year';
	type SortDirection = 'asc' | 'desc';
	type RepeatMode = 'off' | 'playlist' | 'one';
	type Song = PageData['songs'][number];

	const ROW_HEIGHT = 60;
	const OVERSCAN_ROWS = 8;

	let { data }: { data: PageData } = $props();

	let searchTerm = $state('');
	let sortKey = $state<SortKey>('title');
	let sortDirection = $state<SortDirection>('asc');
	let scrollTop = $state(0);
	let viewportHeight = $state(620);
	let scrollContainer = $state<HTMLDivElement>();
	let audioElement = $state<HTMLAudioElement>();
	let queueIds = $state<string[]>([]);
	let historyIds = $state<string[]>([]);
	let shuffledQueueIds = $state<string[]>([]);
	let currentSong = $state<Song | null>(null);
	let isPlaying = $state(false);
	let currentTime = $state(0);
	let audioDuration = $state(0);
	let volume = $state(0.9);
	let repeatMode = $state<RepeatMode>('off');
	let shuffleEnabled = $state(false);
	let queuePanelOpen = $state(false);
	let pendingSeekSeconds = $state(0);
	let persistTimeout: ReturnType<typeof setTimeout> | undefined;

	const filteredSongs = $derived(filterSongs(data.songs, searchTerm));
	const sortedSongs = $derived(sortSongs(filteredSongs, sortKey, sortDirection));
	const totalHeight = $derived(sortedSongs.length * ROW_HEIGHT);
	const startIndex = $derived(Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS));
	const visibleCount = $derived(Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN_ROWS * 2);
	const visibleSongs = $derived(sortedSongs.slice(startIndex, startIndex + visibleCount));
	const visibleOffset = $derived(startIndex * ROW_HEIGHT);
	const songById = $derived(new Map(data.songs.map((song) => [song.id, song])));
	const playbackQueueIds = $derived(shuffleEnabled ? shuffledQueueIds : queueIds);
	const currentSongIndex = $derived(
		currentSong ? playbackQueueIds.findIndex((songId) => songId === currentSong?.id) : -1
	);
	const upcomingSongs = $derived(
		playbackQueueIds
			.slice(Math.max(0, currentSongIndex + 1))
			.map((songId) => songById.get(songId))
			.filter((song): song is Song => Boolean(song))
	);
	const historySongs = $derived(
		historyIds
			.slice(-20)
			.reverse()
			.map((songId) => songById.get(songId))
			.filter((song): song is Song => Boolean(song))
	);
	const currentSongDuration = $derived(audioDuration || currentSong?.duration || 0);
	const audioSource = $derived(currentSong ? resolve(`/songs/${currentSong.id}/audio`) : undefined);

	onMount(() => {
		queueIds = initialQueueIds(data);
		historyIds = validSongIds(data.playbackState.historyIds, data.songs);
		shuffledQueueIds = initialShuffledQueueIds(data);
		currentSong = initialCurrentSong(data);
		currentTime = data.playbackState.timestampSeconds;
		pendingSeekSeconds = data.playbackState.timestampSeconds;
		volume = data.playbackState.volume;
		repeatMode = data.playbackState.repeatMode;
		shuffleEnabled = data.playbackState.shuffleEnabled;

		if (!scrollContainer) {
			return;
		}

		const updateViewportHeight = () => {
			viewportHeight = scrollContainer?.clientHeight ?? viewportHeight;
		};

		updateViewportHeight();

		const observer = new ResizeObserver(updateViewportHeight);
		observer.observe(scrollContainer);

		return () => observer.disconnect();
	});

	function setSort(nextSortKey: SortKey) {
		if (sortKey === nextSortKey) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
			return;
		}

		sortKey = nextSortKey;
		sortDirection = 'asc';
	}

	function handleScroll(event: Event) {
		scrollTop = (event.currentTarget as HTMLDivElement).scrollTop;
	}

	async function playSong(song: Song, sourceSongs = sortedSongs) {
		if (currentSong?.id === song.id) {
			await togglePlayback();
			return;
		}

		const sourceIds = sourceSongs.map((sourceSong) => sourceSong.id);

		if (sourceIds.length > 0) {
			queueIds = sourceIds;

			if (shuffleEnabled) {
				shuffledQueueIds = createShuffledQueue(sourceIds, song.id);
			}
		}

		await playQueuedSong(song);
	}

	async function playQueuedSong(
		song: Song,
		options: { addHistory?: boolean; resetTime?: boolean } = {}
	) {
		const addHistory = options.addHistory ?? true;
		const resetTime = options.resetTime ?? true;

		if (addHistory && currentSong && currentSong.id !== song.id) {
			historyIds = [...historyIds, currentSong.id].slice(-100);
		}

		currentSong = song;
		currentTime = resetTime ? 0 : currentTime;
		pendingSeekSeconds = resetTime ? 0 : pendingSeekSeconds;
		audioDuration = song.duration ?? 0;
		persistPlaybackState(true);
		await tick();
		await audioElement?.play();
	}

	async function togglePlayback() {
		if (!audioElement) {
			if (sortedSongs[0]) {
				await playSong(sortedSongs[0]);
			}

			return;
		}

		if (audioElement.paused) {
			await audioElement.play();
			return;
		}

		audioElement.pause();
	}

	async function playPreviousSong() {
		if (!currentSong) {
			if (sortedSongs[0]) {
				await playSong(sortedSongs[0]);
			}

			return;
		}

		if (audioElement && audioElement.currentTime > 3) {
			audioElement.currentTime = 0;
			currentTime = 0;
			persistPlaybackState();
			return;
		}

		const previousHistoryId = historyIds.at(-1);

		if (previousHistoryId) {
			historyIds = historyIds.slice(0, -1);
			const previousSong = songById.get(previousHistoryId);

			if (previousSong) {
				await playQueuedSong(previousSong, { addHistory: false });
			}

			return;
		}

		const previousSong = songById.get(playbackQueueIds[Math.max(0, currentSongIndex - 1)]);

		if (previousSong && previousSong.id !== currentSong.id) {
			await playQueuedSong(previousSong, { addHistory: false });
		}
	}

	async function playNextSong() {
		if (!currentSong) {
			if (sortedSongs[0]) {
				await playSong(sortedSongs[0]);
			}

			return;
		}

		if (repeatMode === 'one') {
			if (audioElement) {
				audioElement.currentTime = 0;
			}

			currentTime = 0;
			await audioElement?.play();
			persistPlaybackState();
			return;
		}

		const nextSong = songById.get(playbackQueueIds[currentSongIndex + 1]);

		if (nextSong) {
			await playQueuedSong(nextSong);
			return;
		}

		if (repeatMode === 'playlist') {
			const firstSong = songById.get(playbackQueueIds[0]);

			if (firstSong) {
				await playQueuedSong(firstSong);
			}

			return;
		}

		audioElement?.pause();
		isPlaying = false;
		persistPlaybackState(true);
	}

	async function jumpToQueueSong(song: Song) {
		await playQueuedSong(song);
		queuePanelOpen = false;
	}

	function toggleShuffle() {
		shuffleEnabled = !shuffleEnabled;

		if (shuffleEnabled) {
			shuffledQueueIds = createShuffledQueue(queueIds, currentSong?.id);
		}

		persistPlaybackState(true);
	}

	function cycleRepeatMode() {
		repeatMode = repeatMode === 'off' ? 'playlist' : repeatMode === 'playlist' ? 'one' : 'off';
		persistPlaybackState(true);
	}

	function seekTo(event: Event) {
		if (!audioElement) {
			return;
		}

		audioElement.currentTime = Number((event.currentTarget as HTMLInputElement).value);
		currentTime = audioElement.currentTime;
		persistPlaybackState();
	}

	function setVolume(event: Event) {
		volume = Number((event.currentTarget as HTMLInputElement).value);

		if (audioElement) {
			audioElement.volume = volume;
		}

		persistPlaybackState();
	}

	function syncLoadedMetadata() {
		if (!audioElement) {
			return;
		}

		audioElement.volume = volume;
		audioDuration = Number.isFinite(audioElement.duration) ? audioElement.duration : 0;

		if (pendingSeekSeconds > 0 && audioElement.duration >= pendingSeekSeconds) {
			audioElement.currentTime = pendingSeekSeconds;
			currentTime = pendingSeekSeconds;
			pendingSeekSeconds = 0;
		}
	}

	function syncCurrentTime() {
		currentTime = audioElement?.currentTime ?? 0;
		persistPlaybackState();
	}

	function persistPlaybackState(immediate = false) {
		if (persistTimeout) {
			clearTimeout(persistTimeout);
		}

		const persist = () => {
			void fetch(resolve('/playback-state'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					queueIds,
					historyIds,
					currentSongId: currentSong?.id ?? null,
					timestampSeconds: currentTime,
					volume,
					repeatMode,
					shuffleEnabled,
					shuffledQueueIds
				})
			}).catch(() => {
				// Playback should continue even if persistence fails.
			});
		};

		if (immediate) {
			persist();
			return;
		}

		persistTimeout = setTimeout(persist, 600);
	}

	function filterSongs(songs: Song[], query: string) {
		const normalizedQuery = normalizeText(query);

		if (!normalizedQuery) {
			return songs;
		}

		const tokens = normalizedQuery.split(' ').filter(Boolean);

		return songs
			.map((song) => ({ song, score: scoreSong(song, tokens, normalizedQuery) }))
			.filter((result) => result.score > 0)
			.sort((a, b) => b.score - a.score || compareText(a.song.title, b.song.title))
			.map((result) => result.song);
	}

	function sortSongs(songs: Song[], key: SortKey, direction: SortDirection) {
		const sorted = [...songs].sort((a, b) => {
			const result = compareSongField(a, b, key);
			return direction === 'asc' ? result : -result;
		});

		return sorted;
	}

	function compareSongField(a: Song, b: Song, key: SortKey) {
		if (key === 'duration') {
			return compareNumber(a.duration, b.duration);
		}

		if (key === 'year') {
			return compareNumber(a.year, b.year);
		}

		return compareText(a[key], b[key]);
	}

	function scoreSong(song: Song, tokens: string[], query: string) {
		const title = normalizeText(song.title);
		const artist = normalizeText(song.artist);
		const album = normalizeText(song.album);
		const haystack = `${title} ${artist} ${album} ${song.year ?? ''}`;

		if (!tokens.every((token) => haystack.includes(token) || isSubsequence(token, haystack))) {
			return 0;
		}

		let score = 1;

		if (title === query) score += 12;
		if (title.startsWith(query)) score += 8;
		if (artist.startsWith(query)) score += 5;
		if (album.startsWith(query)) score += 3;
		if (haystack.includes(query)) score += 2;

		return score;
	}

	function isSubsequence(needle: string, haystack: string) {
		let index = 0;

		for (const character of haystack) {
			if (character === needle[index]) {
				index += 1;
			}

			if (index === needle.length) {
				return true;
			}
		}

		return false;
	}

	function normalizeText(value: string) {
		return value
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '')
			.trim();
	}

	function compareText(a: string, b: string) {
		return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
	}

	function compareNumber(a: number | null, b: number | null) {
		if (a === null && b === null) return 0;
		if (a === null) return 1;
		if (b === null) return -1;
		return a - b;
	}

	function initialCurrentSong(pageData: PageData) {
		return pageData.songs.find((song) => song.id === pageData.playbackState.currentSongId) ?? null;
	}

	function initialQueueIds(pageData: PageData) {
		const savedQueueIds = validSongIds(pageData.playbackState.queueIds, pageData.songs);
		return savedQueueIds.length > 0 ? savedQueueIds : pageData.songs.map((song) => song.id);
	}

	function initialShuffledQueueIds(pageData: PageData) {
		const queue = initialQueueIds(pageData);
		const savedShuffleIds = validSongIds(pageData.playbackState.shuffledQueueIds, pageData.songs);

		if (savedShuffleIds.length === queue.length) {
			return savedShuffleIds;
		}

		return createShuffledQueue(queue, pageData.playbackState.currentSongId);
	}

	function validSongIds(songIds: string[], songs: Song[]) {
		const validIds = new Set(songs.map((song) => song.id));
		return songIds.filter((songId) => validIds.has(songId));
	}

	function createShuffledQueue(songIds: string[], currentSongId?: string | null) {
		const remainingIds = songIds.filter((songId) => songId !== currentSongId);
		const shuffledIds = [...remainingIds];

		for (let index = shuffledIds.length - 1; index > 0; index -= 1) {
			const swapIndex = stableRandomIndex(index + 1, `${currentSongId ?? 'queue'}:${index}`);
			[shuffledIds[index], shuffledIds[swapIndex]] = [shuffledIds[swapIndex], shuffledIds[index]];
		}

		return currentSongId && songIds.includes(currentSongId)
			? [currentSongId, ...shuffledIds]
			: shuffledIds;
	}

	function stableRandomIndex(max: number, seed: string) {
		let hash = 2166136261;

		for (let index = 0; index < seed.length; index += 1) {
			hash ^= seed.charCodeAt(index);
			hash = Math.imul(hash, 16777619);
		}

		return Math.abs(hash) % max;
	}

	function formatDuration(duration: number | null) {
		if (!duration) {
			return '0:00';
		}

		const minutes = Math.floor(duration / 60);
		const seconds = Math.floor(duration % 60)
			.toString()
			.padStart(2, '0');

		return `${minutes}:${seconds}`;
	}

	function formatTrack(song: Song) {
		if (!song.trackNumber) {
			return '-';
		}

		return song.discNumber && song.discNumber > 1
			? `${song.discNumber}.${song.trackNumber}`
			: String(song.trackNumber);
	}

	function sortLabel(key: SortKey) {
		if (sortKey !== key) {
			return '';
		}

		return sortDirection === 'asc' ? 'up' : 'down';
	}

	function repeatLabel() {
		if (repeatMode === 'one') {
			return 'Repeat one';
		}

		if (repeatMode === 'playlist') {
			return 'Repeat playlist';
		}

		return 'Repeat off';
	}
</script>

<main class="min-h-screen bg-zinc-950 text-zinc-100">
	<div class="grid min-h-screen grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)]">
		<aside class="border-b border-zinc-800 bg-black px-5 py-5 lg:border-r lg:border-b-0">
			<div class="text-lg font-semibold text-white">Music Server</div>
			<nav class="mt-8 space-y-1 text-sm">
				<a
					class="block rounded-md bg-zinc-900 px-3 py-2 font-medium text-white"
					href={resolve('/')}
				>
					Library
				</a>
				<a
					class="block rounded-md px-3 py-2 text-zinc-400 hover:bg-zinc-900 hover:text-white"
					href={resolve('/playlists')}
				>
					Playlists
				</a>
				<div class="block rounded-md px-3 py-2 text-zinc-500">Search</div>
				<a
					class="block rounded-md px-3 py-2 text-zinc-400 hover:bg-zinc-900 hover:text-white"
					href={resolve('/settings')}
				>
					Settings
				</a>
				<a
					class="block rounded-md px-3 py-2 text-zinc-400 hover:bg-zinc-900 hover:text-white"
					href={resolve('/signout')}
				>
					Sign out
				</a>
			</nav>
			<div class="mt-8 border-t border-zinc-800 pt-5 text-sm text-zinc-400">
				<div class="text-zinc-500">Indexed songs</div>
				<div class="mt-1 text-2xl font-semibold text-white">{data.songs.length}</div>
			</div>
		</aside>

		<section class="flex min-h-screen min-w-0 flex-col pb-32">
			<header class="border-b border-zinc-800 bg-zinc-950/95 px-5 py-5 sm:px-8">
				<div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
					<div>
						<p class="text-sm font-medium tracking-[0.16em] text-emerald-400 uppercase">Library</p>
						<h1 class="mt-2 text-3xl font-semibold tracking-normal text-white sm:text-4xl">
							Indexed music
						</h1>
					</div>

					<label class="relative block w-full max-w-xl">
						<span class="sr-only">Search songs</span>
						<input
							class="h-11 w-full rounded-md border border-zinc-700 bg-zinc-900 px-4 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-emerald-400"
							type="search"
							bind:value={searchTerm}
							placeholder="Search by song, artist, album, or year"
						/>
					</label>
				</div>
			</header>

			<div class="min-h-0 flex-1 px-5 py-5 sm:px-8">
				<div class="mb-3 flex items-center justify-between gap-4 text-sm text-zinc-400">
					<div>{sortedSongs.length} shown</div>
					<div class="hidden sm:block">Click a row to play from your local library.</div>
				</div>

				<div
					class="grid h-[calc(100vh-260px)] min-h-96 overflow-hidden rounded-md border border-zinc-800 bg-zinc-950"
				>
					<div
						class="grid h-11 grid-cols-[52px_minmax(220px,2fr)_minmax(150px,1fr)_minmax(150px,1fr)_86px_72px] items-center border-b border-zinc-800 bg-zinc-900 px-3 text-xs font-medium text-zinc-400 uppercase"
					>
						<div>#</div>
						<button
							class="text-left hover:text-white"
							type="button"
							onclick={() => setSort('title')}
						>
							Title {sortLabel('title')}
						</button>
						<button
							class="text-left hover:text-white"
							type="button"
							onclick={() => setSort('artist')}
						>
							Artist {sortLabel('artist')}
						</button>
						<button
							class="text-left hover:text-white"
							type="button"
							onclick={() => setSort('album')}
						>
							Album {sortLabel('album')}
						</button>
						<button
							class="text-left hover:text-white"
							type="button"
							onclick={() => setSort('year')}
						>
							Year {sortLabel('year')}
						</button>
						<button
							class="text-right hover:text-white"
							type="button"
							onclick={() => setSort('duration')}
						>
							Time {sortLabel('duration')}
						</button>
					</div>

					<div bind:this={scrollContainer} class="overflow-auto" onscroll={handleScroll}>
						{#if sortedSongs.length === 0}
							<div
								class="flex h-full min-h-80 flex-col items-center justify-center px-6 text-center"
							>
								<div class="text-lg font-medium text-white">
									{data.songs.length === 0 ? 'No indexed songs yet' : 'No matches'}
								</div>
								<p class="mt-2 max-w-md text-sm leading-6 text-zinc-400">
									{data.songs.length === 0
										? 'Add music files to a configured directory and run pnpm scan.'
										: 'Try another title, artist, album, or year.'}
								</p>
							</div>
						{:else}
							<div class="relative" style={`height: ${totalHeight}px;`}>
								<div
									class="absolute inset-x-0 top-0"
									style={`transform: translateY(${visibleOffset}px);`}
								>
									{#each visibleSongs as song, index (song.id)}
										<button
											class={`grid h-[60px] w-full grid-cols-[52px_minmax(220px,2fr)_minmax(150px,1fr)_minmax(150px,1fr)_86px_72px] items-center border-b border-zinc-900 px-3 text-left text-sm hover:bg-zinc-900/80 ${currentSong?.id === song.id ? 'bg-zinc-900 text-emerald-300' : ''}`}
											type="button"
											onclick={() => void playSong(song)}
										>
											<span class="flex items-center gap-2 text-zinc-500">
												<span>{startIndex + index + 1}</span>
												<span class="text-emerald-400">
													{#if currentSong?.id === song.id && isPlaying}
														<Pause size={14} aria-hidden="true" />
													{:else}
														<Play size={14} aria-hidden="true" />
													{/if}
												</span>
											</span>
											<div class="min-w-0">
												<div class="truncate font-medium text-white">{song.title}</div>
												<div class="truncate text-xs text-zinc-500">Track {formatTrack(song)}</div>
											</div>
											<div class="truncate text-zinc-300">{song.artist}</div>
											<div class="truncate text-zinc-400">{song.album}</div>
											<div class="text-zinc-500">{song.year ?? '-'}</div>
											<div class="text-right text-zinc-400">{formatDuration(song.duration)}</div>
										</button>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</section>
	</div>

	<audio
		bind:this={audioElement}
		src={audioSource}
		preload="metadata"
		onloadedmetadata={syncLoadedMetadata}
		ontimeupdate={syncCurrentTime}
		onplay={() => (isPlaying = true)}
		onpause={() => (isPlaying = false)}
		onended={() => void playNextSong()}
	></audio>

	<footer
		class="fixed inset-x-0 bottom-0 border-t border-zinc-800 bg-black px-4 py-3 text-zinc-100 shadow-2xl"
	>
		<div
			class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(360px,1.4fr)_minmax(180px,1fr)] lg:items-center"
		>
			<div class="min-w-0">
				<div class="truncate text-sm font-medium text-white">
					{currentSong?.title ?? 'No song selected'}
				</div>
				<div class="truncate text-xs text-zinc-500">
					{currentSong?.artist ?? 'Choose a song from Library'}
				</div>
			</div>

			<div class="space-y-2">
				<div class="flex items-center justify-center gap-3">
					<button
						class={`flex h-9 w-9 items-center justify-center rounded-full hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 ${shuffleEnabled ? 'text-emerald-400' : 'text-zinc-300 hover:text-white'}`}
						type="button"
						disabled={sortedSongs.length === 0}
						onclick={toggleShuffle}
						aria-label={shuffleEnabled ? 'Disable shuffle' : 'Enable shuffle'}
					>
						<Shuffle size={17} aria-hidden="true" />
					</button>
					<button
						class="flex h-9 w-9 items-center justify-center rounded-full text-zinc-300 hover:bg-zinc-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
						type="button"
						disabled={sortedSongs.length === 0}
						onclick={() => void playPreviousSong()}
						aria-label="Previous"
					>
						<SkipBack size={18} aria-hidden="true" />
					</button>
					<button
						class="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
						type="button"
						disabled={sortedSongs.length === 0}
						onclick={() => void togglePlayback()}
						aria-label={isPlaying ? 'Pause' : 'Play'}
					>
						{#if isPlaying}
							<Pause size={21} aria-hidden="true" />
						{:else}
							<Play size={21} aria-hidden="true" />
						{/if}
					</button>
					<button
						class="flex h-9 w-9 items-center justify-center rounded-full text-zinc-300 hover:bg-zinc-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
						type="button"
						disabled={sortedSongs.length === 0}
						onclick={() => void playNextSong()}
						aria-label="Next"
					>
						<SkipForward size={18} aria-hidden="true" />
					</button>
					<button
						class={`flex h-9 w-9 items-center justify-center rounded-full hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 ${repeatMode === 'off' ? 'text-zinc-300 hover:text-white' : 'text-emerald-400'}`}
						type="button"
						disabled={sortedSongs.length === 0}
						onclick={cycleRepeatMode}
						aria-label={repeatLabel()}
					>
						{#if repeatMode === 'one'}
							<Repeat1 size={17} aria-hidden="true" />
						{:else}
							<Repeat size={17} aria-hidden="true" />
						{/if}
					</button>
				</div>

				<div
					class="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 text-xs text-zinc-500"
				>
					<div class="text-right">{formatDuration(currentTime)}</div>
					<input
						class="h-1 w-full accent-emerald-400"
						type="range"
						min="0"
						max={Math.max(0, currentSongDuration)}
						step="0.1"
						value={currentTime}
						oninput={seekTo}
						disabled={!currentSong}
						aria-label="Seek"
					/>
					<div>{formatDuration(currentSongDuration)}</div>
				</div>
			</div>

			<div class="flex items-center justify-start gap-2 lg:justify-end">
				<Volume2 size={18} class="text-zinc-400" aria-hidden="true" />
				<input
					class="h-1 w-32 accent-emerald-400"
					type="range"
					min="0"
					max="1"
					step="0.01"
					value={volume}
					oninput={setVolume}
					aria-label="Volume"
				/>
				<button
					class={`ml-2 flex h-9 w-9 items-center justify-center rounded-full hover:bg-zinc-900 ${queuePanelOpen ? 'text-emerald-400' : 'text-zinc-300 hover:text-white'}`}
					type="button"
					onclick={() => (queuePanelOpen = !queuePanelOpen)}
					aria-label="Queue"
				>
					<ListMusic size={18} aria-hidden="true" />
				</button>
			</div>
		</div>
	</footer>

	{#if queuePanelOpen}
		<aside
			class="fixed top-0 right-0 bottom-24 z-10 flex w-full max-w-md flex-col border-l border-zinc-800 bg-black shadow-2xl"
		>
			<div class="flex items-center justify-between border-b border-zinc-800 px-4 py-4">
				<div>
					<div class="text-sm font-semibold text-white">Queue</div>
					<div class="mt-1 text-xs text-zinc-500">
						{shuffleEnabled ? 'Shuffle on' : 'Shuffle off'} · {repeatLabel()}
					</div>
				</div>
				<button
					class="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-white"
					type="button"
					onclick={() => (queuePanelOpen = false)}
					aria-label="Close queue"
				>
					<X size={18} aria-hidden="true" />
				</button>
			</div>

			<div class="min-h-0 flex-1 overflow-auto px-4 py-4">
				<section>
					<h2 class="text-xs font-medium tracking-[0.14em] text-zinc-500 uppercase">Now playing</h2>
					{#if currentSong}
						<div class="mt-3 rounded-md bg-zinc-900 px-3 py-3">
							<div class="truncate text-sm font-medium text-white">{currentSong.title}</div>
							<div class="mt-1 truncate text-xs text-zinc-400">{currentSong.artist}</div>
						</div>
					{:else}
						<div class="mt-3 text-sm text-zinc-500">Nothing playing yet.</div>
					{/if}
				</section>

				<section class="mt-6">
					<h2 class="text-xs font-medium tracking-[0.14em] text-zinc-500 uppercase">Next up</h2>
					{#if upcomingSongs.length === 0}
						<div class="mt-3 text-sm text-zinc-500">No upcoming songs.</div>
					{:else}
						<div class="mt-3 divide-y divide-zinc-900">
							{#each upcomingSongs.slice(0, 80) as song (song.id)}
								<button
									class="grid w-full grid-cols-[minmax(0,1fr)_48px] gap-3 py-3 text-left hover:text-emerald-300"
									type="button"
									onclick={() => void jumpToQueueSong(song)}
								>
									<span class="min-w-0">
										<span class="block truncate text-sm font-medium text-white">{song.title}</span>
										<span class="mt-1 block truncate text-xs text-zinc-500">{song.artist}</span>
									</span>
									<span class="text-right text-xs text-zinc-500"
										>{formatDuration(song.duration)}</span
									>
								</button>
							{/each}
						</div>
					{/if}
				</section>

				<section class="mt-6">
					<h2 class="text-xs font-medium tracking-[0.14em] text-zinc-500 uppercase">History</h2>
					{#if historySongs.length === 0}
						<div class="mt-3 text-sm text-zinc-500">No history yet.</div>
					{:else}
						<div class="mt-3 divide-y divide-zinc-900">
							{#each historySongs as song (song.id)}
								<button
									class="grid w-full grid-cols-[minmax(0,1fr)_48px] gap-3 py-3 text-left hover:text-emerald-300"
									type="button"
									onclick={() => void jumpToQueueSong(song)}
								>
									<span class="min-w-0">
										<span class="block truncate text-sm font-medium text-white">{song.title}</span>
										<span class="mt-1 block truncate text-xs text-zinc-500">{song.artist}</span>
									</span>
									<span class="text-right text-xs text-zinc-500"
										>{formatDuration(song.duration)}</span
									>
								</button>
							{/each}
						</div>
					{/if}
				</section>
			</div>
		</aside>
	{/if}
</main>
