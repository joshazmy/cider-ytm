<script lang="ts">
	// Custom titlebar (undecorated window — tauri.conf `decorations: false`). The header is the
	// drag region; buttons stay ordinary children so they remain clickable. Chrome is quiet so the
	// album wash in +layout shows through: back/forward, account, window controls. Discord /
	// Last.fm / Listen Together stay mounted but `hidden`.
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		ArrowLeft01Icon,
		ArrowRight01Icon,
		MinusSignIcon,
		SquareIcon,
		Cancel01Icon,
		CheckmarkCircle01Icon,
		Loading03Icon,
		HotspotOfflineIcon,
		UserGroup02Icon
	} from '@hugeicons/core-free-icons';
	import LastFmIcon from './LastFmIcon.svelte';
	import * as api from '$lib/api';
	import { toast, ui } from '$lib/player.svelte';
	import { lt } from '$lib/lt.svelte';

	const win = getCurrentWindow();

	// Back/forward. `depth` is how many history entries deep the session is, `deepest` how far it
	// has ever been, so both buttons grey out instead of doing nothing. popstate carries a signed
	// delta (the mouse's side buttons come through here); anything else is a push, which wipes the
	// entries ahead of us.
	let depth = $state(0);
	let deepest = $state(0);
	afterNavigate((nav) => {
		if (nav.type === 'enter') depth = deepest = 0;
		else if (nav.delta !== undefined) depth = Math.max(0, depth + nav.delta);
		else deepest = depth += 1;
	});

	// Last.fm connection state. `connecting` is UI-local: set on click, cleared by the
	// `lastfm-state` event (success, failure, or timeout) — the backend always answers.
	let connected = $state(false);
	let username = $state<string | null>(null);
	let connecting = $state(false);
	let menuOpen = $state(false);
	let mx = $state(0);
	let my = $state(0);

	// Discord Rich Presence — a plain on/off toggle of the `discord_rpc` setting (the backend
	// connects/clears the presence the moment it flips). Optimistic; reverted on failure.
	let discordOn = $state(false);

	async function toggleDiscord() {
		const next = !discordOn;
		discordOn = next;
		try {
			await api.setSetting('discord_rpc', next ? 'true' : 'false');
			toast.success(next ? 'Discord presence on' : 'Discord presence off');
		} catch (e) {
			discordOn = !next;
			toast.error(String(e));
		}
	}

	onMount(() => {
		api.getSettings()
			.then((s) => (discordOn = s.discord_rpc === 'true'))
			.catch(() => {});
		api.lastfmStatus()
			.then((s) => {
				connected = s.connected;
				username = s.username ?? null;
			})
			.catch(() => {});
		const sub = api.onLastfmState((s) => {
			const wasConnecting = connecting;
			connecting = false;
			connected = s.connected;
			username = s.username ?? null;
			if (s.error) toast.error(s.error);
			else if (s.connected) toast.success(`Scrobbling as ${s.username}`);
			else if (!wasConnecting) toast.success('Last.fm disconnected');
		});
		return () => sub.then((u) => u());
	});

	async function onScrobblerClick(e: MouseEvent) {
		if (connecting) {
			// A second click cancels the pending browser authorization. The `lastfm-state` event it
			// triggers clears the spinner (and, arriving while `connecting`, stays toast-silent).
			api.lastfmDisconnect().catch(() => {});
			return;
		}
		if (connected) {
			openMenu(e);
			return;
		}
		connecting = true;
		try {
			await api.lastfmConnect();
			toast('Approve Yapel in your browser');
		} catch (err) {
			connecting = false;
			toast.error(String(err));
		}
	}

	function openMenu(e: MouseEvent) {
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		mx = window.innerWidth - r.right;
		my = r.bottom + 6;
		menuOpen = true;
	}

	function disconnect() {
		menuOpen = false;
		api.lastfmDisconnect().catch((e) => toast.error(String(e)));
	}

	const scrobblerTitle = $derived(
		connecting
			? 'Connecting to Last.fm — click to cancel'
			: connected
				? `Scrobbling as ${username}`
				: 'Scrobble to Last.fm'
	);
</script>

<!-- `relative` makes this a stacking context, so the account/window dropdowns inside it are capped
     at this z — it must outrank the panels below (LyricsPanel/QueuePanel, z-30). -->
<header
	data-tauri-drag-region
	class="relative z-50 flex h-11 shrink-0 select-none items-center justify-between border-b border-white/10 bg-background/95"
