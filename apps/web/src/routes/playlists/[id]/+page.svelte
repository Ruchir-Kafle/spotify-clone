<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { GripVertical, Play } from '@lucide/svelte';
	import { onMount, untrack } from 'svelte';
	import type { ActionData, PageData } from './$types';

	type PlaylistSong = PageData['playlist']['songs'][number];
	type AvailableSong = PageData['availableSongs'][number];

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let orderedSongs = $state<PlaylistSong[]>([]);
	let draggedSongId = $state<string | null>(null);
	let songSearch = $state('');

	const filteredAvailableSongs = $derived(filterSongs(data.availableSongs, songSearch));
	const orderJson = $derived(JSON.stringify(orderedSongs.map((song) => song.id)));
	const loadedSongIds = $derived(data.playlist.songs.map((song) => song.id).join('|'));

	onMount(() => {
		orderedSongs = data.playlist.songs;
	});

	$effect(() => {
		if (loadedSongIds || data.playlist.songs.length === 0) {
			orderedSongs = untrack(() => data.playlist.songs);
		}
	});

	function handleDragStart(songId: string) {
		draggedSongId = songId;
	}

	function handleDrop(targetSongId: string) {
		if (!draggedSongId || draggedSongId === targetSongId) {
			draggedSongId = null;
			return;
		}

		const draggedIndex = orderedSongs.findIndex((song) => song.id === draggedSongId);
		const targetIndex = orderedSongs.findIndex((song) => song.id === targetSongId);

		if (draggedIndex === -1 || targetIndex === -1) {
			draggedSongId = null;
			return;
		}

		const nextSongs = [...orderedSongs];
		const [draggedSong] = nextSongs.splice(draggedIndex, 1);
		nextSongs.splice(targetIndex, 0, draggedSong);
		orderedSongs = nextSongs;
		draggedSongId = null;
	}

	function filterSongs(songs: AvailableSong[], query: string) {
		const normalizedQuery = query.trim().toLowerCase();

		if (!normalizedQuery) {
			return songs;
		}

		return songs.filter((song) =>
			`${song.title} ${song.artist} ${song.album}`.toLowerCase().includes(normalizedQuery)
		);
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
</script>

<main class="min-h-screen bg-zinc-950 text-zinc-100">
	<div class="grid min-h-screen grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)]">
		<aside class="border-b border-zinc-800 bg-black px-5 py-5 lg:border-r lg:border-b-0">
			<div class="text-lg font-semibold text-white">Music Server</div>
			<nav class="mt-8 space-y-1 text-sm">
				<a
					class="block rounded-md px-3 py-2 text-zinc-400 hover:bg-zinc-900 hover:text-white"
					href={resolve('/')}
				>
					Library
				</a>
				<a
					class="block rounded-md bg-zinc-900 px-3 py-2 font-medium text-white"
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
			</nav>
			<div class="mt-8 border-t border-zinc-800 pt-5 text-sm text-zinc-400">
				<div class="text-zinc-500">Songs</div>
				<div class="mt-1 text-2xl font-semibold text-white">{orderedSongs.length}</div>
			</div>
		</aside>

		<section class="min-w-0 px-5 py-5 pb-28 sm:px-8">
			<header class="border-b border-zinc-800 pb-5">
				<a class="text-sm text-zinc-400 hover:text-emerald-300" href={resolve('/playlists')}>
					Playlists
				</a>
				<h1 class="mt-2 text-3xl font-semibold tracking-normal text-white sm:text-4xl">
					{data.playlist.name}
				</h1>
			</header>

			<div class="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]">
				<section class="rounded-md border border-zinc-800 bg-zinc-950">
					<div class="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
						<h2 class="text-sm font-medium text-white">Playlist songs</h2>
						<form method="POST" action="?/reorderSongs" use:enhance>
							<input type="hidden" name="orderJson" value={orderJson} />
							<button
								class="h-9 rounded-md border border-zinc-700 px-3 text-sm text-zinc-300 hover:border-emerald-400 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
								type="submit"
								disabled={orderedSongs.length < 2}
							>
								Save Order
							</button>
						</form>
					</div>

					{#if form?.message}
						<div class="border-b border-zinc-800 px-4 py-3 text-sm text-amber-300">
							{form.message}
						</div>
					{/if}

					{#if orderedSongs.length === 0}
						<div class="px-4 py-10 text-center">
							<div class="text-sm font-medium text-white">No songs yet</div>
							<div class="mt-2 text-sm text-zinc-400">Add songs from your library.</div>
						</div>
					{:else}
						<div class="divide-y divide-zinc-900" role="list">
							{#each orderedSongs as song, index (song.id)}
								<div
									class={`grid grid-cols-[28px_32px_minmax(0,1fr)_64px_auto] items-center gap-3 px-4 py-3 text-sm ${draggedSongId === song.id ? 'bg-zinc-900' : ''}`}
									draggable="true"
									role="listitem"
									ondragstart={() => handleDragStart(song.id)}
									ondragover={(event) => event.preventDefault()}
									ondrop={() => handleDrop(song.id)}
								>
									<GripVertical size={16} class="text-zinc-600" aria-hidden="true" />
									<div class="text-zinc-500">{index + 1}</div>
									<div class="min-w-0">
										<div class="truncate font-medium text-white">{song.title}</div>
										<div class="mt-1 truncate text-xs text-zinc-500">
											{song.artist} · {song.album}
										</div>
									</div>
									<div class="text-right text-xs text-zinc-500">
										{formatDuration(song.duration)}
									</div>
									<form method="POST" action="?/removeSong">
										<input type="hidden" name="songId" value={song.id} />
										<button
											class="h-9 rounded-md border border-zinc-700 px-3 text-sm text-zinc-300 hover:border-red-400 hover:text-red-300"
											type="submit"
										>
											Remove
										</button>
									</form>
								</div>
							{/each}
						</div>
					{/if}
				</section>

				<div class="space-y-6">
					<section class="rounded-md border border-zinc-800 bg-zinc-950">
						<div class="border-b border-zinc-800 px-4 py-3">
							<h2 class="text-sm font-medium text-white">Playlist settings</h2>
						</div>

						<form class="space-y-3 p-4" method="POST" action="?/renamePlaylist" use:enhance>
							<label class="block">
								<span class="sr-only">Playlist name</span>
								<input
									class="h-11 w-full rounded-md border border-zinc-700 bg-zinc-900 px-4 text-sm text-white outline-none focus:border-emerald-400"
									name="name"
									value={data.playlist.name}
								/>
							</label>
							<button
								class="h-10 rounded-md border border-zinc-700 px-3 text-sm text-zinc-300 hover:border-emerald-400 hover:text-emerald-300"
								type="submit"
							>
								Rename Playlist
							</button>
						</form>

						<form class="border-t border-zinc-800 p-4" method="POST" action="?/deletePlaylist">
							<button
								class="h-10 rounded-md border border-zinc-700 px-3 text-sm text-zinc-300 hover:border-red-400 hover:text-red-300"
								type="submit"
							>
								Delete Playlist
							</button>
						</form>
					</section>

					<section class="rounded-md border border-zinc-800 bg-zinc-950">
						<div class="border-b border-zinc-800 px-4 py-3">
							<h2 class="text-sm font-medium text-white">Add from library</h2>
						</div>

						<div class="border-b border-zinc-800 p-4">
							<label>
								<span class="sr-only">Search library songs</span>
								<input
									class="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-emerald-400"
									type="search"
									bind:value={songSearch}
									placeholder="Search songs"
								/>
							</label>
						</div>

						{#if filteredAvailableSongs.length === 0}
							<div class="px-4 py-8 text-center text-sm text-zinc-500">No songs available.</div>
						{:else}
							<div class="max-h-[520px] divide-y divide-zinc-900 overflow-auto">
								{#each filteredAvailableSongs.slice(0, 80) as song (song.id)}
									<div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
										<div class="min-w-0">
											<div class="truncate text-sm font-medium text-white">{song.title}</div>
											<div class="mt-1 truncate text-xs text-zinc-500">
												{song.artist} · {song.album}
											</div>
										</div>
										<form method="POST" action="?/addSong">
											<input type="hidden" name="songId" value={song.id} />
											<button
												class="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 text-zinc-300 hover:border-emerald-400 hover:text-emerald-300"
												type="submit"
												aria-label={`Add ${song.title}`}
											>
												<Play size={16} aria-hidden="true" />
											</button>
										</form>
									</div>
								{/each}
							</div>
						{/if}
					</section>
				</div>
			</div>
		</section>
	</div>
</main>
