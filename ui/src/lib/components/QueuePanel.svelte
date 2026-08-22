<script lang="ts">
	import { onMount } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Cancel01Icon } from '@hugeicons/core-free-icons';
	import QueueList from './QueueList.svelte';
	import { playback } from '$lib/player.svelte';
	import { reducedMotion } from '$lib/theme.svelte';

	let { onClose }: { onClose: () => void } = $props();
	let panel: HTMLElement | undefined = $state();
	const total = $derived(playback.queue.items?.length ?? 0);
	const at = $derived(Math.min(total, (playback.queue.currentIndex ?? 0) + 1));
	const source = $derived(playback.queue.sourceName?.trim() || '');
	const still = $derived(reducedMotion());

	onMount(() => {
		const frame = requestAnimationFrame(() => panel?.focus());
		return () => cancelAnimationFrame(frame);
	});

	beforeNavigate(() => onClose());

	function panelFocusable() {
		if (!panel) return [];
		return Array.from(
			panel.querySelectorAll<HTMLElement>(
				'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
			)
		).filter((element) => element.offsetParent !== null);
	}

	function focusEdge(last: boolean) {
		const focusable = panelFocusable();
		(focusable[last ? focusable.length - 1 : 0] ?? panel)?.focus();
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			onClose();
			return;
		}
		if (event.key !== 'Tab' || !panel) return;
		const focusable = panelFocusable();
		if (!focusable.length) {
			event.preventDefault();
			panel.focus();
			return;
		}
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (document.activeElement === panel) {
				event.preventDefault();
				(event.shiftKey ? last : first).focus();
				return;
			}
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}
</script>

<button
	tabindex="-1"
	class="absolute top-0 right-0 bottom-[88px] left-0 z-20 cursor-default bg-black/55 min-[1100px]:hidden"
	onclick={onClose}
	aria-label="Close queue"
	transition:fade={{ duration: still ? 80 : 150 }}
></button>
<button
	type="button"
	aria-label="Wrap queue focus to the end"
	class="pointer-events-none absolute size-px overflow-hidden opacity-0"
	onfocus={() => focusEdge(true)}
></button>
<div
	bind:this={panel}
	id="queue-panel"
	role="dialog"
	aria-labelledby="queue-panel-title"
	tabindex="-1"
	data-overlay-panel="queue"
	onkeydown={onKeydown}
	transition:fly={{ x: still ? 0 : 32, duration: still ? 80 : 220, easing: cubicOut }}
	class="absolute top-0 right-0 bottom-[88px] z-30 flex w-[min(360px,88%)] min-w-0 max-w-[min(360px,88%)] flex-col border-l border-white/10 bg-card shadow-2xl outline-none min-[1100px]:hidden"
>
	<div class="flex h-[52px] shrink-0 items-center justify-between border-b border-white/10 px-3">
		<div class="min-w-0">
			<h2 id="queue-panel-title" class="font-heading text-base leading-tight font-semibold">Queue</h2>
			{#if total || source}
				<p data-queue-summary class="truncate text-[11px] leading-tight tabular-nums text-muted-foreground">
					{#if total}{at} of {total}{/if}{#if total && source} · {/if}{source}
				</p>
			{/if}
		</div>
		<button
			type="button"
			class="desk-focus flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/8 hover:text-foreground"
			onclick={onClose}
			aria-label="Close queue"
		>
			<HugeiconsIcon icon={Cancel01Icon} class="size-4" />
		</button>
	</div>
	<QueueList />
</div>
<button
	type="button"
	aria-label="Wrap queue focus to the start"
	class="pointer-events-none absolute size-px overflow-hidden opacity-0"
	onfocus={() => focusEdge(false)}
></button>
