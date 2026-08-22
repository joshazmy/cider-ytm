<script lang="ts">
	import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/svelte';
	import {
		FavouriteIcon,
		MusicNote01Icon,
		PlayIcon,
		PlayListAddIcon,
		StarIcon,
		ThumbsDownIcon,
		ThumbsUpIcon
	} from '@hugeicons/core-free-icons';
	import * as api from '$lib/api';
	import type { SongItem } from '$lib/api';
	import { thumb } from '$lib/thumb';
	import { lt } from '$lib/lt.svelte';
	import { isLiked, ratingOf, toggleRating } from '$lib/player.svelte';
	import TrackMenu from './TrackMenu.svelte';
	import ArtistLine from './ArtistLine.svelte';
	import ExplicitIcon from './ExplicitIcon.svelte';

	let {
		song,
		index,
		active = false,
		hideThumb = false,
		compact = false,
		showPlayCount = false,
		hideRating = false,
		onplay,
		onAdd,
		onRemove,
		removeLabel = 'Remove from playlist'
	}: {
		song: SongItem;
		/** Position badge when set (playlist/queue); omitted for flat search results. */
		index?: number;
		active?: boolean;
		/** Hide the leading thumbnail (album track lists show a number, not a cover). */
		hideThumb?: boolean;
		/**
		 * Grid variant (home's Forgotten favourites): the duration joins the artist line instead of
		 * claiming its own column, and a like heart sits next to the ⋯ — narrow columns have no room
		 * for a separate duration column, and hearting is the whole point of that shelf.
		 */
		compact?: boolean;
		/**
		 * Opt-in, because `play_count` rides along on the song object wherever it goes after an album
		 * page (queue, previously played) and a narrow panel has no width to spare for it.
		 */
		showPlayCount?: boolean;
		/**
		 * The narrow queue-panel variant: drops the inline thumbs and the explicit mark. Two buttons
		 * plus the duration leave nothing for the title and artists at that width, and the queue is
		 * not where you decide what to listen to. The ⋯ menu carries like and dislike either way.
		 */
		hideRating?: boolean;
		onplay: () => void;
		/** Adds an "Add to playlist" menu item. */
		onAdd?: () => void;
		/** Adds a remove menu item (label via `removeLabel`). */
		onRemove?: () => void;
		removeLabel?: string;
	} = $props();

	// In a session as guest, clicking a song adds it to the shared queue instead of playing it —
	// reflect that in the hover icon + label so the row doesn't lie.
	const guestAdd = $derived(lt.role === 'guest');

	// Digits and colons, nothing else. A queue saved before the parser stopped reading a name with a
	// colon in it ("Cast of EPIC: The Musical") as a length still holds those strings, and printing
	// one here squeezes the title and artists down to nothing.
	const duration = $derived(/^[\d:]+$/.test(song.duration ?? '') ? song.duration : undefined);

	const rated = $derived(ratingOf(song));
	// Thumbs stay off unless the caller wants them (`hideRating` is false) *and* the song already
	// carries a rating. Empty hover-revealed thumbs are not the playlist row; the ⋯ menu still rates.
	const showRating = $derived(
		!compact && !hideRating && rated !== 'indifferent' && !api.isLocalId(song.video_id)
	);

</script>

<!-- Both rating buttons, so they can't drift apart. `icon` is a constant per call site, not a
     reactive ternary, which is the only way HugeiconsIcon takes it (it freezes at mount). -->
{#snippet rateButton(icon: IconSvgElement, want: 'like' | 'dislike', label: string)}
		<button
			class="desk-focus pointer-events-auto flex size-11 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent/20 hover:text-foreground"
		aria-label={rated === want ? 'Remove rating' : label}
		aria-pressed={rated === want}
		onclick={(e) => {
			e.stopPropagation();
			toggleRating(song, want);
		}}
	>
		<!-- Liked wears the accent; disliked fills plain, since the accent reads as approval. -->
		<HugeiconsIcon
			{icon}
			class="h-4 w-4 {rated === want
				? `fill-current ${want === 'like' ? 'text-primary' : 'text-foreground'}`
				: ''}"
		/>
	</button>
{/snippet}

<!-- content-visibility: a liked-songs playlist runs to thousands of rows and WebKit keeps every one
     in style, layout and paint. 3rem is a row (48px: 8px padding, 32px thumbnail, 8px); `auto` swaps
     in the measured size after first paint. Not on the compact variant: that one is laid out in CSS
     columns (ForgottenFavourites), where an unsized fragment would upset column balancing, and it
     never has more than 15 rows to skip. @container: the artist column hides when this row is
     narrower than 28rem (queue panel, squeezed playlist), not when the window is. -->
<div
	class="@container group relative flex w-full items-center gap-2.5 rounded-lg px-2 transition-colors hover:bg-white/[0.08] has-[button:focus-visible]:bg-white/[0.08] {compact
		? 'h-12'
		: 'h-[54px] [content-visibility:auto] [contain-intrinsic-size:auto_3.375rem]'} {active
		? 'bg-white/[0.10]'
		: ''}"
