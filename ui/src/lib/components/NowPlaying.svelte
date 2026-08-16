<script lang="ts">
	import { fly, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { beforeNavigate } from '$app/navigation';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		Maximize01Icon,
		Minimize01Icon,
		Mic01Icon,
		MusicNote01Icon,
		PlayIcon,
		PauseIcon,
		Queue01Icon
	} from '@hugeicons/core-free-icons';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as api from '$lib/api';
	import { np, playback, togglePlayUi, ui } from '$lib/player.svelte';
	import { appearance } from '$lib/theme.svelte';
	import { thumb } from '$lib/thumb';
	import QueueList from './QueueList.svelte';
	import LyricsView from './LyricsView.svelte';

	// Going somewhere means the user wants that page, not this one: minimise. The player bar brings
	// it back. beforeNavigate (not a pathname effect) so clicking the tab you're already on counts.
	beforeNavigate(() => (np.open = false));

	// Enlarged lyrics take the whole view, artwork column and tab strip included. A class swap
	// rather than unmounting the tabs: LyricsView must survive it or it refetches and loses its
	// scroll position.
	let big = $state(false);
	$effect(() => {
		if (np.tab !== 'lyrics') big = false; // nothing to enlarge on the queue tab
	});

	// Google's CDN doesn't serve every rewritten size for every image (see MediaCard), and at this
	// size a broken-image glyph *is* the page. So step down until one loads: crisp, then the size
	// proven everywhere else in the app, then the 120 the player bar is already showing for this
	// very track, and only then a music note.
	let attempt = $state(0);
	let bgFailed = $state(false);
	$effect(() => {
		playback.now?.thumbnail; // re-arm on every track change
		attempt = 0;
		bgFailed = false;
	});
	const srcs = $derived([1200, 720, 400].map((px) => thumb(playback.now?.thumbnail, px)));
	const src = $derived(srcs[attempt]);
	const imgFailed = () => attempt++;

	// Clicking the artwork toggles playback, and flashes the action just taken over it so the click
	// visibly did something. Read `paused` before the toggle: the backend event that flips it is a
	// round trip away, and the icon has to be right on the frame the user clicked.
	let flash: 'play' | 'pause' | null = $state(null);
	let flashTimer: ReturnType<typeof setTimeout>;
	function toggle() {
		flash = playback.paused ? 'play' : 'pause';
		clearTimeout(flashTimer);
		flashTimer = setTimeout(() => (flash = null), 220);
		togglePlayUi();
	}
</script>

<!-- Fullscreen minus the sidebar only — the right now-playing rail is covered on purpose (Ctrl+P
     is not a sibling of that rail). The player bar stays in charge of transport and paints above
     this on the way in and out.
     z-20 matches the highest a page uses for its own chrome (home's sticky mood chips) and wins the
     tie on DOM order, since <main> is static and its z-indexes land in the same stacking context.
     ponytail: left offsets mirror Sidebar's w-16/lg:w-56 (and its manual collapse) — keep in sync
     if those change. -->
<div
	transition:fly={{ y: '100%', duration: 320, easing: cubicOut }}
	class="absolute inset-y-0 left-16 right-0 z-20 isolate flex justify-center overflow-hidden px-4 py-4 sm:px-6 sm:py-6 lg:px-10 {ui.sidebarCollapsed
		? ''
		: 'lg:left-56'}"
	style="background-color: var(--background)"
