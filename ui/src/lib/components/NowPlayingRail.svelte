<script lang="ts">
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { MusicNote01Icon } from '@hugeicons/core-free-icons';
	import { np, playback, togglePlayUi } from '$lib/player.svelte';
	import { thumb } from '$lib/thumb';
	import QueueList from './QueueList.svelte';

	const upcoming = $derived(
		Math.max(0, (playback.queue.items?.length ?? 0) - (playback.queue.currentIndex ?? 0) - 1)
	);
</script>

<aside
	class="hidden h-full w-[272px] shrink-0 flex-col border-l border-white/5 bg-black/25 xl:flex"
>
	<div class="px-3 pt-3 pb-2">
		<div class="flex items-center justify-between text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
			<span>Now Playing</span>
			<span class="rounded-full bg-white/8 px-2 py-0.5 text-[10px] normal-case tracking-normal"
				>{upcoming + 1}</span
			>
		</div>
		{#if playback.now}
			<button
				type="button"
				class="mt-2 flex w-full items-center gap-2.5 rounded-xl bg-white/[0.05] p-2 text-left hover:bg-white/[0.08]"
				onclick={() => {
					np.open = true;
					np.tab = 'lyrics';
					togglePlayUi();
				}}
			>
				{#if playback.now.thumbnail}
					<img
						src={thumb(playback.now.thumbnail, 96)}
						alt=""
						class="h-11 w-11 shrink-0 rounded-lg object-cover"
					/>
				{:else}
					<div class="flex h-11 w-11 items-center justify-center rounded-lg bg-muted">
						<HugeiconsIcon icon={MusicNote01Icon} class="h-4 w-4 text-muted-foreground" />
					</div>
				{/if}
				<div class="min-w-0">
					<div class="truncate text-[13px] font-medium">{playback.now.title}</div>
					<div class="truncate text-[11px] text-muted-foreground">{playback.now.artists}</div>
				</div>
			</button>
		{/if}
	</div>
	<div class="min-h-0 flex-1 overflow-hidden">
		<div class="px-3 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
			Playing Next
		</div>
		<QueueList />
	</div>
</aside>
