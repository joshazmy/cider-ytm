<script lang="ts">
	// The search field plus its typeahead preview: type, wait 500ms, get a handful of real results
	// under the input. Runs the same `search_all` the search page runs and writes the same page-cache
	// key, so submitting a previewed query paints from cache instead of searching twice.
	//
	// Must live inside a <form>: Enter with nothing highlighted, and the "All results" row, fall
	// through to that form's onsubmit, which is where each caller decides what a full search means
	// (run it in place, or navigate to /search).
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { onDestroy } from 'svelte';
	import { Search01Icon, MusicNote01Icon, UserIcon } from '@hugeicons/core-free-icons';
	import { Input } from '$lib/components/ui/input';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import ExplicitIcon from './ExplicitIcon.svelte';
	import * as api from '$lib/api';
	import type { BrowseItem, SearchResults } from '$lib/api';
	import { getCached, putCached } from '$lib/pagecache';
	import { openItem } from '$lib/browse';
	import { thumb } from '$lib/thumb';
	import { library, local } from '$lib/player.svelte';

	let {
		value = $bindable(''),
		placeholder = 'Search',
		inputClass = '',
		/** Panel geometry. Default matches the field; a narrow field wants its own width. */
		panelClass = 'left-0 w-full max-w-[560px]',
		onpick
	}: {
		value?: string;
		placeholder?: string;
		inputClass?: string;
		panelClass?: string;
		/** Fired after a row is taken (played or navigated) — for callers that dismiss themselves. */
		onpick?: () => void;
	} = $props();
	const uid = $props.id();
	const listboxId = `${uid}-listbox`;
	const optionId = (index: number) => `${uid}-option-${index}`;

	let open = $state(false);
	let items = $state<BrowseItem[]>([]);
	let loading = $state(false);
	let loadError = $state('');
	let active = $state(-1); // keyboard-highlighted row, -1 = none (Enter submits the form)
	let loadedFor = ''; // query `items` belongs to, so a stale response can't land
	let debounce: ReturnType<typeof setTimeout> | undefined;
	let requestGeneration = 0;

	const KIND = { song: 'Song', album: 'Album', artist: 'Artist', playlist: 'Playlist' };

	/** A few rows across the categories rather than six songs: one top hit, then the mix. */
	function preview(r: SearchResults): BrowseItem[] {
		const out: BrowseItem[] = [];
		const seen = new Set<string>();
		const take = (from: BrowseItem[], n: number) => {
			for (const i of from) {
				if (n <= 0) break;
				if (seen.has(i.id)) continue;
				seen.add(i.id);
				out.push(i);
				n--;
			}
		};
		take(r.top, 1);
		take(r.songs, 3);
		take(r.artists, 1);
		take(r.albums, 1);
		take(r.playlists, 1);
		return out;
	}

	/**
	 * The quick picker remains useful with no Google session or network: items already owned by the
	 * desktop are searched locally, then de-duplicated with remote results when those arrive. Songs
	 * use the same BrowseItem projection as every other search/card path, so selecting one still
	 * enters the real player flow rather than a preview-only branch.
	 */
	function ownedMatches(q: string): BrowseItem[] {
		const needle = q.toLocaleLowerCase();
		const songs: BrowseItem[] = local.songs.map((song) => ({
			kind: 'song',
			id: song.video_id,
			title: song.title,
			subtitle: song.artists,
			duration: song.duration,
			thumbnail: song.thumbnail,
			artistRuns: song.artist_runs,
			explicit: song.explicit
		}));
		return [...local.albums, ...library.items, ...local.artists, ...songs]
			.filter((item) => `${item.title}\n${item.subtitle ?? ''}`.toLocaleLowerCase().includes(needle))
			.filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
			.slice(0, 7);
	}

	function mergePreview(owned: BrowseItem[], remote: BrowseItem[]): BrowseItem[] {
		const seen = new Set<string>();
		return [...owned, ...remote].filter((item) => {
			if (seen.has(item.id)) return false;
			seen.add(item.id);
			return true;
		}).slice(0, 7);
	}

	async function load(q: string, generation: number) {
		loadedFor = q;
		active = -1;
		loadError = '';
		const key = `search:${q}`;
		const owned = ownedMatches(q);
		items = owned;
		const hit = getCached<SearchResults>(key);
		if (hit) {
			if (generation !== requestGeneration) return;
			items = mergePreview(owned, preview(hit));
			loading = false;
			return;
		}
		loading = true;
		try {
			const fresh = await api.searchAll(q);
			if (loadedFor !== q || generation !== requestGeneration) return;
			putCached(key, fresh);
			items = mergePreview(owned, preview(fresh));
		} catch {
			if (loadedFor === q && generation === requestGeneration) {
				items = owned;
				loadError = owned.length
					? ''
					: 'Quick results are unavailable. Press Enter to run the full search.';
			}
		} finally {
			if (loadedFor === q && generation === requestGeneration) loading = false;
		}
	}

	// Reads the element, not `value`: the binding lands on this same event and the order of the two
	// listeners is not ours to assume.
	function onType(e: Event & { currentTarget: HTMLInputElement }) {
		clearTimeout(debounce);
		const generation = ++requestGeneration;
		const q = e.currentTarget.value.trim();
		if (q.length < 2) {
			close();
			return;
		}
		open = true;
		if (q !== loadedFor) {
			// Loading starts now, not when the timer fires: otherwise the empty panel reads as
			// "no results" for the whole debounce, on every query.
			items = [];
			loading = true;
		}
		debounce = setTimeout(() => load(q, generation), 500);
	}

	function close() {
		clearTimeout(debounce);
		requestGeneration += 1;
		open = false;
		loading = false;
		loadError = '';
		active = -1;
	}

	function choose(item: BrowseItem) {
		close();
		openItem(item); // a song plays, everything else opens its page
		onpick?.();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			e.preventDefault();
			close();
		} else if (e.key === 'Enter') {
			// Only a highlighted row is ours; a bare Enter is the caller's form submit.
			if (active >= 0 && items[active]) {
				e.preventDefault();
				choose(items[active]);
			} else {
				close();
			}
		} else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && items.length) {
			e.preventDefault();
			open = true;
			const n = items.length;
			active = e.key === 'ArrowDown' ? (active + 1) % n : (active <= 0 ? n : active) - 1;
		}
	}

	onDestroy(() => {
		clearTimeout(debounce);
		requestGeneration += 1;
	});
