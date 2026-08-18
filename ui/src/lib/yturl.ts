export type YtmLink =
	| { kind: 'video'; id: string }
	| { kind: 'playlist'; id: string }
	| { kind: 'channel'; id: string };

/** Parse a YouTube / YouTube Music URL. Not Apple Music. */
export function parseYtmUrl(raw: string): YtmLink | null {
	const t = raw.trim();
	if (!/^https?:\/\//i.test(t)) return null;
	let u: URL;
	try {
		u = new URL(t);
	} catch {
		return null;
	}
	const host = u.hostname.replace(/^www\./i, '').toLowerCase();
	if (host === 'youtu.be') {
		const id = u.pathname.replace(/^\//, '').split('/')[0];
		return id ? { kind: 'video', id } : null;
	}
	if (host !== 'music.youtube.com' && host !== 'youtube.com' && host !== 'm.youtube.com') {
		return null;
	}
	const v = u.searchParams.get('v');
	if (v) return { kind: 'video', id: v };
	const list = u.searchParams.get('list');
	if (list && !list.startsWith('RD')) {
		const id = list.startsWith('VL') ? list : `VL${list}`;
		return { kind: 'playlist', id };
	}
	const ch = u.pathname.match(/\/channel\/([^/]+)/);
	if (ch?.[1]) return { kind: 'channel', id: ch[1] };
	const browse = u.pathname.match(/\/browse\/([^/]+)/);
	if (browse?.[1]?.startsWith('UC')) return { kind: 'channel', id: browse[1] };
	return null;
}
