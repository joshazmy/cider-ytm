<script lang="ts">
	import { goto } from '$app/navigation';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		PreviousIcon,
		NextIcon,
		ShuffleIcon,
		RepeatIcon,
		RepeatOne01Icon,
		Queue01Icon,
		Mic01Icon,
		VolumeHighIcon,
		VolumeMute02Icon,
		StarIcon,
		InfinityIcon,
		MinimizeScreenIcon,
		MusicNote01Icon,
		ArrowUp01Icon,
		ArrowDown01Icon,
		HeadphonesIcon
	} from '@hugeicons/core-free-icons';
	import { Button } from '$lib/components/ui/button';
	import * as api from '$lib/api';
	import {
		np,
		playback,
		desk,
		commitVolume,
		cycleRepeat,
		dragVolume,
		openAddToPlaylist,
		openMiniPlayer,
		setSleepMins,
		toggleAudioProfile,
		toggleMute,
		toggleNowPlayingLike,
		togglePlayUi
	} from '$lib/player.svelte';
	import { transportGlyph } from '$lib/transport';
	import { isLetterTile, thumb } from '$lib/thumb';
	import { fmtClock, trackDurationSecs } from '$lib/clock';
	import ArtistLine from './ArtistLine.svelte';
	import ExplicitIcon from './ExplicitIcon.svelte';
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
	const shuffleOn = $derived(playback.queue.shuffle ?? false);
	const repeat = $derived(playback.queue.repeat ?? 'off');
	let nowTick = $state(Date.now());
	$effect(() => {
		if (!desk.sleepUntil) return;
		const id = setInterval(() => (nowTick = Date.now()), 15_000);
		return () => clearInterval(id);
	});
	const sleepLeft = $derived(
		desk.sleepUntil > nowTick ? Math.max(0, desk.sleepUntil - nowTick) : 0
	);
	const sleepLabel = $derived.by(() => {
		if (!sleepLeft || !desk.sleepUntil) return '';
		const mins = Math.ceil(sleepLeft / 60_000);
		const left =
			mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
		const end = new Date(desk.sleepUntil).toLocaleTimeString([], {
			hour: 'numeric',
			minute: '2-digit'
		});
		return `${left} → ${end}`;
	});
	let sleepOpen = $state(false);

	let justLiked = $state(false);

	function toggleLike() {
		if (playback.rating !== 'like') justLiked = true;
		toggleNowPlayingLike();
	}

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

	function openImmersive() {
		np.open = !np.open;
		if (np.open) np.tab = 'lyrics';
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

<footer
	class="desk-glass mx-2 mb-2 flex h-16 items-center gap-3 px-3"
>
	<div class="flex min-w-0 flex-1 items-center gap-2.5">
		<button
			type="button"
			class="group relative size-12 shrink-0 overflow-hidden rounded-md bg-muted"
			onclick={openImmersive}
			aria-label={np.open ? 'Close immersive' : 'Immersive player'}
			aria-expanded={np.open}
		>
			{#if playback.now?.thumbnail && !artFailed && !letterTile}
				<img
					src={thumb(playback.now.thumbnail, 48)}
					alt=""
					style="max-width:none"
					class="size-12 object-cover"
					onerror={() => (artFailed = true)}
				/>
			{:else}
				<span class="flex size-12 items-center justify-center text-muted-foreground/50">
					<HugeiconsIcon strokeWidth={2} icon={MusicNote01Icon} class="h-4 w-4" />
				</span>
			{/if}
			<span
				class="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 group-hover:opacity-100"
			>
				<HugeiconsIcon
					strokeWidth={2}
					icon={ArrowUp01Icon}
					altIcon={ArrowDown01Icon}
					showAlt={np.open}
					class="h-4 w-4 text-white"
				/>
			</span>
		</button>
		<div class="min-w-0 flex-1">
			<div class="flex min-w-0 items-center gap-1">
				<Marquee
					text={playback.now?.title ?? 'Nothing playing'}
					class="text-[13px] font-medium leading-tight"
				/>
				{#if playback.now?.explicit || currentSong?.explicit}
					<ExplicitIcon class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
				{/if}
				{#if playback.now?.bitrate}
					<span
						class="shrink-0 rounded bg-white/10 px-1 py-px text-[9px] font-semibold tracking-wide text-muted-foreground"
						title="Stream bitrate (kbps)"
					>
						{playback.now.bitrate}
					</span>
				{/if}
				{#if autoplayTrack}
					<span class="shrink-0 text-muted-foreground" title="Playing similar music (Autoplay)">
						<HugeiconsIcon strokeWidth={2} icon={InfinityIcon} class="h-3 w-3" />
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
						<button class="min-w-0 truncate hover:text-foreground hover:underline" onclick={openAlbum}>
							{albumName}
						</button>
					{:else}
						<span class="min-w-0 truncate">{albumName}</span>
					{/if}
				{/if}
			</div>
			<input
				type="range"
				class="range mt-1 h-3 w-full"
				style="--pct:{durationSecs ? (shownPosition / durationSecs) * 100 : 0}%"
				min="0"
				max={durationSecs || 0}
				value={shownPosition}
				oninput={onSeekInput}
				onchange={onSeekCommit}
				aria-label="Seek"
			/>
		</div>
	</div>

	<div
		class="flex shrink-0 items-center gap-0.5 [&_button]:focus-visible:border-transparent [&_button]:focus-visible:ring-0"
	>
		{#if playback.now && !api.isLocalId(playback.now.videoId)}
			<Button variant="ghost" size="icon-sm" onclick={toggleLike} aria-label="Like">
				<span class="inline-flex" class:animate-heart-pop={justLiked} onanimationend={() => (justLiked = false)}>
					<HugeiconsIcon strokeWidth={2}
						icon={StarIcon}
						class="h-4 w-4 {playback.rating === 'like' ? 'fill-current text-primary' : 'text-muted-foreground'}"
					/>
				</span>
			</Button>
		{/if}
		<Button
			variant="ghost"
			size="icon-sm"
			onclick={() => api.toggleShuffle()}
			aria-label="Shuffle"
			aria-pressed={shuffleOn}
		>
			<HugeiconsIcon strokeWidth={2} icon={ShuffleIcon} class="h-4 w-4 {shuffleOn ? 'text-primary' : 'text-muted-foreground'}" />
		</Button>
		<Button variant="ghost" size="icon-sm" class="text-muted-foreground" onclick={() => api.prevTrack()} aria-label="Previous">
			<HugeiconsIcon strokeWidth={2} icon={PreviousIcon} class="h-4 w-4" />
		</Button>
		<button
			type="button"
			class="flex size-9 items-center justify-center rounded-full bg-foreground text-background hover:bg-foreground/90"
			onclick={() => togglePlayUi()}
			aria-label={transportGlyph(playback.paused) === 'play' ? 'Play' : 'Pause'}
		>
			{#if transportGlyph(playback.paused) === 'play'}
				<svg viewBox="0 0 16 16" class="ml-0.5 h-4 w-4 fill-current" aria-hidden="true">
					<path d="M4 2.4v11.2L13.6 8z" />
				</svg>
			{:else}
				<svg viewBox="0 0 16 16" class="h-4 w-4 fill-current" aria-hidden="true">
					<rect x="3" y="2" width="3.5" height="12" rx="1" />
					<rect x="9.5" y="2" width="3.5" height="12" rx="1" />
				</svg>
			{/if}
		</button>
		<Button variant="ghost" size="icon-sm" class="text-muted-foreground" onclick={() => api.nextTrack()} aria-label="Next">
			<HugeiconsIcon strokeWidth={2} icon={NextIcon} class="h-4 w-4" />
		</Button>
		<Button
			variant="ghost"
			size="icon-sm"
			onclick={cycleRepeat}
			aria-label="Repeat: {repeat}"
			aria-pressed={repeat !== 'off'}
		>
			<HugeiconsIcon strokeWidth={2}
				icon={RepeatIcon}
				altIcon={RepeatOne01Icon}
				showAlt={repeat === 'one'}
				class="h-4 w-4 {repeat !== 'off' ? 'text-primary' : 'text-muted-foreground'}"
			/>
		</Button>
		<Button
			variant="ghost"
			size="icon-sm"
			class={lyricsOpen ? 'text-primary' : 'text-muted-foreground'}
			onclick={onToggleLyrics}
			aria-label="Toggle lyrics"
		>
			<HugeiconsIcon strokeWidth={2} icon={Mic01Icon} class="h-4 w-4" />
		</Button>
		<span class="ml-1 w-[4.5rem] text-[11px] tabular-nums text-muted-foreground">
			{fmtClock(shownPosition)} / {fmtClock(durationSecs)}
		</span>
	</div>

	<div
		class="flex min-w-0 flex-1 items-center justify-end [&_button]:focus-visible:border-transparent [&_button]:focus-visible:ring-0"
	>
		<Button
			variant="ghost"
			size="icon-sm"
			class="text-muted-foreground"
			onclick={toggleMute}
			aria-label={playback.volume === 0 ? 'Unmute' : 'Mute'}
		>
			<HugeiconsIcon strokeWidth={2}
				icon={VolumeHighIcon}
				altIcon={VolumeMute02Icon}
				showAlt={playback.volume === 0}
				class="h-4 w-4"
			/>
		</Button>
		<input
			type="range"
			class="range w-20"
			style="--pct:{playback.volume}%"
			min="0"
			max="100"
			value={playback.volume}
			oninput={onVolume}
			onchange={onVolumeCommit}
			aria-label="Volume"
		/>
		<Button
			variant="ghost"
			size="icon-sm"
			class={desk.audioProfile === 'dimisco' ? 'text-primary' : 'text-muted-foreground'}
			onclick={() => toggleAudioProfile()}
			aria-label={desk.audioProfile === 'dimisco' ? 'DimiSco spatial' : 'Dry stereo'}
			aria-pressed={desk.audioProfile === 'dimisco'}
		>
			<HugeiconsIcon strokeWidth={2} icon={HeadphonesIcon} class="h-4 w-4" />
		</Button>
		<div class="relative mr-1">
			<button
				type="button"
				class="px-1 text-[11px] tabular-nums {sleepLabel
					? 'text-muted-foreground'
					: 'text-muted-foreground/60'} hover:text-foreground"
				onclick={() => (sleepOpen = !sleepOpen)}
				aria-expanded={sleepOpen}
				aria-label="Sleep timer"
			>
				{sleepLabel || 'Sleep'}
			</button>
			{#if sleepOpen}
				<div
					class="absolute right-0 bottom-8 z-30 flex gap-1 rounded-lg border bg-popover p-1 shadow-lg"
				>
					{#each [0, 15, 30, 45, 60] as m (m)}
						<button
							type="button"
							class="rounded-md px-2 py-1 text-[11px] hover:bg-muted"
							onclick={() => {
								void setSleepMins(m);
								sleepOpen = false;
							}}>{m === 0 ? 'Off' : `${m}m`}</button
						>
					{/each}
				</div>
			{/if}
		</div>
		<Button variant="ghost" size="icon-sm" onclick={openMiniPlayer} aria-label="Mini player">
			<HugeiconsIcon strokeWidth={2} icon={MinimizeScreenIcon} class="h-4 w-4" />
		</Button>
		<Button
			variant="ghost"
			size="icon-sm"
			class={queueOpen ? 'text-primary' : 'text-muted-foreground'}
			onclick={onToggleQueue}
			aria-label="Toggle queue"
		>
			<HugeiconsIcon strokeWidth={2} icon={Queue01Icon} class="h-4 w-4" />
		</Button>
		{#if currentSong}
			<TrackMenu
				song={currentSong}
				linksOnly
				onAdd={() => openAddToPlaylist(currentSong!)}
				triggerClass="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
			/>
		{/if}
	</div>
</footer>
