// Live cover wash + a saturated accent. Remote YouTube thumbs taint a canvas, so we do not
// pretend to read pixels; the wash IS the tint, and --desk-accent is a Cider-desk pink that
// still reads on near-black chrome.

import { playback } from './player.svelte';

export const deskAccent = '#f43f6d';

export function coverUrl(): string | null {
	return playback.now?.thumbnail ?? null;
}
