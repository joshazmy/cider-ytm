import { convertFileSrc } from '@tauri-apps/api/core';

/** Clamp device pixel ratio for artwork requests: at least 2×, at most 3×. */
export function artworkDpr(raw: number): number {
	if (!Number.isFinite(raw) || raw <= 0) return 2;
	return Math.min(Math.max(raw, 2), 3);
}

/**
 * Rewrite a resizable Googleusercontent thumb to `cssPx * dpr` (Cider hiresImages analog).
 * Non-rewritable URLs (i.ytimg.com, already-sized local, garbage) are returned unchanged.
 */
export function rewriteThumbSize(url: string, cssPx: number, dpr: number): string {
	const size = Math.round(cssPx * artworkDpr(dpr));
	if (/=w\d+-h\d+/.test(url)) return url.replace(/=w\d+-h\d+/, `=w${size}-h${size}`);
	if (/=s\d+/.test(url)) return url.replace(/=s\d+/, `=s${size}`);
	return url;
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
