<script lang="ts">
	import { page } from '$app/state';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<main class="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
	<section class="w-full max-w-md rounded-md border border-zinc-800 bg-black p-6">
		<p class="text-sm font-medium tracking-[0.16em] text-emerald-400 uppercase">Private access</p>
		<h1 class="mt-3 text-3xl font-semibold tracking-normal text-white">Sign in</h1>
		<p class="mt-3 text-sm leading-6 text-zinc-400">
			Use your Google account to access your self-hosted music server.
		</p>

		{#if !data.googleOAuthConfigured || form?.message}
			<div
				class="mt-5 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-200"
			>
				{form?.message ??
					'Google OAuth is not configured yet. Add apps/web/.env and restart the dev server.'}
			</div>
		{/if}

		<form class="mt-6" method="POST">
			<input type="hidden" name="providerId" value="google" />
			<input
				type="hidden"
				name="redirectTo"
				value={page.url.searchParams.get('callbackUrl') ?? '/'}
			/>
			<button
				class="h-11 w-full rounded-md bg-emerald-500 px-4 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
				type="submit"
				disabled={!data.googleOAuthConfigured}
			>
				Continue with Google
			</button>
		</form>
	</section>
</main>
