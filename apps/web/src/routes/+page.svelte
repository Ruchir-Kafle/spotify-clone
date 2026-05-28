<script lang="ts">
	import { resolve } from '$app/paths';
	import { Pause, Play, SkipBack, SkipForward, Volume2 } from '@lucide/svelte';
	import { onMount, tick } from 'svelte';
	import type { PageData } from './$types';

	type SortKey = 'title' | 'artist' | 'album' | 'duration' | 'year';
	type SortDirection = 'asc' | 'desc';
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
	let currentSong = $state<Song | null>(null);
	let isPlaying = $state(false);
	let currentTime = $state(0);
	let audioDuration = $state(0);
	let volume = $state(0.9);

	const filteredSongs = $derived(filterSongs(data.songs, searchTerm));
	const sortedSongs = $derived(sortSongs(filteredSongs, sortKey, sortDirection));
	const totalHeight = $derived(sortedSongs.length * ROW_HEIGHT);
	const startIndex = $derived(Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS));
	const visibleCount = $derived(Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN_ROWS * 2);
	const visibleSongs = $derived(sortedSongs.slice(startIndex, startIndex + visibleCount));
	const visibleOffset = $derived(startIndex * ROW_HEIGHT);
	const currentSongIndex = $derived(
		currentSong ? sortedSongs.findIndex((song) => song.id === currentSong?.id) : -1
	);
	const currentSongDuration = $derived(audioDuration || currentSong?.duration || 0);
	const audioSource = $derived(currentSong ? resolve(`/songs/${currentSong.id}/audio`) : undefined);

	onMount(() => {
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

	async function playSong(song: Song) {
		if (currentSong?.id === song.id) {
			await togglePlayback();
			return;
		}

		currentSong = song;
		currentTime = 0;
		audioDuration = song.duration ?? 0;
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
			return;
		}

		const previousSong = sortedSongs[Math.max(0, currentSongIndex - 1)];

		if (previousSong) {
			await playSong(previousSong);
		}
	}

	async function playNextSong() {
		if (!currentSong) {
			if (sortedSongs[0]) {
				await playSong(sortedSongs[0]);
			}

			return;
		}

		const nextSong = sortedSongs[currentSongIndex + 1];

		if (nextSong) {
			await playSong(nextSong);
			return;
		}

		audioElement?.pause();
		isPlaying = false;
	}

	function seekTo(event: Event) {
		if (!audioElement) {
			return;
		}

		audioElement.currentTime = Number((event.currentTarget as HTMLInputElement).value);
	}

	function setVolume(event: Event) {
		volume = Number((event.currentTarget as HTMLInputElement).value);

		if (audioElement) {
			audioElement.volume = volume;
		}
	}

	function syncLoadedMetadata() {
		if (!audioElement) {
			return;
		}

		audioElement.volume = volume;
		audioDuration = Number.isFinite(audioElement.duration) ? audioElement.duration : 0;
	}

	function syncCurrentTime() {
		currentTime = audioElement?.currentTime ?? 0;
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
				<div class="block rounded-md px-3 py-2 text-zinc-500">Playlists</div>
				<div class="block rounded-md px-3 py-2 text-zinc-500">Search</div>
				<a
					class="block rounded-md px-3 py-2 text-zinc-400 hover:bg-zinc-900 hover:text-white"
					href={resolve('/settings')}
				>
					Settings
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
			</div>
		</div>
	</footer>
</main>