>
	<div class="flex h-full items-center pl-1">
		<div class="flex h-11 overflow-hidden">
			<button
				class="desk-focus flex size-11 items-center justify-center text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
				onclick={() => history.back()}
				disabled={depth === 0}
				title="Back"
				aria-label="Back"
			>
				<HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} class="h-4 w-4" />
			</button>
			<button
				class="desk-focus flex size-11 items-center justify-center text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
				onclick={() => history.forward()}
				disabled={depth === deepest}
				title="Forward"
				aria-label="Forward"
			>
				<HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} class="h-4 w-4" />
			</button>
		</div>
	</div>

	<div class="flex h-full items-center">
		<button
			type="button"
			data-global-action="listen-together"
			class="desk-focus relative flex h-11 min-w-11 items-center justify-center gap-2 px-3 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
			onclick={() => (ui.ltOpen = true)}
			aria-label="Listen Together"
			aria-haspopup="dialog"
			aria-expanded={ui.ltOpen}
			aria-pressed={lt.role !== 'none'}
		>
			<HugeiconsIcon icon={UserGroup02Icon} class="size-4" />
			<span class="hidden min-[1060px]:inline">Listen Together</span>
			{#if lt.role !== 'none'}
				<span class="absolute top-2 right-2 size-1.5 rounded-full bg-primary ring-2 ring-background"></span>
			{/if}
		</button>

		<!-- Listen Together / Discord / Last.fm live in Settings so the title strip cannot paint a
		     lone Discord "D" mark. -->
		<button
			class="hidden"
			onclick={onScrobblerClick}
			title={scrobblerTitle}
			aria-label={scrobblerTitle}
			tabindex="-1"
		>
			<span class="relative">
				<LastFmIcon class="h-4 w-4 {connecting ? 'animate-pulse opacity-60' : ''}" />
				{#if connecting}
					<HugeiconsIcon
						icon={Loading03Icon}
						strokeWidth={2.5}
						class="absolute -bottom-1.5 -right-2 h-3.5 w-3.5 animate-spin text-primary"
					/>
				{:else if connected}
					<!-- bg-background ring so the badge reads over the icon's stroke. -->
					<HugeiconsIcon
						icon={CheckmarkCircle01Icon}
						strokeWidth={2.5}
						class="absolute -bottom-1.5 -right-2 h-3.5 w-3.5 rounded-full bg-background text-primary"
					/>
				{/if}
			</span>
		</button>

		<div class="h-4 w-px bg-white/10"></div>

		<button
			class="desk-focus flex h-full w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
			onclick={() => win.minimize()}
			aria-label="Minimize"
		>
			<HugeiconsIcon icon={MinusSignIcon} strokeWidth={2} class="h-4 w-4" />
		</button>
		<button
			class="desk-focus flex h-full w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
			onclick={() => win.toggleMaximize()}
			aria-label="Maximize"
		>
			<HugeiconsIcon icon={SquareIcon} strokeWidth={2} class="h-3.5 w-3.5" />
		</button>
		<button
			class="desk-focus flex h-full w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-destructive/80 hover:text-white"
			onclick={() => win.close()}
			aria-label="Close"
		>
			<HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} class="h-4 w-4" />
		</button>
	</div>
</header>

{#if menuOpen}
	<button
		class="fixed inset-0 z-40 cursor-default"
		onclick={() => (menuOpen = false)}
		aria-label="Close menu"
	></button>
	<div
		class="fixed z-50 min-w-52 origin-top-right animate-in rounded-lg border bg-popover p-1 text-popover-foreground shadow-xl duration-150 fade-in-0 zoom-in-95"
		style="right:{mx}px; top:{my}px;"
	>
		<div class="flex items-center gap-2.5 px-2 py-2">
			<LastFmIcon class="h-4 w-4 shrink-0" />
			<div class="min-w-0">
				<div class="text-sm font-medium leading-tight">Last.fm</div>
				<div class="truncate text-xs text-muted-foreground">Scrobbling as {username}</div>
			</div>
		</div>
		<div class="mx-1 my-1 h-px bg-border"></div>
		<button
			class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10"
			onclick={disconnect}
		>
			<HugeiconsIcon icon={HotspotOfflineIcon} strokeWidth={2} class="h-4 w-4" /> Disconnect
		</button>
	</div>
{/if}
