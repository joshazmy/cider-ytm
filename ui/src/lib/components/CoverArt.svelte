<script lang="ts">
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { MusicNote01Icon } from '@hugeicons/core-free-icons';
	import { coverCandidates } from '$lib/thumb';

	let {
		url,
		videoId,
		size,
		alt = '',
		imgClass = 'h-full w-full object-cover'
	}: {
		url?: string | null;
		videoId?: string | null;
		size: number;
		alt?: string;
		imgClass?: string;
	} = $props();

	let attempt = $state(0);
	$effect(() => {
		url;
		videoId;
		attempt = 0;
	});
	const srcs = $derived(coverCandidates(url, videoId, size));
	const src = $derived(srcs[attempt]);
</script>

{#if src && attempt < srcs.length}
	<img
		{src}
		{alt}
		class={imgClass}
		style="max-width:none"
		decoding="async"
		onerror={() => (attempt += 1)}
	/>
{:else}
	<span class="flex h-full w-full items-center justify-center text-muted-foreground/45">
		<HugeiconsIcon icon={MusicNote01Icon} strokeWidth={2} class="h-[40%] w-[40%] max-h-8 max-w-8" />
	</span>
{/if}