>
	<!-- Solid plate. The wash tints this; it must never punch a hole through to the page. -->
	<div class="pointer-events-none absolute inset-0" style="background-color: var(--background)"></div>
	{#if appearance.artworkBackground && srcs[2] && !bgFailed}
		<img
			src={srcs[2]}
			alt=""
			onerror={() => (bgFailed = true)}
			class="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-40 blur-3xl saturate-150 dark:opacity-45"
		/>
		<div
			class="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/80 via-background/65 to-background/90"
		></div>
	{/if}

	<!-- Capped and centred, so a wide window doesn't park the artwork in the middle of an empty half
	     with the tabs glued to the right edge. --art is the artwork's side: whichever is smaller of
	     the column's width and the height left over once the titlebar, the player bar and this
	     padding have had theirs. 0.86 keeps the square huge without colliding with the bar.
	     ponytail: 11rem is those three measured, not computed. -->
	<div
		class="relative flex w-full max-w-[80rem] gap-6 xl:gap-12"
		style="--art:calc(min(100%,100vh - 11rem) * 0.86)"
	>
		{#if !big}
			<!-- Centred against the full height of the column on the right. Below md there isn't room
			     for both columns, and the queue wins. -->
			<div class="hidden min-w-0 flex-1 items-center justify-center md:flex">
				<button
					type="button"
					onclick={toggle}
					aria-label="Play/pause"
					class="relative w-full max-w-[var(--art)] cursor-pointer"
				>
					{#if flash}
						<!-- No backdrop-blur: re-blurring the plate on every frame of the scale is what made
						     this stutter on WebKitGTK. Transform and opacity only. -->
						<div
							in:scale={{ start: 0.7, duration: 150, easing: cubicOut }}
							out:scale={{ start: 1.3, duration: 320, easing: cubicOut }}
							class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
						>
							<div class="rounded-full bg-black/55 p-3.5 text-white">
								{#if flash === 'play'}
									<HugeiconsIcon icon={PlayIcon} class="h-7 w-7" />
								{:else}
									<HugeiconsIcon icon={PauseIcon} class="h-7 w-7" />
								{/if}
							</div>
						</div>
					{/if}
					{#if src && attempt < srcs.length}
						<img
							{src}
							alt=""
							onerror={imgFailed}
							class="aspect-square w-full rounded-[1.75rem] object-cover ring-1 ring-white/10"
							style="box-shadow: 0 18px 36px -12px rgb(0 0 0 / 0.55), 0 40px 80px -18px rgb(0 0 0 / 0.65), 0 70px 140px -24px rgb(0 0 0 / 0.55)"
						/>
					{:else}
						<div
							class="flex aspect-square w-full items-center justify-center rounded-[1.75rem] bg-muted text-muted-foreground/40"
							style="box-shadow: 0 18px 36px -12px rgb(0 0 0 / 0.55), 0 40px 80px -18px rgb(0 0 0 / 0.65)"
						>
							<HugeiconsIcon icon={MusicNote01Icon} class="h-16 w-16" />
						</div>
					{/if}
				</button>
			</div>
		{/if}

		<div class="flex min-h-0 flex-col {big ? 'flex-1' : 'w-full md:w-[22rem] xl:w-[26rem]'}">
			<Tabs.Root
				value={np.tab}
				onValueChange={(v) => (np.tab = v as typeof np.tab)}
				class="min-h-0 flex-1"
			>
				<div class="flex items-center gap-2 {big ? 'justify-end' : ''}">
					<!-- Dark pills, not the default muted segment: each trigger is its own capsule
					     inside a darker track. Same two glyphs the player bar uses. -->
					<Tabs.List
						class={big
							? 'hidden'
							: 'h-9 flex-1 gap-1 rounded-full bg-foreground/8 p-1 shadow-none'}
					>
						<Tabs.Trigger
							value="queue"
							class="h-full gap-2 rounded-full border-0 bg-transparent px-3 text-[13px] font-medium text-muted-foreground shadow-none data-active:bg-foreground/15 data-active:text-foreground dark:data-active:border-transparent dark:data-active:bg-foreground/15"
						>
							<HugeiconsIcon icon={Queue01Icon} class="h-4 w-4" /> Queue
						</Tabs.Trigger>
						<Tabs.Trigger
							value="lyrics"
							class="h-full gap-2 rounded-full border-0 bg-transparent px-3 text-[13px] font-medium text-muted-foreground shadow-none data-active:bg-foreground/15 data-active:text-foreground dark:data-active:border-transparent dark:data-active:bg-foreground/15"
						>
							<HugeiconsIcon icon={Mic01Icon} class="h-4 w-4" /> Lyrics
						</Tabs.Trigger>
					</Tabs.List>
					{#if np.tab === 'lyrics'}
						<button
							onclick={() => (big = !big)}
							class="cursor-pointer rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
							aria-label={big ? 'Shrink lyrics' : 'Enlarge lyrics'}
						>
							<!-- icon swap via altIcon/showAlt: `icon` is frozen at mount -->
							<HugeiconsIcon
								icon={Maximize01Icon}
								altIcon={Minimize01Icon}
								showAlt={big}
								class="h-4 w-4"
							/>
						</button>
					{/if}
				</div>
				<!-- Only the open tab is mounted: bits-ui keeps inactive content in the DOM, which would
				     leave LyricsView fetching lyrics for every track you never asked to see. -->
				{#if np.tab === 'queue'}
					<Tabs.Content value="queue" class="flex min-h-0 flex-col">
						<QueueList />
					</Tabs.Content>
				{:else}
					<Tabs.Content value="lyrics" class="flex min-h-0 flex-col">
						<LyricsView expanded={big} />
					</Tabs.Content>
				{/if}
			</Tabs.Root>
		</div>
	</div>
</div>