>
	<!-- A native play button is a sibling of every artist/rating/menu action. The visual row is
	     pointer-transparent except for those explicit actions, so there are no interactive descendants
	     inside an ARIA button and a click anywhere else still activates playback. -->
	<button
		type="button"
		class="desk-focus absolute inset-0 z-0 rounded-lg"
		onclick={onplay}
		aria-label={guestAdd ? `Add ${song.title} to the session queue` : `Play ${song.title}`}
	></button>
	<div class="pointer-events-none contents">
	{#if index !== undefined}
		<span class="relative w-7 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
			<span class={active ? 'opacity-0' : 'group-hover:opacity-0'}>{index + 1}</span>
			<HugeiconsIcon
				icon={guestAdd ? PlayListAddIcon : PlayIcon}
				class="absolute inset-0 m-auto h-3.5 w-3.5 text-foreground {active
					? 'opacity-100'
					: 'opacity-0 group-hover:opacity-100'}"
			/>
		</span>
	{/if}
	{#if !hideThumb}
		{#if song.thumbnail}
			<img
				src={thumb(song.thumbnail, 96)}
				alt=""
				class="h-10 w-10 shrink-0 rounded-md object-cover"
				loading="lazy"
			/>
		{:else}
			<!-- An untagged file has no artwork of its own. A music note keeps the row aligned
			     with its neighbours and says so plainly. -->
			<div
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground/50"
			>
				<HugeiconsIcon icon={MusicNote01Icon} class="h-4 w-4" />
			</div>
		{/if}
	{/if}

	<div class="min-w-0 flex-1">
		<div class="flex min-w-0 items-center gap-2">
			<span class="min-w-0 truncate text-sm font-medium leading-[18px]">{song.title}</span>
			{#if song.queued_by}
				<span
					class="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
				>
					{song.queued_by}
				</span>
			{/if}
		</div>
		{#if compact}
			<div class="flex min-w-0 items-center gap-1 text-[11px] leading-[14px] text-muted-foreground">
				{#if song.album}
					<span class="truncate">{song.album}</span>
					<span class="shrink-0">·</span>
				{/if}
					<ArtistLine runs={song.artist_runs} text={song.artists} class="pointer-events-auto relative z-10" />
				{#if duration}
					<span class="shrink-0">· {duration}</span>
				{/if}
			</div>
		{:else if song.album}
			<div class="truncate text-[11px] leading-[14px] text-muted-foreground">{song.album}</div>
		{:else}
			<!-- No album: keep the artist under the title when the wide column is hidden. -->
				<ArtistLine
					runs={song.artist_runs}
					text={song.artists}
					class="pointer-events-auto relative z-10 block text-[11px] leading-[14px] text-muted-foreground @md:hidden"
			/>
		{/if}
	</div>

	{#if !compact}
		<div class="hidden min-w-0 flex-1 @md:block">
			<ArtistLine
				runs={song.artist_runs}
				text={song.artists}
				class="pointer-events-auto relative z-10 block text-sm text-muted-foreground"
			/>
		</div>
	{/if}

	<!-- Album rows only. Wide rows are mostly empty between the title and the duration, so it takes a
	     centred column of its own there; narrow ones sit it next to the duration at its natural width
	     rather than dropping it, since it never needs more than "1,234 plays" worth of room. -->
	{#if song.play_count && showPlayCount && !compact}
		<div class="flex shrink-0 items-center justify-center text-xs text-muted-foreground lg:flex-1">
			<span class="truncate">{song.play_count} plays</span>
		</div>
	{/if}

	<div class="relative z-10 flex shrink-0 items-center {compact ? 'gap-0.5' : 'gap-2'}">
		<!-- Always on, unlike the thumbs beside it: this is a property of the song, not an action,
		     so hiding it until the pointer arrives would be hiding half of what it's for. -->
		{#if song.explicit && !hideRating}
			<ExplicitIcon class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
		{/if}
		{#if !compact && !hideRating && !api.isLocalId(song.video_id)}
				<button
					class="desk-focus pointer-events-auto flex size-11 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent/20 hover:text-foreground"
				aria-label={isLiked(song) ? 'Remove like' : 'Like'}
				aria-pressed={isLiked(song)}
				onclick={(e) => {
					e.stopPropagation();
					toggleRating(song, 'like');
				}}
			>
				<HugeiconsIcon
					icon={StarIcon}
					class="h-4 w-4 {isLiked(song) ? 'fill-current text-primary' : ''}"
				/>
			</button>
		{/if}
		{#if showRating}
			<div class="flex items-center gap-0.5">
				{@render rateButton(ThumbsUpIcon, 'like', 'Like')}
				{@render rateButton(ThumbsDownIcon, 'dislike', 'Dislike')}
			</div>
		{/if}
		{#if duration && !compact}
			<span class="min-w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{duration}</span>
		{/if}
		{#if compact}
			<!-- Persistent, not hover-only: a filled heart is state the row has to keep showing. -->
				<button
					class="desk-focus pointer-events-auto flex size-11 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent/20 hover:text-foreground"
				aria-label={isLiked(song) ? 'Remove from liked songs' : 'Save to liked songs'}
				aria-pressed={isLiked(song)}
				onclick={(e) => {
					e.stopPropagation();
					toggleRating(song, 'like');
				}}
			>
				<HugeiconsIcon
					icon={FavouriteIcon}
					class="h-4 w-4 {isLiked(song) ? 'fill-current text-primary' : ''}"
				/>
			</button>
		{/if}
		<TrackMenu
			{song}
			{onAdd}
			{onRemove}
			{removeLabel}
			triggerClass="desk-focus pointer-events-auto flex size-11 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent/20 hover:text-foreground focus-visible:opacity-100 {compact
				? ''
				: 'opacity-0 group-hover:opacity-100'}"
			/>
		</div>
	</div>
</div>
