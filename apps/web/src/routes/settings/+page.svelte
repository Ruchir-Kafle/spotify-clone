<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
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
					class="block rounded-md px-3 py-2 text-zinc-400 hover:bg-zinc-900 hover:text-white"
					href={resolve('/playlists')}
				>
					Playlists
				</a>
				<div class="block rounded-md px-3 py-2 text-zinc-500">Search</div>
				<a
					class="block rounded-md bg-zinc-900 px-3 py-2 font-medium text-white"
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
				<div class="text-zinc-500">Library folders</div>
				<div class="mt-1 text-2xl font-semibold text-white">{data.directories.length}</div>
			</div>
		</aside>

		<section class="min-w-0 px-5 py-5 sm:px-8">
			<header class="border-b border-zinc-800 pb-5">
				<p class="text-sm font-medium tracking-[0.16em] text-emerald-400 uppercase">Settings</p>
				<h1 class="mt-2 text-3xl font-semibold tracking-normal text-white sm:text-4xl">
					Music library
				</h1>
			</header>

			<div class="mt-6 max-w-4xl space-y-6">
				<section class="rounded-md border border-zinc-800 bg-zinc-950">
					<div class="border-b border-zinc-800 px-4 py-3">
						<div class="flex items-center justify-between gap-3">
							<h2 class="text-sm font-medium text-white">Parsed folders</h2>
							<form method="POST" action="?/scanDirectories" use:enhance>
								<button
									class="h-9 rounded-md border border-zinc-700 px-3 text-sm text-zinc-300 hover:border-emerald-400 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
									type="submit"
									disabled={data.directories.length === 0}
								>
									Scan Now
								</button>
							</form>
						</div>
					</div>

					<form
						class="grid gap-3 border-b border-zinc-800 p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
						method="POST"
						action="?/addDirectory"
						use:enhance
					>
						<label>
							<span class="sr-only">Folder path</span>
							<input
								class="h-11 w-full rounded-md border border-zinc-700 bg-zinc-900 px-4 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-emerald-400"
								name="path"
								value={form?.path ?? ''}
								placeholder="/home/ruchir/Music"
								autocomplete="off"
							/>
						</label>
						<button
							class="h-11 rounded-md bg-emerald-500 px-4 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
							type="submit"
						>
							Save & Scan
						</button>
					</form>

					{#if form?.message}
						<div class="border-b border-zinc-800 px-4 py-3 text-sm text-amber-300">
							{form.message}
						</div>
					{/if}

					{#if data.directories.length === 0}
						<div class="px-4 py-10 text-center">
							<div class="text-sm font-medium text-white">No folders saved</div>
							<div class="mt-2 text-sm text-zinc-400">
								Add a local folder path to scan music from.
							</div>
						</div>
					{:else}
						<div class="divide-y divide-zinc-800">
							{#each data.directories as directory (directory.id)}
								<div class="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
									<div class="min-w-0">
										<div class="truncate text-sm font-medium text-white">{directory.path}</div>
										<div class="mt-1 text-xs text-zinc-500">Saved in SQLite local config</div>
									</div>
									<form method="POST" action="?/removeDirectory" use:enhance>
										<input type="hidden" name="path" value={directory.path} />
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
			</div>
		</section>
	</div>
</main>
