/** Parse a catalog clock ("3:21", "1:02:03") or a positive second count. */
export function parseClock(d?: string | number | null): number {
	if (typeof d === 'number' && Number.isFinite(d) && d > 0) return d;
	if (!d || typeof d !== 'string') return 0;
	const parts = d.split(':').map(Number);
	if (!parts.length || parts.some((n) => !Number.isFinite(n))) return 0;
	return parts.reduce((acc, n) => acc * 60 + n, 0);
}

/** Prefer the live mpv length; fall back to the catalog / queue string so restore is not 0:00. */
export function trackDurationSecs(opts: {
	playback?: number | null;
	catalog?: string | number | null;
	queue?: string | number | null;
}): number {
	return parseClock(opts.playback) || parseClock(opts.catalog) || parseClock(opts.queue) || 0;
}

export function fmtClock(secs: number): string {
	if (!secs || secs < 0) return '0:00';
	const t = Math.floor(secs);
	const h = Math.floor(t / 3600);
	const m = Math.floor((t % 3600) / 60);
	const s = t % 60;
	const mm = h ? m.toString().padStart(2, '0') : `${m}`;
	return `${h ? `${h}:` : ''}${mm}:${s.toString().padStart(2, '0')}`;
}
