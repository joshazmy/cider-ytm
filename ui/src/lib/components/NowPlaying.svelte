<script lang="ts">
	import { fly, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { beforeNavigate } from '$app/navigation';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		ArrowDown01Icon,
		Mic01Icon,
		MusicNote01Icon,
		PlayIcon,
		PauseIcon,
		Queue01Icon
	} from '@hugeicons/core-free-icons';
	import { np, playback, togglePlayUi } from '$lib/player.svelte';
	import { hiresCandidates } from '$lib/thumb';
	import ArtistLine from './ArtistLine.svelte';
	import QueueList from './QueueList.svelte';
	import LyricsView from './LyricsView.svelte';

	beforeNavigate(() => (np.open = false));
	function onWinKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && np.open) {
			e.preventDefault();
			np.open = false;
		}
	}

	let plate: HTMLDivElement | undefined = $state();
	$effect(() => {
		if (np.open) plate?.focus();
	});
	function onPlateKey(e: KeyboardEvent) {
		onWinKey(e);
	}

	let attempt = $state(0);
	$effect(() => {
		playback.now?.thumbnail;
		attempt = 0;
	});
	const srcs = $derived(hiresCandidates(playback.now?.thumbnail, 1600));
	const src = $derived(srcs[attempt]);
	const imgFailed = () => {
		if (attempt < srcs.length - 1) attempt++;
	};

	let flash: 'play' | 'pause' | null = $state(null);
	let flashTimer: ReturnType<typeof setTimeout>;
	function toggle() {
		flash = playback.paused ? 'play' : 'pause';
		clearTimeout(flashTimer);
		flashTimer = setTimeout(() => (flash = null), 220);
		togglePlayUi();
	}
</script>

<!-- Full-bleed plate over sidebar + rail (Cider immersive). The desk bar stays above this. -->
<svelte:window onkeydown={onWinKey} />
<div
	bind:this={plate}
	role="dialog"
	aria-modal="true"
	aria-label="Now playing"
	tabindex="-1"
	onkeydown={onPlateKey}
	transition:fly={{ y: '100%', duration: 320, easing: cubicOut }}
	class="absolute inset-0 z-20 isolate flex min-h-0 overflow-hidden bg-black outline-none"
>
	{#if src && attempt < srcs.length}
		<img
			{src}
			alt=""
			onerror={imgFailed}
			decoding="async"
			class="pointer-events-none absolute inset-0 h-full w-full object-cover"
		/>
	{:else}
		<div class="pointer-events-none absolute inset-0 flex items-center justify-center bg-black text-white/20">
			<HugeiconsIcon icon={MusicNote01Icon} class="h-20 w-20" />
		</div>
	{/if}
	<div class="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/30 via-black/10 to-black/50"></div>
	<div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/20"></div>

	<button
		type="button"
		onclick={() => (np.open = false)}
		class="absolute top-3 left-3 z-20 flex size-8 cursor-pointer items-center justify-center rounded-full bg-black/40 text-white/80 ring-1 ring-white/15 hover:bg-black/55 hover:text-white"
		aria-label="Close player"
	>
		<HugeiconsIcon icon={ArrowDown01Icon} class="h-4 w-4" />
	</button>

	<div class="relative flex min-h-0 w-full flex-1">
		<div class="relative hidden min-h-0 w-[48%] shrink-0 md:block">
		<button
			type="button"
			onclick={toggle}
			aria-label={playback.paused ? 'Play' : 'Pause'}
			class="absolute inset-0 cursor-pointer"
		>
			{#if flash}
				<div
					in:scale={{ start: 0.7, duration: 150, easing: cubicOut }}
					out:scale={{ start: 1.3, duration: 320, easing: cubicOut }}
					class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
				>
					<div class="rounded-full bg-black/55 p-4 text-white">
						{#if flash === 'play'}
							<HugeiconsIcon icon={PlayIcon} class="h-8 w-8" />
						{:else}
							<HugeiconsIcon icon={PauseIcon} class="h-8 w-8" />
						{/if}
					</div>
				</div>
			{/if}
			<div class="pointer-events-none absolute right-6 bottom-8 left-8 text-left">
				<div class="font-heading truncate text-[2.15rem] leading-tight font-semibold text-white drop-shadow-md">
					{playback.now?.title ?? ''}
				</div>
				<div class="pointer-events-auto mt-1.5 text-[1.05rem] text-white/75">
					<ArtistLine
						runs={playback.now?.artistRuns}
						text={playback.now?.artists ?? ''}
						class="text-white/75 hover:text-white"
					/>
				</div>
				{#if playback.now?.bitrate}
					<span
						class="mt-3 inline-block rounded bg-white/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white/90"
					>
						{playback.now.bitrate}
					</span>
				{/if}
			</div>
		</button>
		</div>

		<div class="flex min-h-0 min-w-0 flex-1 flex-col px-5 pt-3 pb-3 md:px-8">
			<div class="mb-2 flex items-center justify-end gap-1">
				<button
					type="button"
					onclick={() => (np.tab = 'queue')}
					class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] {np.tab === 'queue'
						? 'bg-white/20 text-white'
						: 'text-white/70 hover:text-white'}"
				>
					<HugeiconsIcon icon={Queue01Icon} class="h-4 w-4" /> Queue
				</button>
				<button
					type="button"
					onclick={() => (np.tab = 'lyrics')}
					class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] {np.tab === 'lyrics'
						? 'bg-white/20 text-white'
						: 'text-white/70 hover:text-white'}"
				>
					<HugeiconsIcon icon={Mic01Icon} class="h-4 w-4" /> Lyrics
				</button>
			</div>
			{#if np.tab === 'queue'}
				<div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-black/20 text-white">
					<QueueList upcomingOnly />
				</div>
			{:else}
				<LyricsView expanded onCover />
			{/if}
		</div>
	</div>
</div>
