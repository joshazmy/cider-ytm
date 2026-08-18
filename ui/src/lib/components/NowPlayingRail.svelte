<script lang="ts">
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { MusicNote01Icon } from '@hugeicons/core-free-icons';
	import { np, playback } from '$lib/player.svelte';
	import * as api from '$lib/api';
	import { isLetterTile, thumb } from '$lib/thumb';
	import QueueList from './QueueList.svelte';

	const total = $derived(playback.queue.items?.length ?? 0);
	const at = $derived(Math.min(total, (playback.queue.currentIndex ?? 0) + 1));
	const from = $derived(playback.queue.sourceName?.trim() || '');
</script>

<aside
	class="hidden h-full w-[272px] shrink-0 flex-col border-l border-white/5 bg-black/25 min-[1100px]:flex"
>
	<div class="px-3 pt-3 pb-2">
		<div class="flex items-center justify-between text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
			<span>Now Playing</span>
			<div class="flex items-center gap-1">
				{#if total}
					<span class="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal"
						>{total} items</span
					>
				{/if}
				{#if total > 1}
					<button
						type="button"
						class="rounded-full px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-muted-foreground hover:bg-white/8 hover:text-foreground"
						onclick={() => api.clearQueued()}
					>
						Clear
					</button>
				{/if}
			</div>
		</div>
		{#if playback.now}
			<button
				type="button"
				class="mt-2 flex w-full items-center gap-2.5 rounded-xl bg-white/[0.05] p-2 text-left hover:bg-white/[0.08]"
				onclick={() => {
					np.open = true;
					np.tab = 'lyrics';
				}}
			>
				{#if playback.now.thumbnail && !isLetterTile(playback.now.thumbnail)}
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
			{#if from}
				<span class="mt-0.5 block text-[10px] font-medium normal-case tracking-normal text-muted-foreground/80"
					>from {from}</span
				>
			{/if}
		</div>
		<QueueList />
	</div>
</aside>
