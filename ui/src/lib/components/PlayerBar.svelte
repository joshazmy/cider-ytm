<script lang="ts">
	import { goto } from '$app/navigation';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		PreviousIcon,
		NextIcon,
		PlayIcon,
		PauseIcon,
		ShuffleIcon,
		RepeatIcon,
		RepeatOne01Icon,
		Queue01Icon,
		Mic01Icon,
		VolumeHighIcon,
		VolumeMute02Icon,
		StarIcon,
		Add01Icon,
		InfinityIcon,
		MinimizeScreenIcon,
		MusicNote01Icon,
		ArrowUp01Icon,
		ArrowDown01Icon
	} from '@hugeicons/core-free-icons';
	import { fade } from 'svelte/transition';
	import { Button } from '$lib/components/ui/button';
	import * as api from '$lib/api';
	import {
		np,
		playback,
		commitVolume,
		cycleRepeat,
		dragVolume,
		openAddToPlaylist,
		openMiniPlayer,
		toggleMute,
		toggleNowPlayingLike,
		togglePlayUi
	} from '$lib/player.svelte';
	import { transportGlyph } from '$lib/transport';
	import { isLetterTile, thumb } from '$lib/thumb';
	import { fmtClock, trackDurationSecs } from '$lib/clock';
	import ArtistLine from './ArtistLine.svelte';
	import Marquee from './Marquee.svelte';
	import TrackMenu from './TrackMenu.svelte';

	let {
		onToggleQueue,
		queueOpen,
		onToggleLyrics,
		lyricsOpen
	}: {
		onToggleQueue: () => void;
		queueOpen: boolean;
		onToggleLyrics: () => void;
		lyricsOpen: boolean;
	} = $props();

	// Pop the star once when the user favourites (not when un-favouriting). Reset on animation end
	// so the next like can replay it.
	let justLiked = $state(false);

	function toggleLike() {
		if (playback.rating !== 'like') justLiked = true;
		toggleNowPlayingLike();
	}

	const shuffleOn = $derived(playback.queue.shuffle ?? false);
	const repeat = $derived(playback.queue.repeat ?? 'off');

	// The current track was appended by autoplay → show the subtle ∞ badge next to the title.
	// Matched against the now-playing videoId so a transient queue/now-playing mismatch (mid
	// gapless advance) can't flash the badge on the wrong song.
	const autoplayTrack = $derived.by(() => {
		const cur = playback.queue.items[playback.queue.currentIndex];
		return !!cur?.autoplay && cur.video_id === playback.now?.videoId;
	});

	// The ⋮ menu needs the full SongItem — NowPlaying carries no album_id. Take it from the queue
	// row, matched on videoId so a mid-advance mismatch can't point the menu at the wrong song.
	const currentSong = $derived.by(() => {
		const cur = playback.queue.items[playback.queue.currentIndex];
		return cur?.video_id === playback.now?.videoId ? cur : null;
	});

	const albumName = $derived(currentSong?.album ?? '');
	const albumId = $derived(currentSong?.album_id);

	// Seek: while dragging, hold a local value so incoming mpv position ticks can't yank the thumb
	// back under the pointer; only invoke the (expensive) seek on release.
	let seekDrag = $state<number | null>(null);
	const shownPosition = $derived(seekDrag ?? playback.position);
	const durationSecs = $derived(
		trackDurationSecs({
			playback: playback.duration,
			catalog: playback.now?.duration,
			queue: currentSong?.duration
		})
	);

	function onSeekInput(e: Event) {
		seekDrag = Number((e.target as HTMLInputElement).value);
	}
	function onSeekCommit(e: Event) {
		const v = Number((e.target as HTMLInputElement).value);
		playback.position = v;
		seekDrag = null;
		api.seek(v);
	}

	const onVolume = (e: Event) => dragVolume(Number((e.target as HTMLInputElement).value));
	const onVolumeCommit = (e: Event) => commitVolume(Number((e.target as HTMLInputElement).value));

	const isControl = (t: EventTarget | null) =>
		!!(t as HTMLElement | null)?.closest?.('button, a, input, [role="button"]');

	// Dragging a slider past its end and releasing outside it retargets the click at the bar (the
	// click lands on the common ancestor of press and release), which used to toggle the view.
	// So judge by where the press started, not where the release happened.
	let pressedControl = false;

	// Anywhere on the bar that isn't a control opens (or closes) the now-playing view: the bar is
	// what's left of it once it's minimised, so it's the way back in. Deliberately no pointer
	// cursor, because this is the whole bar, not a button, and every real button keeps its own click.
	function onBarClick(e: MouseEvent) {
		if (pressedControl || isControl(e.target)) return;
		np.open = !np.open;
	}

	function openAlbum(e: MouseEvent) {
		if (!albumId) return;
		e.stopPropagation();
		goto(`/album/${encodeURIComponent(albumId)}`);
	}

	// YouTube letter tiles (and 404s from a rewritten size) must not sit in the bar as a lone "D".
	let artFailed = $state(false);
	const letterTile = $derived(isLetterTile(playback.now?.thumbnail));
	$effect(() => {
		playback.now?.videoId;
		artFailed = false;
	});
