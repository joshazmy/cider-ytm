// node --experimental-strip-types ui/src/lib/yturl.check.ts
import { parseYtmUrl } from './yturl.ts';

const eq = (a: unknown, b: unknown, msg: string) => {
	if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
};

eq(parseYtmUrl('not a url'), null, 'plain text');
eq(
	parseYtmUrl('https://music.youtube.com/watch?v=abc123'),
	{ kind: 'video', id: 'abc123' },
	'ytm watch'
);
eq(parseYtmUrl('https://youtu.be/xyz'), { kind: 'video', id: 'xyz' }, 'youtu.be');
eq(
	parseYtmUrl('https://www.youtube.com/watch?v=abc&list=PLxx'),
	{ kind: 'video', id: 'abc' },
	'watch wins over list'
);
eq(
	parseYtmUrl('https://music.youtube.com/playlist?list=PLxx'),
	{ kind: 'playlist', id: 'VLPLxx' },
	'playlist'
);
eq(
	parseYtmUrl('https://music.youtube.com/channel/UCabc'),
	{ kind: 'channel', id: 'UCabc' },
	'channel'
);
eq(parseYtmUrl('https://music.apple.com/us/album/x'), null, 'no apple');

console.log('yturl.check.ts ok');
