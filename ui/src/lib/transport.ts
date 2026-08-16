/** Which transport glyph the play control must show. Isolated so a check can drive the real rule. */
export type TransportGlyph = 'play' | 'pause';

export function transportGlyph(paused: boolean): TransportGlyph {
	return paused ? 'play' : 'pause';
}

/** Next local pause flag after the user hits play/pause (optimistic; mpv event may lag). */
export function nextPaused(currentlyPaused: boolean): boolean {
	return !currentlyPaused;
}