</script>

<!-- The chevron button below is the keyboard equivalent of clicking the bar, so the bar itself
     stays a plain region rather than becoming a focusable control wrapping every other control. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions, a11y_no_noninteractive_element_interactions -->
<footer
	onpointerdown={(e) => (pressedControl = isControl(e.target))}
	onclick={onBarClick}
	class="desk-glass flex flex-col rounded-[1.1rem] px-2 pb-1.5 pt-0.5"
>
	<input
		type="range"
		class="range mx-1 h-3 w-[calc(100%-0.5rem)]"
		style="--pct:{durationSecs ? (shownPosition / durationSecs) * 100 : 0}%"
		min="0"
		max={durationSecs || 0}
		value={shownPosition}
		oninput={onSeekInput}
		onchange={onSeekCommit}
		aria-label="Seek"
	/>
	<div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
		<div class="flex min-w-0 items-center gap-2">
			{#key playback.now?.videoId}
				{#if playback.now?.thumbnail && !artFailed && !letterTile}
					<img
						src={thumb(playback.now.thumbnail, 88)}
						alt=""
						style="max-width:none"
						class="h-11 w-11 shrink-0 rounded-md object-cover ring-1 ring-white/10"
						in:fade={{ duration: 250 }}
						onerror={() => (artFailed = true)}
					/>
				{:else}
					<div
						class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground/50"
					>
						<HugeiconsIcon icon={MusicNote01Icon} class="h-4 w-4" />
					</div>
				{/if}
			{/key}
			<div class="min-w-0">
				<div class="flex min-w-0 items-center gap-1">
					<Marquee
						text={playback.now?.title ?? 'Nothing playing'}
						class="text-[13px] font-medium leading-tight"
					/>
					{#if playback.now?.bitrate}
						<span
							class="shrink-0 rounded bg-white/10 px-1 py-px text-[9px] font-semibold tracking-wide text-muted-foreground"
							title="Stream bitrate (kbps)"
						>
							{playback.now.bitrate}
						</span>
					{/if}
					{#if autoplayTrack}
						<span
							class="shrink-0 text-muted-foreground"
							title="Playing similar music (Autoplay)"
							in:fade={{ duration: 200 }}
						>
							<HugeiconsIcon icon={InfinityIcon} class="h-3 w-3" />
						</span>
					{/if}
				</div>
				<div class="flex min-w-0 items-center text-[11px] leading-tight text-muted-foreground">
					<ArtistLine
						runs={playback.now?.artistRuns}
						text={playback.now?.artists ?? ''}
						class="min-w-0 truncate"
					/>
					{#if albumName}
						<span class="shrink-0"> – </span>
						{#if albumId}
							<button
								class="min-w-0 truncate hover:text-foreground hover:underline"
								onclick={openAlbum}
							>
								{albumName}
							</button>
						{:else}
							<span class="min-w-0 truncate">{albumName}</span>
						{/if}
					{/if}
				</div>
			</div>
		</div>

		<div class="flex flex-col items-center">
			<div
				class="flex shrink-0 items-center [&_button]:focus-visible:border-transparent [&_button]:focus-visible:ring-0"
			>
				{#if playback.now && !api.isLocalId(playback.now.videoId)}
					<Button variant="ghost" size="icon-xs" onclick={toggleLike} aria-label="Like">
						<span
							class="inline-flex"
							class:animate-heart-pop={justLiked}
							onanimationend={() => (justLiked = false)}
						>
							<HugeiconsIcon
								icon={StarIcon}
								class="h-3.5 w-3.5 {playback.rating === 'like'
									? 'fill-current text-primary'
									: 'text-muted-foreground'}"
							/>
						</span>
					</Button>
				{/if}
				<Button
					variant="ghost"
					size="icon-xs"
					class="text-muted-foreground"
					onclick={() => api.prevTrack()}
					aria-label="Previous"
				>
					<HugeiconsIcon icon={PreviousIcon} class="h-3.5 w-3.5" />
				</Button>
				<Button
					variant="default"
					size="icon-xs"
					class="size-7 rounded-full bg-foreground text-background hover:bg-foreground/90 focus-visible:ring-0"
					onclick={() => togglePlayUi()}
					aria-label={transportGlyph(playback.paused) === 'play' ? 'Play' : 'Pause'}
				>
					{#if transportGlyph(playback.paused) === 'play'}
						<HugeiconsIcon icon={PlayIcon} class="h-3.5 w-3.5" />
					{:else}
						<HugeiconsIcon icon={PauseIcon} class="h-3.5 w-3.5" />
					{/if}
				</Button>
				<Button
					variant="ghost"
					size="icon-xs"
					class="text-muted-foreground"
					onclick={() => api.nextTrack()}
					aria-label="Next"
				>
					<HugeiconsIcon icon={NextIcon} class="h-3.5 w-3.5" />
				</Button>
				<Button
					variant={lyricsOpen ? 'secondary' : 'ghost'}
					size="icon-xs"
					onclick={onToggleLyrics}
					aria-label="Toggle lyrics"
				>
					<HugeiconsIcon icon={Mic01Icon} class="h-3.5 w-3.5" />
				</Button>
			</div>
			<span class="text-[11px] tabular-nums text-muted-foreground">
				{fmtClock(shownPosition)} / {fmtClock(durationSecs)}
			</span>
		</div>

		<div
			class="flex items-center justify-end [&_button]:focus-visible:border-transparent [&_button]:focus-visible:ring-0"
		>
			<Button
				variant="ghost"
				size="icon-xs"
				class="text-muted-foreground"
				onclick={toggleMute}
				aria-label={playback.volume === 0 ? 'Unmute' : 'Mute'}
			>
				<HugeiconsIcon
					icon={VolumeHighIcon}
					altIcon={VolumeMute02Icon}
					showAlt={playback.volume === 0}
					class="h-3.5 w-3.5"
				/>
			</Button>
			<input
				type="range"
				class="range w-16"
				style="--pct:{playback.volume}%"
				min="0"
				max="100"
				value={playback.volume}
				oninput={onVolume}
				onchange={onVolumeCommit}
				aria-label="Volume"
			/>
			{#if playback.now && !api.isLocalId(playback.now.videoId)}
				<Button
					variant="ghost"
					size="icon-xs"
					onclick={() => {
						const now = playback.now!;
						openAddToPlaylist({
							video_id: now.videoId,
							title: now.title,
							artists: now.artists,
							artist_id: now.artistId,
							thumbnail: now.thumbnail,
							duration: now.duration
						});
					}}
					aria-label="Add to playlist"
				>
					<HugeiconsIcon icon={Add01Icon} class="h-3.5 w-3.5 text-muted-foreground" />
				</Button>
			{/if}
			<Button
				variant="ghost"
				size="icon-xs"
				onclick={() => api.toggleShuffle()}
				aria-label="Shuffle"
				aria-pressed={shuffleOn}
			>
				<HugeiconsIcon
					icon={ShuffleIcon}
					class="h-3.5 w-3.5 {shuffleOn ? 'text-primary' : 'text-muted-foreground'}"
				/>
			</Button>
			<Button
				variant="ghost"
				size="icon-xs"
				onclick={cycleRepeat}
				aria-label="Repeat: {repeat}"
				aria-pressed={repeat !== 'off'}
			>
				<HugeiconsIcon
					icon={RepeatIcon}
					altIcon={RepeatOne01Icon}
					showAlt={repeat === 'one'}
					class="h-3.5 w-3.5 {repeat !== 'off' ? 'text-primary' : 'text-muted-foreground'}"
				/>
			</Button>
			<Button variant="ghost" size="icon-xs" onclick={openMiniPlayer} aria-label="Mini player">
				<HugeiconsIcon icon={MinimizeScreenIcon} class="h-3.5 w-3.5" />
			</Button>
			<Button
				variant={queueOpen ? 'secondary' : 'ghost'}
				size="icon-xs"
				onclick={onToggleQueue}
				aria-label="Toggle queue"
			>
				<HugeiconsIcon icon={Queue01Icon} class="h-3.5 w-3.5" />
			</Button>
			{#if currentSong}
				<TrackMenu
					song={currentSong}
					linksOnly
					onAdd={() => openAddToPlaylist(currentSong!)}
					triggerClass="inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
				/>
			{/if}
			<Button
				variant="ghost"
				size="icon-xs"
				onclick={() => (np.open = !np.open)}
				aria-label={np.open ? 'Minimise player' : 'Open player'}
				aria-expanded={np.open}
			>
				<HugeiconsIcon
					icon={ArrowUp01Icon}
					altIcon={ArrowDown01Icon}
					showAlt={np.open}
					class="h-3.5 w-3.5"
				/>
			</Button>
		</div>
	</div>
</footer>
