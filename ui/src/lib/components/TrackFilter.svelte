<!--
	Filter box for a track list (playlist / album header).

	Purely client-side, over the rows already loaded. A long playlist arrives a page at a time, so
	the pages the sentinel hasn't fetched yet can't match; scrolling loads them as usual.
-->
<script module lang="ts">
	import type { SongItem } from '$lib/api';

	/** Substring match over title, artist and album. Empty query returns the list untouched. */
	export function filterTracks<T extends SongItem>(items: T[], query: string): T[] {
		const q = query.trim().toLowerCase();
		if (!q) return items;
		return items.filter(
			(t) =>
				t.title?.toLowerCase().includes(q) ||
				t.artists?.toLowerCase().includes(q) ||
				t.album?.toLowerCase().includes(q)
		);
	}
</script>

<script lang="ts">
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { SearchList01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';

	let {
		value = $bindable(''),
		placeholder = 'Search this list'
	}: { value?: string; placeholder?: string } = $props();
</script>

<div
	class="flex h-11 w-[min(280px,100%)] items-center gap-2 rounded-lg border border-white/10 bg-card/90 pl-3 shadow-sm focus-within:border-primary"
>
	<HugeiconsIcon
		icon={SearchList01Icon}
		strokeWidth={2.5}
		class="h-4 w-4 shrink-0 text-muted-foreground"
	/>
	<input
		bind:value
		{placeholder}
		aria-label={placeholder}
		class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
		onkeydown={(e) => e.key === 'Escape' && (value = '')}
	/>
	<!-- Holds its 1rem either way, so typing doesn't resize the box. -->
	<button
		class="desk-focus flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition hover:bg-white/8 hover:text-foreground"
		class:invisible={!value}
		onclick={() => (value = '')}
		aria-label="Clear search"
		tabindex={value ? 0 : -1}
	>
		<HugeiconsIcon icon={Cancel01Icon} strokeWidth={2.5} class="h-4 w-4" />
	</button>
</div>
