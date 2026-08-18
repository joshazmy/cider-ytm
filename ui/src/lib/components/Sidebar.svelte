<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		Home01Icon,
		Search01Icon,
		LibraryIcon,
		Clock01Icon,
		MusicNoteSquare02Icon,
		UserSharingIcon,
		Settings01Icon,
		Add01Icon,
		Cancel01Icon,
		MusicNote01Icon,
		StarIcon,
		ListRestartIcon,
		SquareArrowLeft01Icon,
		SquareArrowRight01Icon
	} from '@hugeicons/core-free-icons';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Dialog from '$lib/components/ui/dialog';
	import { ON_REPEAT_ID, type BrowseItem } from '$lib/api';
	import { thumb } from '$lib/thumb';
	import PlaylistMenu from './PlaylistMenu.svelte';
	import {
		auth,
		library,
		personal,
		ui,
		createLibraryPlaylist,
		toggleSidebar,
		toast,
		startGoogleSignIn
	} from '$lib/player.svelte';
	import { mergeSaved, orderLibrary } from '$lib/personal';
	import * as api from '$lib/api';
	import AccountMenu from './AccountMenu.svelte';

	const nav = [
		{ href: '/', label: 'Home', icon: Home01Icon },
		{ href: '/library', label: 'Library', icon: LibraryIcon },
		{ href: '/library?tab=recent', label: 'Recently Added', icon: Clock01Icon },
		{ href: '/playlist/FEmusic_liked_videos', label: 'Songs', icon: MusicNote01Icon },
		{ href: '/playlist/VLLM', label: 'Liked Music', icon: StarIcon },
		{ href: '/library?tab=albums', label: 'Albums', icon: MusicNoteSquare02Icon },
		{ href: '/library?tab=artists', label: 'Artists', icon: UserSharingIcon }
	];
	const isActive = (href: string) => {
		if (href === '/') return page.url.pathname === '/';
		if (href.startsWith('/playlist/')) return page.url.pathname === href;
		if (href.includes('tab=')) {
			if (page.url.pathname !== '/library') return false;
			return page.url.searchParams.get('tab') === href.split('tab=')[1];
		}
		return page.url.pathname === '/library' && !page.url.searchParams.get('tab');
	};

	// Pinned first (in pin order), then everything else by last played. Derived here rather than in
	// the shared `library` store so the Library page keeps YouTube's own ordering. Playlists saved
	// on this machine sit in the same list: signed out they are the only ones there.
	const playlists = $derived(
		orderLibrary(mergeSaved(personal, library.items, 'playlist'), personal)
	);
	// How many of the leading rows are pinned — a rule under the last one explains the split.
	const pinnedCount = $derived(playlists.filter((p) => personal.pins.includes(p.id)).length);

	const playlistHref = (item: BrowseItem) =>
		item.kind === 'album'
			? `/album/${encodeURIComponent(item.id)}`
			: item.kind === 'artist'
				? `/artist/${encodeURIComponent(item.id)}`
				: `/playlist/${encodeURIComponent(item.id)}`;

	// New-playlist dialog (mirrors the Library page).
	let dialogOpen = $state(false);
	let newTitle = $state('');
	let creating = $state(false);
	async function createNew() {
		const title = newTitle.trim();
		if (!title || creating) return;
		creating = true;
		try {
			await createLibraryPlaylist(title);
			toast.success(`Created "${title}"`);
			newTitle = '';
			dialogOpen = false;
		} catch (e) {
			toast.error(String(e));
		} finally {
			creating = false;
		}
	}

	// Account sits at the rail foot.

	// Manual collapse is a large-screen preference: below lg the rail is already collapsed by the
	// breakpoint, so the button is hidden there and `wide()` has nothing to drop. Every expanded
	// style is an `lg:` class, so collapsing is just not emitting them. The flag lives in `ui`
	// because the overlays that offset by the sidebar's width read it too.
	const collapsed = $derived(ui.sidebarCollapsed);
	const wide = (cls: string) => (collapsed ? '' : cls);

	// Compact field at the top of the rail. Empty submit still opens /search; the page reads `q`.
	let searchQ = $state(page.url.searchParams.get('q') ?? '');
	function submitSearch() {
		const q = searchQ.trim();
		goto(q ? `/search?${new URLSearchParams({ q })}` : '/search');
	}

	const navRow =
		'group flex h-8 items-center justify-center gap-2 rounded-md px-2 text-[13px] transition-colors';
</script>

<aside
	class="flex h-full shrink-0 flex-col bg-transparent px-1.5 py-2 text-sidebar-foreground {collapsed
		? 'w-16'
		: 'w-60'}"
