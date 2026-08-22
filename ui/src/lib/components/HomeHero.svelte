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

<div class="relative min-h-[clamp(240px,38vh,340px)] overflow-hidden border-b border-white/10">
	<div class="pointer-events-none absolute inset-0 overflow-hidden">
		{#if playback.now?.thumbnail && !artFailed && !isLetterTile(playback.now.thumbnail)}
			<img
				src={thumb(playback.now.thumbnail, 400)}
				alt=""
				class="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-[0.32] blur-3xl saturate-75"
				onerror={() => (artFailed = true)}
			/>
		{:else}
			<div
				class="pointer-events-none absolute inset-0"
				style="background: radial-gradient(80% 110% at 12% 5%, rgb(74 70 81 / 0.34), transparent 66%), radial-gradient(70% 100% at 92% 0%, rgb(42 39 47 / 0.42), transparent 68%)"
			></div>
		{/if}
		<div class="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-background/20"></div>
		<div class="absolute inset-0 bg-gradient-to-r from-background/90 via-background/35 to-background/65"></div>
	</div>
	<div class="relative flex min-h-[clamp(240px,38vh,340px)] items-end justify-between gap-8 px-6 py-7 min-[1100px]:px-8">
		<div class="max-w-2xl">
			<h1 class="font-heading text-[clamp(2rem,5vw,3.25rem)] leading-[0.98] font-semibold tracking-[-0.035em]">
				Home
			</h1>
			<p class="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground min-[1100px]:text-[15px]">
				Your mixes, albums, artists, and recent listening — gathered into one calm place.
			</p>
			<div class="mt-5 flex flex-wrap items-center gap-2">
			{#if onRefresh}
				<button
					type="button"
					onclick={onRefresh}
					title="Refresh"
					aria-label="Refresh Home"
					class="desk-focus flex h-11 items-center justify-center gap-2 rounded-lg bg-foreground px-4 text-sm font-semibold text-background transition hover:bg-foreground/90"
				>
					<HugeiconsIcon icon={RefreshIcon} strokeWidth={2} class="h-4 w-4" />
					Refresh
				</button>
			{/if}
			<button
				onclick={() => (ui.ltOpen = true)}
				title="Listen Together"
				aria-label="Listen Together"
				class="desk-focus relative flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.055] px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/[0.09] hover:text-foreground {lt.role !==
				'none'
					? 'text-primary'
					: ''}"
			>
				<HugeiconsIcon icon={UserGroup02Icon} class="h-4 w-4" />
				Listen Together
				{#if lt.role !== 'none'}
					<span
						class="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary ring-2 ring-background"
					></span>
				{/if}
			</button>
			</div>
		</div>
		{#if playback.now?.thumbnail && !artFailed && !isLetterTile(playback.now.thumbnail)}
			<img
				src={thumb(playback.now.thumbnail, 400)}
				alt=""
				class="hidden size-[clamp(132px,17vw,188px)] shrink-0 rounded-2xl object-cover shadow-2xl ring-1 ring-white/12 min-[760px]:block"
				onerror={() => (artFailed = true)}
			/>
		{/if}
	</div>
</div>
