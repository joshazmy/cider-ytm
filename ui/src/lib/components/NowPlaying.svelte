<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { beforeNavigate } from '$app/navigation';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		ArrowDown01Icon,
		Mic01Icon,
		PlayIcon,
		PauseIcon,
		Queue01Icon
	} from '@hugeicons/core-free-icons';
	import { np, playback, togglePlayUi } from '$lib/player.svelte';
	import { coverCandidates } from '$lib/thumb';
	import ArtistLine from './ArtistLine.svelte';
	import CoverArt from './CoverArt.svelte';
	import QueueList from './QueueList.svelte';
	import LyricsView from './LyricsView.svelte';
	import { reducedMotion } from '$lib/theme.svelte';

	const NOW_PLAYING_TABS = ['queue', 'lyrics'] as const;

	beforeNavigate(() => (np.open = false));
	function onWinKey(e: KeyboardEvent) {
		if (!e.defaultPrevented && e.key === 'Escape' && np.open) {
			e.preventDefault();
			np.open = false;
		}
	}

	let plate: HTMLDivElement | undefined = $state();
	const still = $derived(reducedMotion());
	let returnFocus: HTMLElement | null = null;
	onMount(() => {
		returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const frame = requestAnimationFrame(() => plate?.focus());
		return () => {
			cancelAnimationFrame(frame);
			queueMicrotask(() => returnFocus?.focus());
		};
	});
	function plateFocusable() {
		if (!plate) return [];
		return Array.from(
			plate.querySelectorAll<HTMLElement>(
				'button:not([disabled]):not([tabindex="-1"]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
			)
		).filter((element) => element.offsetParent !== null);
	}
	function focusEdge(last: boolean) {
		const focusable = plateFocusable();
		(focusable[last ? focusable.length - 1 : 0] ?? plate)?.focus();
	}
	function onPlateKey(e: KeyboardEvent) {
		onWinKey(e);
		if (e.key !== 'Tab' || !plate) return;
		const focusable = plateFocusable();
		if (!focusable.length) {
			e.preventDefault();
			plate.focus();
			return;
		}
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		if (document.activeElement === plate) {
			e.preventDefault();
			(e.shiftKey ? last : first).focus();
			return;
		}
		if (e.shiftKey && document.activeElement === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault();
			first.focus();
		}
	}

	function selectNowPlayingTab(next: (typeof NOW_PLAYING_TABS)[number]) {
		np.tab = next;
	}

	function onNowPlayingTabKeydown(event: KeyboardEvent, index: number) {
		let next = index;
		if (event.key === 'Home') next = 0;
		else if (event.key === 'End') next = NOW_PLAYING_TABS.length - 1;
		else if (event.key === 'ArrowRight') next = (index + 1) % NOW_PLAYING_TABS.length;
		else if (event.key === 'ArrowLeft') next = (index - 1 + NOW_PLAYING_TABS.length) % NOW_PLAYING_TABS.length;
		else return;

		event.preventDefault();
		const tab = NOW_PLAYING_TABS[next];
		selectNowPlayingTab(tab);
		requestAnimationFrame(() => document.getElementById(`now-playing-tab-${tab}`)?.focus());
	}

	let attempt = $state(0);
	$effect(() => {
		playback.now?.thumbnail;
		attempt = 0;
	});
	const srcs = $derived(
		coverCandidates(playback.now?.thumbnail, playback.now?.videoId, 900)
	);
	const src = $derived(srcs[attempt]);
	const imgFailed = () => {
		attempt += 1;
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
<button
	type="button"
	aria-label="Wrap now playing focus to the end"
	class="pointer-events-none absolute size-px overflow-hidden opacity-0"
	onfocus={() => focusEdge(true)}
></button>
<div
	bind:this={plate}
	id="now-playing-dialog"
	role="dialog"
	aria-label="Now playing"
	tabindex="-1"
	onkeydown={onPlateKey}
	transition:fly={{ y: still ? 0 : '100%', duration: still ? 80 : 320, easing: cubicOut }}
	class="absolute inset-0 z-20 isolate flex min-h-0 overflow-hidden bg-background outline-none"
>
	{#if src && attempt < srcs.length}
		<img
			{src}
			alt=""
			onerror={imgFailed}
			decoding="async"
			class="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl"
		/>
	{:else}
		<div class="pointer-events-none absolute inset-0 bg-background"></div>
	{/if}
	<div class="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/40 via-black/20 to-black/55"></div>
	<div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/25"></div>

	<button
		type="button"
		onclick={() => (np.open = false)}
		class="desk-focus absolute top-3 left-3 z-20 flex size-11 cursor-pointer items-center justify-center rounded-lg bg-black/40 text-white/80 ring-1 ring-white/15 hover:bg-black/55 hover:text-white"
		aria-label="Close player"
	>
		<HugeiconsIcon icon={ArrowDown01Icon} class="h-4 w-4" />
	</button>

	<div class="relative flex min-h-0 w-full flex-1">
		<div data-immersive-artwork class="relative hidden min-h-0 w-[48%] shrink-0 min-[1100px]:block">
			<button
				type="button"
				onclick={toggle}
				aria-label={playback.paused ? 'Play' : 'Pause'}
				class="absolute inset-0 z-0 cursor-pointer"
			></button>
			<div class="pointer-events-none relative z-10 h-full">
				<div
					class="absolute top-[18%] right-10 left-10 aspect-square max-h-[58%] overflow-hidden rounded-2xl bg-black/30 shadow-[0_24px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/12"
				>
					<CoverArt
						url={playback.now?.thumbnail}
						videoId={playback.now?.videoId}
						size={720}
						imgClass="h-full w-full object-cover"
					/>
				</div>
				{#if flash}
					<div
						in:scale={{ start: still ? 1 : 0.7, duration: still ? 80 : 150, easing: cubicOut }}
						out:scale={{ start: still ? 1 : 1.3, duration: still ? 80 : 320, easing: cubicOut }}
						class="absolute inset-0 z-10 flex items-center justify-center"
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
				<div class="absolute right-6 bottom-28 left-8 text-left">
					<div class="font-heading truncate text-[2.15rem] leading-tight font-semibold text-white drop-shadow-md">
						{playback.now?.title ?? ''}
					</div>
					<div data-immersive-credits class="pointer-events-auto relative z-10 mt-1.5 text-[1.05rem] text-white/75">
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
			</div>
		</div>

		<div data-immersive-panel class="flex min-h-0 min-w-0 flex-1 flex-col px-5 pt-3 pb-24 min-[1100px]:px-8">
			<div class="mb-2 flex items-center justify-end gap-1" role="tablist" aria-label="Now playing view" aria-orientation="horizontal">
				<button
					type="button"
					id="now-playing-tab-queue"
					onclick={() => selectNowPlayingTab('queue')}
					onkeydown={(event) => onNowPlayingTabKeydown(event, 0)}
					role="tab"
					aria-label="Queue"
					aria-selected={np.tab === 'queue'}
					aria-controls="now-playing-queue"
					tabindex={np.tab === 'queue' ? 0 : -1}
					class="desk-focus flex h-11 items-center gap-1.5 rounded-lg px-3 text-[13px] {np.tab === 'queue'
						? 'bg-white/20 text-white'
						: 'text-white/70 hover:text-white'}"
				>
					<HugeiconsIcon icon={Queue01Icon} class="h-4 w-4" /> Queue
				</button>
				<button
					type="button"
					id="now-playing-tab-lyrics"
					onclick={() => selectNowPlayingTab('lyrics')}
					onkeydown={(event) => onNowPlayingTabKeydown(event, 1)}
					role="tab"
					aria-label="Lyrics"
					aria-selected={np.tab === 'lyrics'}
					aria-controls="now-playing-lyrics"
					tabindex={np.tab === 'lyrics' ? 0 : -1}
					class="desk-focus flex h-11 items-center gap-1.5 rounded-lg px-3 text-[13px] {np.tab === 'lyrics'
						? 'bg-white/20 text-white'
						: 'text-white/70 hover:text-white'}"
				>
					<HugeiconsIcon icon={Mic01Icon} class="h-4 w-4" /> Lyrics
				</button>
			</div>
			{#if np.tab === 'queue'}
				<div id="now-playing-queue" role="tabpanel" aria-labelledby="now-playing-tab-queue" class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card/85 text-white ring-1 ring-white/10 backdrop-blur-2xl">
					<QueueList upcomingOnly />
				</div>
			{:else}
				<div
					id="now-playing-lyrics"
					role="tabpanel"
					aria-labelledby="now-playing-tab-lyrics"
					class="flex min-h-0 flex-1 flex-col overflow-hidden"
				>
					<LyricsView expanded onCover />
				</div>
			{/if}
		</div>
	</div>
</div>
<button
	type="button"
	aria-label="Wrap now playing focus to the start"
	class="pointer-events-none absolute size-px overflow-hidden opacity-0"
	onfocus={() => focusEdge(false)}
></button>