</script>

<!-- Rows preventDefault on mousedown, so focus never leaves the input while one is being clicked:
     anything that reaches focusout is a real move away from the field. -->
<div
	class="relative w-full min-w-0"
	onfocusout={(e) => {
		if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
	}}
>
	<Input
		bind:value
		{placeholder}
		class={inputClass}
		autocomplete="off"
		role="combobox"
		aria-label={placeholder}
		aria-autocomplete="list"
		aria-expanded={open}
		aria-controls={listboxId}
		aria-activedescendant={active >= 0 ? optionId(active) : undefined}
		oninput={onType}
		onkeydown={onKeydown}
		onfocus={() => {
			if (items.length && value.trim() === loadedFor) open = true;
		}}
	/>
		{#if open}
			<div
				data-search-panel
				class="absolute top-full z-50 mt-2 max-h-[calc(100vh-8rem)] overflow-y-auto overscroll-contain rounded-xl border bg-popover text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95 duration-150 {panelClass}"
		>
			<div id={listboxId} role="listbox" aria-label="Search preview" aria-busy={loading}>
				{#if loading && !items.length}
					{#each Array(4) as _, i (i)}
						<div data-search-loading-row class="flex items-center gap-3 px-3 py-2">
							<Skeleton class="h-10 w-10 shrink-0 rounded-md" />
							<div class="min-w-0 flex-1">
								<Skeleton class="h-3 w-40 rounded" />
								<Skeleton class="mt-2 h-2.5 w-24 rounded" />
							</div>
						</div>
					{/each}
				{:else if loadError}
					<div class="px-4 py-3 text-sm text-muted-foreground" role="status">{loadError}</div>
				{:else if !items.length}
					<div class="px-4 py-3 text-sm text-muted-foreground">Nothing quick for that.</div>
				{:else}
					{#each items as item, i (item.id)}
					{@const hero = i === 0}
					<button
						id={optionId(i)}
						type="button"
						role="option"
						tabindex="-1"
						aria-selected={i === active}
						class="relative flex w-full cursor-pointer items-center gap-3 px-3 text-left transition-colors {i ===
						active
							? 'bg-white/[0.08] before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary'
							: 'hover:bg-accent/40'} {hero ? 'border-b py-2.5' : 'py-1.5'}"
						onmousedown={(e) => e.preventDefault()}
						onmouseenter={() => (active = i)}
						onclick={() => choose(item)}
					>
						{#if item.thumbnail}
							<!-- 400, the same size the cards ask for: the CDN doesn't serve every rewritten size,
							     that one is verified, and the row lands on an image the grid already fetched. -->
							<img
								src={thumb(item.thumbnail, 400)}
								alt=""
								class="shrink-0 object-cover {item.kind === 'artist'
									? 'rounded-full'
									: 'rounded-md'} {hero ? 'h-12 w-12' : 'h-10 w-10'}"
							/>
						{:else}
							<div
								class="flex shrink-0 items-center justify-center bg-muted text-muted-foreground/50 {item.kind ===
								'artist'
									? 'rounded-full'
									: 'rounded-md'} {hero ? 'h-12 w-12' : 'h-10 w-10'}"
							>
								<HugeiconsIcon
									icon={item.kind === 'artist' ? UserIcon : MusicNote01Icon}
									class="h-5 w-5"
								/>
							</div>
						{/if}
						<div class="min-w-0 flex-1">
							<div class="truncate {hero ? 'font-semibold' : 'text-sm'}">{item.title}</div>
							<div class="flex items-center gap-1 text-xs text-muted-foreground">
								{#if item.explicit}
									<ExplicitIcon class="h-3 w-3 shrink-0" />
								{/if}
								<span class="truncate">
									{KIND[item.kind]}{item.subtitle ? ` • ${item.subtitle}` : ''}
								</span>
							</div>
						</div>
					</button>
					{/each}
				{/if}
			</div>
			<!-- submit, so the enclosing form decides what "all results" does. -->
			<button
				type="submit"
				class="flex min-h-11 w-full cursor-pointer items-center gap-2 border-t bg-muted/30 px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
				onmousedown={(e) => e.preventDefault()}
				onmouseenter={() => (active = -1)}
				onclick={close}
			>
				<HugeiconsIcon icon={Search01Icon} class="h-3.5 w-3.5" />
				All results for “{value.trim()}”
			</button>
		</div>
	{/if}
</div>
