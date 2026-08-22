<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { beforeNavigate } from '$app/navigation';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Maximize01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
	import LyricsView from './LyricsView.svelte';
	import { np } from '$lib/player.svelte';
	import { reducedMotion } from '$lib/theme.svelte';

	let { onClose }: { onClose: () => void } = $props();

	let panel: HTMLElement | undefined = $state();
	const still = $derived(reducedMotion());

	onMount(() => {
		const frame = requestAnimationFrame(() => panel?.focus());
		return () => cancelAnimationFrame(frame);
	});

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

	beforeNavigate(() => onClose());

	function openImmersive() {
		onClose();
		requestAnimationFrame(() => {
			np.tab = 'lyrics';
			np.open = true;
		});
	}
</script>

<button
	tabindex="-1"
	class="absolute top-0 right-0 bottom-[88px] left-0 z-20 cursor-default bg-black/55 min-[1100px]:hidden"
	onclick={onClose}
	aria-label="Close lyrics"
	transition:fade={{ duration: still ? 80 : 150 }}
></button>
<button
	type="button"
	aria-label="Wrap lyrics focus to the end"
	class="pointer-events-none absolute size-px overflow-hidden opacity-0"
	onfocus={() => focusEdge(true)}
></button>
<div
	bind:this={panel}
	id="lyrics-panel"
	role="dialog"
	aria-labelledby="lyrics-panel-title"
	tabindex="-1"
	data-overlay-panel="lyrics"
	onkeydown={onKeydown}
	transition:fly={{ x: still ? 0 : 32, duration: still ? 80 : 220, easing: cubicOut }}
	class="absolute top-0 right-0 bottom-[88px] z-30 flex w-[min(360px,88%)] min-w-0 max-w-[min(360px,88%)] flex-col border-l border-white/10 bg-card shadow-2xl outline-none min-[1100px]:hidden"
>
	<div class="flex h-[52px] shrink-0 items-center justify-between border-b border-white/10 px-3">
		<h2 id="lyrics-panel-title" class="font-heading text-base font-semibold">Lyrics</h2>
		<div class="flex items-center">
			<button
				onclick={openImmersive}
				class="desk-focus flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground"
				aria-label="Open immersive lyrics"
			>
				<HugeiconsIcon icon={Maximize01Icon} class="h-4 w-4" />
			</button>
			<button
				type="button"
				class="desk-focus flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/8 hover:text-foreground"
				onclick={onClose}
				aria-label="Close lyrics"
			>
				<HugeiconsIcon icon={Cancel01Icon} class="size-4" />
			</button>
		</div>
	</div>
	<LyricsView />
</div>
<button
	type="button"
	aria-label="Wrap lyrics focus to the start"
	class="pointer-events-none absolute size-px overflow-hidden opacity-0"
	onfocus={() => focusEdge(false)}
></button>
