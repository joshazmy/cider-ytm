<script lang="ts">
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { UserGroup02Icon, RefreshIcon } from '@hugeicons/core-free-icons';
	import { playback, ui } from '$lib/player.svelte';
	import { lt } from '$lib/lt.svelte';
	import { isLetterTile, thumb } from '$lib/thumb';

	// Google's CDN doesn't serve every rewritten size, so a 404'd backdrop must degrade to nothing
	// rendered, never a broken-image glyph. Re-arm whenever the track changes, mirroring MediaCard.
	let { onRefresh }: { onRefresh?: () => void } = $props();
	let artFailed = $state(false);
	$effect(() => {
		playback.now?.thumbnail; // re-arm when the track changes
		artFailed = false;
	});
</script>

<!-- overflow-hidden lives on the backdrop wrapper, not the hero: the scaled blur has to be clipped,
     but the search preview below has to hang out past the bottom edge. -->
<div class="relative border-b">
	<div class="pointer-events-none absolute inset-0 overflow-hidden">
		{#if playback.now?.thumbnail && !artFailed && !isLetterTile(playback.now.thumbnail)}
			<!-- 96px, not display size: blur-2xl is a 40px blur, so every detail above a handful of
			     pixels is thrown away anyway. The old 1200px source decoded to 5.7 MiB for this, and
			     re-decoded on every track change. -->
			<img
				src={thumb(playback.now.thumbnail, 400)}
				alt=""
				class="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
				onerror={() => (artFailed = true)}
			/>
		{:else}
			<!-- Nothing playing: without this the header is a bare strip with a greeting in it. An accent
			     wash keeps it a header. Inline style so it can't be lost to a stale dev stylesheet, and it
			     rides --primary so every preset theme gets its own. -->
			<div
				class="pointer-events-none absolute inset-0 opacity-[0.18]"
				style="background:radial-gradient(120% 130% at 12% 0%, var(--primary) 0%, transparent 58%)"
			></div>
		{/if}
		<div
			class="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-background/25"
		></div>
		<div
			class="absolute inset-0 bg-gradient-to-r from-background/80 via-background/30 to-transparent"
		></div>
	</div>
	<div class="relative px-6 pt-5 pb-3">
		<div class="flex items-center justify-between gap-4">
			<h1 class="text-[1.15rem] font-semibold tracking-tight">Home</h1>
			<div class="flex items-center gap-1">
			{#if onRefresh}
				<button
					type="button"
					onclick={onRefresh}
					title="Refresh"
					aria-label="Refresh Home"
					class="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/8 hover:text-foreground"
				>
					<HugeiconsIcon icon={RefreshIcon} strokeWidth={2} class="h-4 w-4" />
				</button>
			{/if}
			<button
				onclick={() => (ui.ltOpen = true)}
				title="Listen Together"
				aria-label="Listen Together"
				class="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground {lt.role !==
				'none'
					? 'text-primary'
					: ''}"
			>
				<HugeiconsIcon icon={UserGroup02Icon} class="h-4 w-4" />
				{#if lt.role !== 'none'}
					<span
						class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background"
					></span>
				{/if}
			</button>
			</div>
		</div>
	</div>
</div>
