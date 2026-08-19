import { convertFileSrc } from '@tauri-apps/api/core';

/** Clamp device pixel ratio for artwork requests: at least 2×, at most 3×. */
export function artworkDpr(raw: number): number {
	if (!Number.isFinite(raw) || raw <= 0) return 2;
	return Math.min(Math.max(raw, 2), 3);
}

/** YouTube channel letter tiles (`yt3.*`) paint a lone initial — never use them as album art. */
export function isLetterTile(url: string | undefined | null): boolean {
	if (!url) return false;
	return /\/\/yt3\./i.test(url);
}

const YTIMG = /^(https?:\/\/i\.ytimg\.com\/vi\/[^/]+)\/(maxresdefault|hq720|sddefault|hqdefault|mqdefault|default)(\.[a-zA-Z0-9]+)(.*)$/i;
const YTIMG_STEPS = ['maxresdefault', 'hq720', 'sddefault', 'hqdefault'] as const;

/** i.ytimg.com stills: try the largest file first (hqdefault is 480px and looks soft full-screen). */
export function ytimgLadder(url: string): string[] | null {
	const m = url.match(YTIMG);
	if (!m) return null;
	const [, base, , ext, rest] = m;
	return YTIMG_STEPS.map((name) => `${base}/${name}${ext}${rest}`);
}

export function rewriteThumbSize(url: string, cssPx: number, dpr: number): string {
	const size = Math.round(cssPx * artworkDpr(dpr));
	if (/=w\d+-h\d+/.test(url)) return url.replace(/=w\d+-h\d+/, `=w${size}-h${size}`);
	if (/=s\d+/.test(url)) return url.replace(/=s\d+/, `=s${size}`);
	if (cssPx >= 200) {
		const ladder = ytimgLadder(url);
		if (ladder) return ladder[0];
	}
	return url;
}

/** Largest-first sources for a full-bleed plate. Caller steps down on error. */
export function hiresCandidates(url: string | undefined | null, cssPx: number): string[] {
	if (!url || isLetterTile(url)) return [];
	const ytimg = ytimgLadder(url);
	if (ytimg) return ytimg;
	const dpr = typeof window !== 'undefined' ? artworkDpr(window.devicePixelRatio || 1) : 2;
	const sizes = [cssPx, Math.round(cssPx * 0.66), Math.round(cssPx * 0.4)];
	const out: string[] = [];
	for (const s of sizes) {
		const next = rewriteThumbSize(url, s, dpr);
		if (!out.includes(next)) out.push(next);
	}
	return out;
}

/** YouTube stills for a video id. Catalog art is often a yt3 letter tile; this is the real frame. */
export function videoStills(videoId: string | undefined | null): string[] {
	if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return [];
	return YTIMG_STEPS.map((name) => `https://i.ytimg.com/vi/${videoId}/${name}.jpg`);
}

/** Catalog thumb first (if it is not a letter tile), then the video still ladder. */
export function coverCandidates(
	url: string | undefined | null,
	videoId: string | undefined | null,
	cssPx: number
): string[] {
	const out: string[] = [];
	for (const u of [...hiresCandidates(url, cssPx), ...videoStills(videoId)]) {
		if (!out.includes(u)) out.push(u);
	}
	return out;
}

// Rewrite a Google image URL to (about) the pixel size a slot actually renders, so WebKitGTK
// doesn't decode a 544px (or 1080p) image for a 40px row. Only lh3/yt3 googleusercontent-style
// URLs carry the size in the URL (`=w544-h544` / `=s576` suffixes); anything else (notably
// i.ytimg.com path-variant thumbs, where other sizes can 404) is returned unchanged.
export function thumb(url: string | undefined | null, px: number): string | undefined {
	if (!url) return undefined;
	// Local library artwork is a path on this machine, not a URL. The webview can't open a bare
	// path, so hand it through Tauri's asset protocol. Kept here rather than at the command
	// boundary so what gets stored (queue, Shortcuts) stays the real path — which is also what
	// MPRIS needs.
	if (url.startsWith('/') || /^[A-Za-z]:[\\/]/.test(url)) return convertFileSrc(url);
	const dpr =
		typeof window !== 'undefined' ? artworkDpr(window.devicePixelRatio || 1) : 2;
	return rewriteThumbSize(url, px, dpr);
}
