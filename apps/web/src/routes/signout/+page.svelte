<main class="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
	<section class="w-full max-w-md rounded-md border border-zinc-800 bg-black p-6">
		<p class="text-sm font-medium tracking-[0.16em] text-emerald-400 uppercase">Music Server</p>
		<h1 class="mt-3 text-3xl font-semibold tracking-normal text-white">Sign out</h1>
		<p class="mt-3 text-sm leading-6 text-zinc-400">
			End this browser session for your music server.
		</p>

		<form class="mt-6" method="POST">
			<input type="hidden" name="redirectTo" value="/signin" />
			<button
				class="h-11 w-full rounded-md border border-zinc-700 px-4 text-sm font-semibold text-zinc-200 hover:border-red-400 hover:text-red-300"
				type="submit"
			>
				Sign Out
			</button>
		</form>
	</section>
</main>
