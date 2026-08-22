<script module lang="ts">
	// Survives remounts (module scope), so coming back to /search — from a result you clicked, or
	// from the sidebar — shows the last search instead of a blank page. The results themselves come
	// back from the page cache, so the rerun paints instantly and just revalidates.
	let lastQuery = '';
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import MediaCardSkeleton from '$lib/components/MediaCardSkeleton.svelte';
	import SearchSuggest from '$lib/components/SearchSuggest.svelte';
	import TrackRow from '$lib/components/TrackRow.svelte';
	import TrackRowSkeleton from '$lib/components/TrackRowSkeleton.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import Shelf from '$lib/components/Shelf.svelte';
	import ResultStrip from '$lib/components/ResultStrip.svelte';
	import * as api from '$lib/api';
	import type { SearchResults } from '$lib/api';
	import { getCached, putCached } from '$lib/pagecache';
	import { openAddToPlaylist, openYtmUrl, playSong } from '$lib/player.svelte';
	import { asSong } from '$lib/browse';

	let query = $state(lastQuery);
	let res = $state<SearchResults | null>(null);
	let searched = $state('');
	let searching = $state(false);
	let error = $state<string | null>(null);

	// The query of the most recent runSearch call, so an older in-flight one can't clobber it.
	let latest = '';

	async function runSearch() {
		if (!query.trim()) return;
		if (await openYtmUrl(query)) return;
		const q = query;
		latest = q;
		lastQuery = q;
		const key = `search:${q}`;
		const hit = getCached<SearchResults>(key);
		if (hit) {
			res = hit;
			searched = q;
			searching = false;
		} else {
			searching = true;
		}
		error = null;
		try {
			const fresh = await api.searchAll(q);
			if (latest !== q) return; // a newer search superseded this one
			res = fresh;
			searched = q;
			putCached(key, fresh);
		} catch {
			if (latest !== q) return;
			if (!hit) error = 'Search is unavailable right now. Check your connection and try again.';
		} finally {
			if (latest === q) searching = false;
		}
	}

	function showMore(cat: 'songs' | 'albums' | 'artists' | 'playlists') {
		goto(`/search-more?${new URLSearchParams({ q: searched, cat }).toString()}`);
	}

	// Run the search when arriving with a ?q= (e.g. from the Home search box). Keyed on the URL
	// alone: typing a new query in the field must not look like a URL change and bounce us back.
	const urlQuery = $derived(page.url.searchParams.get('q') ?? '');
	let lastUrlQuery = '';
	$effect(() => {
		if (urlQuery && urlQuery !== lastUrlQuery) {
			lastUrlQuery = urlQuery;
			query = urlQuery;
			runSearch();
		}
	});

	// Arriving without a ?q= (back from a result, or the sidebar link): rerun whatever was last
	// searched. onMount, not the effect above, so a ?q= arrival still wins.
	onMount(() => {
		if (!urlQuery && query) runSearch();
	});

	// Cider order: top cards, artist circles, album covers, then a compact song list. Playlists
	// stay as a cover shelf after songs. `top` has no "show more".
	const sections = $derived(
		res
			? [
					{ key: 'top', label: 'Top results', items: res.top, max: 4, more: false, list: false },
					{ key: 'artists', label: 'Artists', items: res.artists, max: 6, more: true, list: false },
					{ key: 'albums', label: 'Albums', items: res.albums, max: 5, more: true, list: false },
					{ key: 'songs', label: 'Songs', items: res.songs, max: 6, more: true, list: true },
					{ key: 'playlists', label: 'Playlists', items: res.playlists, max: 5, more: true, list: false }
				].filter((s) => s.items.length)
			: []
	);

</script>

<div class="flex h-full flex-col">
	<div class="px-6 pb-4 pt-5">
		<form
			class="flex max-w-[45rem]"
			onsubmit={(e) => {
				e.preventDefault();
				runSearch();
			}}
		>
			<SearchSuggest
				bind:value={query}
				placeholder="Search songs, albums, artists, playlists…"
				inputClass="h-12 rounded-xl px-4 text-[15px]"
				onpick={() => (lastQuery = query)}
			/>
		</form>
		{#if error}<div class="mt-2"><ErrorState message={error} onRetry={runSearch} /></div>{/if}
	</div>

	<div class="min-h-0 flex-1 overflow-y-auto px-6 pb-10">
		{#if searching}
			<div class="flex flex-col gap-12">
				<section>
					<Skeleton class="mb-3 h-6 w-36 rounded" />
					<div class="grid grid-cols-1 gap-2 lg:grid-cols-2">
						{#each Array(4) as _, i (i)}
							<div class="flex items-center gap-4 rounded-2xl bg-white/[0.04] px-3.5 py-3">
								<Skeleton class="h-[72px] w-[72px] shrink-0 rounded-xl" />
								<div class="min-w-0 flex-1">
									<Skeleton class="mb-2 h-2.5 w-16 rounded" />
									<Skeleton class="mb-2 h-4 w-44 rounded" />
									<Skeleton class="h-3 w-28 rounded" />
								</div>
							</div>
						{/each}
					</div>
				</section>
				<section>
					<Skeleton class="mb-3 h-6 w-24 rounded" />
					<div class="flex gap-2 overflow-hidden pb-2">
						{#each Array(6) as _, i (i)}
							<div class="w-40 shrink-0"><MediaCardSkeleton round /></div>
						{/each}
					</div>
				</section>
				<section>
					<Skeleton class="mb-3 h-6 w-24 rounded" />
					<div class="flex gap-2 overflow-hidden pb-2">
						{#each Array(5) as _, i (i)}
							<div class="w-40 shrink-0"><MediaCardSkeleton /></div>
						{/each}
					</div>
				</section>
				<section>
					<Skeleton class="mb-3 h-6 w-20 rounded" />
					{#each Array(6) as _, i (i)}
						<TrackRowSkeleton />
					{/each}
				</section>
			</div>
		{:else if !res}
			<p class="text-sm text-muted-foreground">Search for a song, album, artist, or playlist.</p>
		{:else if !sections.length}
			<p class="text-sm text-muted-foreground">No results for “{searched}”.</p>
		{:else}
			<div class="content-in flex flex-col gap-12">
				{#each sections as sec (sec.key)}
					<section>
						<div class="mb-3 flex items-center justify-between">
							<h2 class="font-heading text-lg font-semibold">{sec.label}</h2>
							{#if sec.more}
								<button
									class="cursor-pointer text-xs font-semibold uppercase text-muted-foreground hover:text-foreground"
									onclick={() => showMore(sec.key as 'songs' | 'albums' | 'artists' | 'playlists')}
								>
									Show more
								</button>
							{/if}
						</div>
						{#if sec.key === 'top'}
							<div class="grid grid-cols-1 gap-2 lg:grid-cols-2">
								{#each sec.items.slice(0, sec.max) as item (item.id)}
									<ResultStrip {item} />
								{/each}
							</div>
						{:else if sec.list}
							{#each sec.items.slice(0, sec.max) as item (item.id)}
								{@const song = asSong(item)}
								<TrackRow {song} onplay={() => playSong(song)} onAdd={() => openAddToPlaylist(song)} />
							{/each}
						{:else}
							<Shelf items={sec.items.slice(0, sec.max)} />
						{/if}
					</section>
				{/each}
			</div>
		{/if}
	</div>
</div>
