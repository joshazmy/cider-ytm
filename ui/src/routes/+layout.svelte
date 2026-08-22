<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { ModeWatcher } from 'mode-watcher';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		CheckmarkCircle02Icon,
		AlertCircleIcon,
		InformationCircleIcon
	} from '@hugeicons/core-free-icons';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { appearance, initTheme, reducedMotion } from '$lib/theme.svelte';
	import { dragScroll } from '$lib/dnd';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Titlebar from '$lib/components/Titlebar.svelte';
	import ResizeBorders from '$lib/components/ResizeBorders.svelte';
	import PlayerBar from '$lib/components/PlayerBar.svelte';
	import QueuePanel from '$lib/components/QueuePanel.svelte';
	import LyricsPanel from '$lib/components/LyricsPanel.svelte';
	import AddToPlaylist from '$lib/components/AddToPlaylist.svelte';
	import SettingsDialog from '$lib/components/SettingsDialog.svelte';
	import ChannelPicker from '$lib/components/ChannelPicker.svelte';
	import ListenTogether from '$lib/components/ListenTogether.svelte';
	import MiniPlayer from '$lib/components/MiniPlayer.svelte';
	import NowPlaying from '$lib/components/NowPlaying.svelte';
	import NowPlayingRail from '$lib/components/NowPlayingRail.svelte';
	import CommandPalette from '$lib/components/CommandPalette.svelte';
	import { isLetterTile, thumb } from '$lib/thumb';
	let paletteOpen = $state(false);
	import {
		auth,
		initApp,
		np,
		openMiniPlayer,
		playback,
		togglePlayUi,
		ui
	} from '$lib/player.svelte';
	import * as playerApi from '$lib/api';
	import { win, initWin } from '$lib/win.svelte';


	let { children } = $props();
	type FocusPanel = 'queue' | 'lyrics';
	let activePanel = $state<FocusPanel | null>(null);
	let overlayReturn: HTMLElement | null = null;
	let widePanels = $state(browser && window.innerWidth >= 1100);
	const still = $derived(reducedMotion());

	function closeFocusedPanel() {
		const target = overlayReturn;
		activePanel = null;
		requestAnimationFrame(() => target?.focus());
	}

	function toggleFocusedPanel(panel: FocusPanel, trigger: HTMLElement) {
		if (np.open) {
			np.tab = panel;
			return;
		}
		// Wide layouts already dedicate the right rail to queue context. The same controls open the
		// immersive focused surface there; below 1100px they own the compact center overlay.
		if (window.innerWidth >= 1100) {
			np.tab = panel;
			np.open = true;
			return;
		}
		if (activePanel === panel) {
			closeFocusedPanel();
			return;
		}
		overlayReturn = trigger;
		activePanel = panel;
	}
	function reconcileFocusedPanel() {
		if (window.innerWidth < 1100 || !activePanel) return;
		const panel = activePanel;
		const trigger = overlayReturn;
		activePanel = null;
		trigger?.focus();
		requestAnimationFrame(() => {
			np.tab = panel;
			np.open = true;
		});
	}
	function onViewportResize() {
		widePanels = window.innerWidth >= 1100;
		reconcileFocusedPanel();
	}
	// The now-playing view carries its own queue and lyrics, so the side panels step aside for it
	// and the bar's two buttons switch its tabs instead of opening a panel on top of it.
	$effect(() => {
		if (np.open) activePanel = null;
	});

	// The mini player runs this same SPA in a second window (Rust `mini.rs`), so the window label is
	// what tells the two apart: `mini` gets the widget instead of the app chrome, and none of the
	// routes below it are ever rendered. Constant for the window's lifetime.
	const isMini = browser && getCurrentWindow().label === 'mini';

	// Apply the saved accent color before the first paint (ssr=false → nothing renders until now).
	if (browser) initTheme();

	// Wire the Tauri event bridge once for the whole app; teardown on destroy. Check for an update
	// on every app open (silent unless one exists).
	function onDeskKey(e: KeyboardEvent) {
		const el = e.target as HTMLElement | null;
		// Bits dialogs and owned transient panels keep the global command layer underneath them. This
		// prevents Ctrl+P (or a transport Space) from opening/changing content behind the topmost layer.
		if (el?.closest('[data-slot="dialog-content"], [data-overlay-panel]')) return;
		const typing =
			el &&
			(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
		if (typing) return;
		const interactive =
			el?.closest(
				'button, a[href], input, textarea, select, summary, [role="button"], [role="tab"], [role="switch"], [contenteditable="true"]'
			) ?? null;
		if (interactive && e.code === 'Space') return;
		if (e.code === 'Space' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
			e.preventDefault();
			togglePlayUi();
			return;
		}
		if (e.shiftKey && e.code === 'Space') {
			e.preventDefault();
			paletteOpen = true;
			return;
		}
		if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
		if (e.code === 'KeyP') {
			e.preventDefault();
			np.open = !np.open;
			if (np.open) np.tab = 'lyrics';
		} else if (e.code === 'KeyK') {
			e.preventDefault();
			openMiniPlayer();
		} else if (e.code === 'KeyF') {
			e.preventDefault();
			goto('/search');
		} else if (e.code === 'KeyH') {
			e.preventDefault();
			goto('/library');
		} else if (e.code === 'KeyL') {
			e.preventDefault();
			goto('/');
		} else if (e.code === 'KeyN') {
			e.preventDefault();
			goto('/library');
		} else if (e.code === 'Comma' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			ui.settingsOpen = true;
		} else if (e.code === 'Digit1') {
			e.preventDefault();
			goto('/library?tab=recent');
		} else if (e.code === 'Digit2') {
			e.preventDefault();
			goto('/library?tab=songs');
		} else if (e.code === 'Digit3') {
			e.preventDefault();
			goto('/library?tab=albums');
		} else if (e.code === 'Digit4') {
			e.preventDefault();
			goto('/library?tab=artists');
		} else if (e.code === 'ArrowUp') {
			e.preventDefault();
			const v = Math.min(100, playback.volume + 5);
			playback.volume = v;
			playerApi.setVolume(v);
		} else if (e.code === 'ArrowDown') {
			e.preventDefault();
			const v = Math.max(0, playback.volume - 5);
			playback.volume = v;
			playerApi.setVolume(v);
		}
	}

	onMount(() => {
		if (isMini) return initApp(true);
		if (!sessionStorage.getItem('ytm-desk-landed')) {
			sessionStorage.setItem('ytm-desk-landed', '1');
			if (appearance.startPage === 'library' && window.location.pathname === '/') {
				goto('/library', { replaceState: true });
			}
		}
		if (appearance.alwaysOnTop) getCurrentWindow().setAlwaysOnTop(true);
		const teardownApp = initApp();
		const teardownWin = initWin();
		window.addEventListener('keydown', onDeskKey);
		window.addEventListener('resize', onViewportResize);
		return () => {
			teardownApp();
			teardownWin();
			window.removeEventListener('keydown', onDeskKey);
			window.removeEventListener('resize', onViewportResize);
		};
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<ModeWatcher defaultMode="dark" />

<!-- The mini player is the whole window when it is the window: no titlebar, no sidebar, no routes,
     and no toasts (a banner would cover most of a 560x180 widget). -->
{#if isMini}
	<MiniPlayer />
{:else}
	<!-- The window itself is transparent; this root paints the background and, when not maximized,
	     rounds the corners (the compositor can't round an undecorated window for us). -->
	<div
		class="relative flex h-screen flex-col overflow-hidden bg-background text-foreground {win.maximized
			? ''
			: 'rounded-lg'}"
	>
		{#if appearance.artworkBackground && playback.now?.thumbnail && !isLetterTile(playback.now.thumbnail)}
			<img
				src={thumb(playback.now.thumbnail, 900)}
				alt=""
				class="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-3xl saturate-[1.35]"
			/>
			<div class="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/20 via-background/55 to-background/85"></div>
		{/if}
		<ResizeBorders />
		<div class="relative z-10 flex min-h-0 flex-1 flex-col">
					<Titlebar />
			<div class="relative flex min-h-0 flex-1">
				<Sidebar />
				<section
					class="desk-center relative min-w-0 flex-1 overflow-hidden bg-transparent"
					aria-label="Content"
					data-center-region
				>
					<main
						class="h-full min-w-0 overflow-y-auto bg-transparent {playback.now ? 'pb-[88px]' : ''}"
						{@attach dragScroll}
					>
						{#key auth.epoch}
							{@render children()}
						{/key}
					</main>
					{#if activePanel === 'lyrics'}
						<LyricsPanel onClose={closeFocusedPanel} />
					{:else if activePanel === 'queue'}
						<QueuePanel onClose={closeFocusedPanel} />
					{/if}
					{#if playback.now}
						<div class="absolute inset-x-3 bottom-2 z-40 h-[72px]">
							<PlayerBar
								onToggleQueue={(trigger) => toggleFocusedPanel('queue', trigger)}
								queueOpen={np.open ? np.tab === 'queue' : activePanel === 'queue'}
								queueControls={np.open || widePanels ? 'now-playing-dialog' : 'queue-panel'}
								onToggleLyrics={(trigger) => toggleFocusedPanel('lyrics', trigger)}
								lyricsOpen={np.open ? np.tab === 'lyrics' : activePanel === 'lyrics'}
								lyricsControls={np.open || widePanels ? 'now-playing-dialog' : 'lyrics-panel'}
							/>
						</div>
					{/if}
				</section>
				{#if playback.now}<NowPlayingRail />{/if}
				{#if np.open && playback.now}<NowPlaying />{/if}
			</div>
		</div>
	</div>

	<CommandPalette bind:open={paletteOpen} />
	<AddToPlaylist />
	<SettingsDialog />
	<ChannelPicker />
	<ListenTogether />

	{#if ui.toast}
		{@const t = ui.toast}
		<div
				transition:fly={{ y: still ? 0 : 16, duration: still ? 80 : 220, easing: cubicOut }}
			class="fixed bottom-40 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm shadow-lg"
		>
			<!-- Three branches instead of a ternary on `icon`: HugeiconsIcon freezes `icon` at mount, so a
			     new toast replacing a visible one would keep the old glyph. -->
			{#if t.kind === 'success'}
				<HugeiconsIcon icon={CheckmarkCircle02Icon} class="h-4 w-4 shrink-0 text-primary" />
			{:else if t.kind === 'error'}
				<HugeiconsIcon icon={AlertCircleIcon} class="h-4 w-4 shrink-0 text-destructive" />
			{:else}
				<HugeiconsIcon
					icon={InformationCircleIcon}
					class="h-4 w-4 shrink-0 text-muted-foreground"
				/>
			{/if}
			{t.msg}
		</div>
	{/if}
{/if}
