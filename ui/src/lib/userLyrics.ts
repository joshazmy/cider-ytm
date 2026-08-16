/** Local user-pasted lyrics keyed by video id (Cider "user generated lyrics" analog on YTM). */

const KEY = 'yapel-user-lyrics-v1';

export function loadUserLyricsMap(): Record<string, string> {
	if (typeof localStorage === 'undefined') return {};
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== 'object') return {};
		const out: Record<string, string> = {};
		for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
			if (typeof v === 'string' && v.trim()) out[k] = v;
		}
		return out;
	} catch {
		return {};
	}
}

export function getUserLyrics(videoId: string, map = loadUserLyricsMap()): string | null {
	const t = map[videoId]?.trim();
	return t ? t : null;
}

export function setUserLyrics(videoId: string, text: string, map = loadUserLyricsMap()): Record<string, string> {
	const next = { ...map };
	const t = text.trim();
	if (t) next[videoId] = t;
	else delete next[videoId];
	if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(next));
	return next;
}
