<script lang="ts">
	// Account control for the titlebar (context/15) — moved out of the sidebar so sign-in lives in the
	// top bar. Its own component because Titlebar.svelte already uses a single shared mx/my/menuOpen
	// for the Last.fm menu; a second menu in that file would fight over them.
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { UserCircleIcon, Logout01Icon, ArrowDown01Icon } from '@hugeicons/core-free-icons';
	import { Button } from '$lib/components/ui/button';
	import * as api from '$lib/api';
	import { auth, openChannelPicker, startGoogleSignIn, toast } from '$lib/player.svelte';
	import { thumb } from '$lib/thumb';

	let { foot = false }: { foot?: boolean } = $props();

	let menuOpen = $state(false);
	let mx = $state(0);
	let my = $state(0);

	function openMenu(e: MouseEvent) {
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		if (foot) {
			mx = r.left;
			my = window.innerHeight - r.top + 6;
		} else {
			mx = window.innerWidth - r.right;
			my = r.bottom + 6;
		}
		menuOpen = !menuOpen;
	}

	// Sign-in/out state arrives via the `auth-changed` event (player.svelte.ts), which also reloads
	// the library and remounts the page — nothing to assign here.
	async function doSignOut() {
		menuOpen = false;
		await api.signOut();
	}

	function signInGoogle() {
		menuOpen = false;
		void startGoogleSignIn();
	}

	function switchChannel() {
		menuOpen = false;
		openChannelPicker();
	}
</script>

<button
	onclick={openMenu}
	title={auth.account?.signedIn ? (auth.account.name ?? 'Account') : 'Sign in'}
	aria-expanded={menuOpen}
	class="flex cursor-pointer items-center gap-2 text-xs transition-colors hover:bg-white/[0.06] aria-expanded:bg-white/[0.06] {foot
		? 'h-8 w-full justify-start rounded-md px-2'
		: 'h-full px-2.5'}"
>
	{#if auth.account?.signedIn && auth.account.thumbnail}
		<!-- max-width:none defeats Tailwind Preflight's `img{max-width:100%}`, which in a tight box
		     clamps width to the content-box while height stays fixed → a vertical oval. Inline so it's
		     immune to Preflight and to stale dev CSS. -->
		<img
			src={thumb(auth.account.thumbnail, 64)}
			alt=""
			style="width:1.25rem;height:1.25rem;max-width:none"
			class="shrink-0 rounded-full object-cover ring-1 ring-border"
		/>
	{:else}
		<HugeiconsIcon icon={UserCircleIcon} class="h-5 w-5 shrink-0 text-muted-foreground" />
	{/if}
	<span class="max-w-28 truncate font-medium {foot ? '' : 'hidden lg:block'}">
		{auth.account?.signedIn ? (auth.account.name ?? 'Account') : 'Sign in'}
	</span>
	<HugeiconsIcon
		icon={ArrowDown01Icon}
		class="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 {foot
			? ''
			: 'hidden lg:block'} {menuOpen ? 'rotate-180' : ''}"
	/>
</button>

{#if menuOpen}
	<button
		class="fixed inset-0 z-40 cursor-default"
		onclick={() => (menuOpen = false)}
		aria-label="Close menu"
	></button>
	<div
		class="fixed z-50 w-72 animate-in rounded-xl border bg-popover p-4 text-popover-foreground shadow-xl duration-150 fade-in-0 zoom-in-95 {foot
			? 'origin-bottom-left'
			: 'origin-top-right'}"
		style={foot ? `left:${mx}px; bottom:${my}px` : `right:${mx}px; top:${my}px`}
	>
		{#if auth.account?.signedIn}
			<div class="mb-3">
				<div class="truncate text-sm font-medium">{auth.account.name ?? 'Account'}</div>
				{#if auth.account.handle || auth.account.email}
					<div class="truncate text-xs text-muted-foreground">
						{auth.account.handle ?? auth.account.email}
					</div>
				{/if}
			</div>
			{#if auth.account.canSwitch}
				<Button variant="outline" size="sm" class="mb-2 w-full gap-2" onclick={switchChannel}>
					<HugeiconsIcon icon={UserCircleIcon} class="h-4 w-4" />
					Switch channel
				</Button>
			{/if}
			<Button variant="outline" size="sm" class="w-full gap-2" onclick={doSignOut}>
				<HugeiconsIcon icon={Logout01Icon} class="h-4 w-4" />
				Sign out
			</Button>
		{:else}
			<p class="text-sm font-medium">Sign in</p>
			<p class="mt-1 text-xs text-muted-foreground">
				Sign in with your Google account to reach your YouTube Music library and playlists.
			</p>
			<Button class="mt-3 w-full" onclick={signInGoogle}>Sign in with Google</Button>
			<Button
				variant="outline"
				class="mt-2 w-full"
				onclick={async () => {
					menuOpen = false;
					try {
						await api.importBrowserCookies();
						toast.success('Imported from your browser');
					} catch (e) {
						toast.error(String(e));
					}
				}}>I've signed in</Button>
			>
		{/if}
	</div>
{/if}