>
	<!-- Search sits first, like the live desktop rail. Icon-only on the 64px column. -->
	<a
		href="/search"
		title="Search"
		class="mx-auto flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground {collapsed
			? ''
			: 'hidden'} {page.url.pathname.startsWith('/search') ? 'text-foreground' : ''}"
	>
		<HugeiconsIcon icon={Search01Icon} strokeWidth={2} class="h-4 w-4" />
	</a>
	<form
		class="relative mx-0.5 hidden {wide('block')}"
		onsubmit={(e) => {
			e.preventDefault();
			submitSearch();
		}}
	>
		<HugeiconsIcon
			icon={Search01Icon}
			strokeWidth={2}
			class="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
		/>
		<input
			bind:value={searchQ}
			type="text"
			placeholder="Search"
			autocomplete="off"
			aria-label="Search"
			class="h-8 w-full rounded-lg border-0 bg-black/40 pl-7 text-[13px] text-foreground outline-none ring-1 ring-white/10 placeholder:text-muted-foreground/70 focus:bg-black/50 {searchQ
				? 'pr-14'
				: 'pr-8'}"
		/>
		{#if searchQ}
			<button
				type="button"
				class="absolute top-1/2 right-7 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
				aria-label="Clear search"
				onclick={() => (searchQ = '')}
			>
				<HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} class="h-3.5 w-3.5" />
			</button>
		{/if}
		<button
			type="submit"
			class="absolute top-1/2 right-1.5 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
			aria-label="Submit search"
		>
			<HugeiconsIcon icon={Search01Icon} strokeWidth={2} class="h-3.5 w-3.5" />
		</button>
	</form>

	<!-- Tools sit on the Library label when wide; stack under search on the icon rail. -->
	<div class="mt-1 flex flex-col items-center gap-0.5 {collapsed ? '' : 'hidden'}">
		<Button
			variant="ghost"
			size="icon-sm"
			class="hidden hover:text-primary lg:inline-flex"
			onclick={toggleSidebar}
			aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
		>
			<HugeiconsIcon
				icon={SquareArrowLeft01Icon}
				altIcon={SquareArrowRight01Icon}
				showAlt={collapsed}
				strokeWidth={2}
				class="h-4 w-4"
			/>
		</Button>
	</div>

	<div class="mt-2 hidden items-center justify-between px-2 {wide('flex')}">
		<span class="text-[11px] text-muted-foreground">Library</span>
		<Button
			variant="ghost"
			size="icon-sm"
			class="hidden h-6 w-6 hover:text-primary lg:inline-flex"
			onclick={toggleSidebar}
			aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
		>
			<HugeiconsIcon
				icon={SquareArrowLeft01Icon}
				altIcon={SquareArrowRight01Icon}
				showAlt={collapsed}
				strokeWidth={2}
				class="h-3.5 w-3.5"
			/>
		</Button>
	</div>

	<nav class="mt-0.5 flex flex-col">
		{#each nav as n (n.href)}
			<a
				href={n.href}
				title={n.label}
				class="{navRow} {wide('justify-start')} {isActive(n.href)
					? 'bg-primary text-primary-foreground'
					: 'text-sidebar-foreground/55 hover:bg-white/[0.05] hover:text-sidebar-foreground'}"
			>
				<HugeiconsIcon icon={n.icon} strokeWidth={2} class="h-[18px] w-[18px] shrink-0" />
				<span class="hidden {wide('inline')}">{n.label}</span>
			</a>
		{/each}
	</nav>

	<!-- Playlists. Hidden on the icon rail (needs labels; matches YTM's collapsed rail). flex-1 lets
	     the list fill the space and scroll. Signed out the section still appears once there is
	     something in it: On Repeat, or a playlist saved on this machine. -->
	<div class="mt-2 hidden min-h-0 flex-1 flex-col {wide('flex')}">
		<span class="px-2 pb-0.5 text-[11px] text-muted-foreground">Playlists</span>
			<!-- Creating one is a YouTube write action, so it needs an account. -->
			{#if auth.account?.signedIn}
				<button
					type="button"
					class="flex h-8 w-full items-center gap-2 rounded-md px-2 text-[13px] text-sidebar-foreground/55 transition-colors hover:bg-foreground/5 hover:text-sidebar-foreground"
					onclick={() => (dialogOpen = true)}
				>
					<HugeiconsIcon icon={Add01Icon} strokeWidth={2} class="h-3.5 w-3.5 shrink-0" />
					Create New
				</button>
			{/if}
			<div class="min-h-0 flex-1 overflow-y-auto">
				{#each playlists as pl, i (pl.id)}
					{@const onThis = page.url.pathname.includes(encodeURIComponent(pl.id))}
					{@const isPin = personal.pins.includes(pl.id)}
					<!-- The ⋯ is a sibling of the link, not a child: a <button> inside an <a> is invalid
					     HTML. pr-8 keeps the title clear of the button that overlays the row on hover. -->
					<div class="group/row relative">
						<a
							href={playlistHref(pl)}
							title={pl.title}
							class="flex h-8 items-center gap-2 rounded-full py-0 pr-8 pl-1.5 transition-colors {onThis
								? 'bg-primary text-primary-foreground'
								: 'text-sidebar-foreground/85 hover:bg-foreground/6'}"
						>
							<div
								class="relative shrink-0 overflow-hidden rounded-full bg-muted {isPin
									? 'h-5 w-5'
									: 'h-7 w-7'}"
							>
								{#if pl.thumbnail && pl.id !== ON_REPEAT_ID}
									<img
										src={thumb(pl.thumbnail, 96)}
										alt=""
										class="h-full w-full object-cover"
										loading="lazy"
									/>
								{:else}
									<!-- On Repeat has no artwork by nature: icon tile, same as its card. -->
									<div
										class="flex h-full w-full items-center justify-center {pl.id === ON_REPEAT_ID
											? onThis
												? 'text-primary-foreground'
												: 'bg-primary/10 text-primary'
											: 'text-muted-foreground/50'}"
									>
										<!-- altIcon/showAlt, not a ternary: `icon` is read once at mount. -->
										<HugeiconsIcon
											icon={MusicNote01Icon}
											altIcon={ListRestartIcon}
											showAlt={pl.id === ON_REPEAT_ID}
											strokeWidth={2}
											class={pl.id === ON_REPEAT_ID ? 'h-3.5 w-3.5' : 'h-3 w-3'}
										/>
									</div>
								{/if}
							</div>
							<div class="min-w-0 flex-1 truncate text-[13px]">{pl.title}</div>
						</a>
						<PlaylistMenu
							item={pl}
							iconClass="h-3.5 w-3.5"
							triggerClass="absolute right-0.5 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md opacity-0 transition hover:bg-foreground/10 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover/row:opacity-100 {onThis
								? 'text-primary-foreground/80'
								: 'text-muted-foreground hover:text-foreground'}"
						/>
					</div>
					{#if pinnedCount && i === pinnedCount - 1}
						<div class="mx-2 my-1 h-px bg-foreground/10"></div>
					{/if}
				{:else}
					{#if library.loading}
						<p class="px-3 py-1.5 text-xs text-muted-foreground">Loading…</p>
					{:else if !auth.account?.signedIn}
						<button
							type="button"
							class="mx-1 rounded-md px-2 py-1.5 text-left text-[13px] text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
							onclick={() => startGoogleSignIn()}
						>
							Sign in to see playlists
						</button>
					{/if}
				{/each}
			</div>
		</div>

		<Dialog.Root bind:open={dialogOpen}>
			<Dialog.Content class="sm:max-w-md">
				<Dialog.Header>
					<Dialog.Title>New playlist</Dialog.Title>
					<Dialog.Description>Give your playlist a name to get started.</Dialog.Description>
				</Dialog.Header>
				<form
					class="flex flex-col gap-4"
					onsubmit={(e) => {
						e.preventDefault();
						createNew();
					}}
				>
					<Input bind:value={newTitle} placeholder="Playlist name" autofocus />
					<Dialog.Footer>
						<Button type="button" variant="outline" onclick={() => (dialogOpen = false)}>Cancel</Button>
						<Button type="submit" disabled={creating || !newTitle.trim()}>
							{creating ? 'Creating…' : 'Create'}
						</Button>
					</Dialog.Footer>
				</form>
			</Dialog.Content>
		</Dialog.Root>

	<div class="mt-auto flex flex-col gap-0.5 pt-2 {collapsed ? 'items-center' : ''}">
		<button
			onclick={() => (ui.settingsOpen = true)}
			title="Settings"
			class="{navRow} text-sidebar-foreground/55 hover:bg-white/[0.05] hover:text-sidebar-foreground {wide(
				'justify-start'
			)}"
		>
			<HugeiconsIcon icon={Settings01Icon} strokeWidth={2} class="h-[18px] w-[18px] shrink-0" />
			<span class="hidden {wide('inline')}">Settings</span>
		</button>
		{#if !collapsed}
			<AccountMenu foot />
		{:else}
			<AccountMenu />
		{/if}
	</div>
</aside>
