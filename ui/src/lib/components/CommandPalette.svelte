<script lang="ts">
	import { goto } from '$app/navigation';
	import { desk, np, playback, togglePlayUi, ui } from '$lib/player.svelte';
	import * as api from '$lib/api';

	let { open = $bindable(false) }: { open: boolean } = $props();
	let q = $state('');
	let idx = $state(0);

	type Act = { id: string; label: string; hint: string; run: () => void };

	const actions = $derived.by(() => {
		const all: Act[] = [
			{ id: 'lib', label: 'Library', hint: 'Ctrl+H', run: () => goto('/library') },
			{ id: 'songs', label: 'Songs', hint: 'Ctrl+2', run: () => goto('/library?tab=songs') },
			{ id: 'recent', label: 'Recently Played', run: () => goto('/library?tab=recent') },
			{ id: 'albums', label: 'Albums', hint: 'Ctrl+3', run: () => goto('/library?tab=albums') },
			{ id: 'artists', label: 'Artists', hint: 'Ctrl+4', run: () => goto('/library?tab=artists') },
			{ id: 'search', label: 'Search', hint: 'Ctrl+F', run: () => goto('/search') },
			{ id: 'home', label: 'Home', hint: 'Ctrl+L', run: () => goto('/') },
			{
				id: 'np',
				label: playback.now ? 'Immersive now playing' : 'Nothing playing',
				hint: 'Ctrl+P',
				run: () => {
					if (playback.now) {
						np.open = true;
						np.tab = 'lyrics';
					}
				}
			},
			{
				id: 'pause',
				label: playback.paused ? 'Play' : 'Pause',
				hint: 'Space',
				run: () => togglePlayUi()
			},
			{
				id: 'dry',
				label: 'Speakers (305P dry)',
				hint: 'Audio',
				run: () => {
					desk.audioProfile = 'dry';
					api.setSetting('audio_profile', 'dry');
				}
			},
			{
				id: 'dimi',
				label: 'DimiSco (spatial approx)',
				hint: 'Audio',
				run: () => {
					desk.audioProfile = 'dimisco';
					api.setSetting('audio_profile', 'dimisco');
				}
			},
			{ id: 'set', label: 'Settings', hint: '', run: () => (ui.settingsOpen = true) }
		];
		const n = q.trim().toLowerCase();
		return n ? all.filter((a) => a.label.toLowerCase().includes(n)) : all;
	});

	$effect(() => {
		if (open) {
			q = '';
			idx = 0;
		}
	});
	$effect(() => {
		if (idx >= actions.length) idx = Math.max(0, actions.length - 1);
	});

	function go(a: Act) {
		open = false;
		a.run();
	}

	function focusOnMount(node: HTMLInputElement) {
		queueMicrotask(() => node.focus());
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			open = false;
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			idx = Math.min(actions.length - 1, idx + 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			idx = Math.max(0, idx - 1);
		} else if (e.key === 'Enter' && actions[idx]) {
			e.preventDefault();
			go(actions[idx]);
		}
	}
</script>

{#if open}
	<button
		type="button"
		class="fixed inset-0 z-[200] bg-black/50"
		onclick={() => (open = false)}
		aria-label="Close command palette"
	></button>
	<div
		class="desk-glass fixed top-[18%] left-1/2 z-[210] w-[min(32rem,92vw)] -translate-x-1/2 rounded-2xl p-2"
	>
		<input
			class="w-full rounded-xl border-0 bg-transparent px-3 py-2 text-sm outline-none"
			placeholder="Jump to…"
			bind:value={q}
			onkeydown={onKey}
			use:focusOnMount
		/>
		<ul class="mt-1 max-h-72 overflow-y-auto">
			{#each actions as a, i (a.id)}
				<li>
					<button
						type="button"
						class="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm {i ===
						idx
							? 'bg-primary/80 text-primary-foreground'
							: 'hover:bg-white/6'}"
						onmouseenter={() => (idx = i)}
						onclick={() => go(a)}
					>
						<span>{a.label}</span>
						<span class="text-[11px] opacity-60">{a.hint}</span>
					</button>
				</li>
			{/each}
		</ul>
	</div>
{/if}
