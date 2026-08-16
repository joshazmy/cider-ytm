<script lang="ts">
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { MusicNote01Icon, PlayIcon, UserIcon } from '@hugeicons/core-free-icons';
	import type { BrowseItem } from '$lib/api';
	import { thumb } from '$lib/thumb';
	import { asSong, openItem } from '$lib/browse';
	import { playSong } from '$lib/player.svelte';
	import ExplicitIcon from './ExplicitIcon.svelte';

	let { item }: { item: BrowseItem } = $props();

	const KIND: Record<BrowseItem['kind'], string> = {
		artist: 'Artist',
		album: 'Album',
		playlist: 'Playlist',
		song: 'Song'
	};

	const year = $derived(item.subtitle?.match(/\b(?:19|20)\d{2}\b/)?.[0]);
	const label = $derived(year ? `${year} · ${KIND[item.kind]}` : KIND[item.kind]);

	// Subtitle minus the kind word and year already shown in the micro-label.
	const byline = $derived.by(() => {
		if (!item.subtitle) return '';
		const skip = /^(song|album|artist|playlist|ep|single|video)$/i;
		return item.subtitle
			.split(/\s*[•·|]\s*/)
			.map((p) => p.trim())
			.filter((p) => p && !skip.test(p) && !/^(?:19|20)\d{2}$/.test(p))
			.join(' · ');
	});

	function activate() {
		if (item.kind === 'song') playSong(asSong(item));
		else openItem(item);
	}
</script>

<button
	type="button"
	onclick={activate}
	class="group flex w-full items-center gap-4 rounded-2xl bg-white/[0.04] px-3.5 py-3 text-left ring-1 ring-white/[0.04] transition hover:bg-white/[0.08] hover:ring-white/[0.08]"
>
	<div
		class="relative h-[72px] w-[72px] shrink-0 overflow-hidden bg-muted {item.kind === 'artist'
			? 'rounded-full'
			: 'rounded-xl'}"
	>
		{#if item.thumbnail}
			<img src={thumb(item.thumbnail, 200)} alt="" class="h-full w-full object-cover" />
		{:else}
			<div class="flex h-full w-full items-center justify-center text-muted-foreground/40">
				<HugeiconsIcon
					icon={item.kind === 'artist' ? UserIcon : MusicNote01Icon}
					class="h-7 w-7"
				/>
			</div>
		{/if}
		{#if item.kind === 'song'}
			<div
				class="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100"
			>
				<HugeiconsIcon icon={PlayIcon} class="h-6 w-6 text-white" />
			</div>
		{/if}
	</div>
	<div class="min-w-0 flex-1">
		<div class="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
			{label}
		</div>
		<div class="mt-0.5 flex items-center gap-1.5 truncate font-heading text-[15px] font-semibold">
			<span class="truncate">{item.title}</span>
			{#if item.explicit}
				<ExplicitIcon class="h-3 w-3 shrink-0 text-muted-foreground" />
			{/if}
		</div>
		{#if byline}
			<div class="truncate text-sm text-muted-foreground">{byline}</div>
		{/if}
	</div>
</button>
