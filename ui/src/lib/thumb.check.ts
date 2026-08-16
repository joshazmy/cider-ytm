// Self-check for artwork size rewrite (Cider hiresImages analog).
//
//     node --experimental-strip-types ui/src/lib/thumb.check.ts
//
import { artworkDpr, isLetterTile, rewriteThumbSize } from './thumb.ts';

const eq = (a: unknown, b: unknown, msg: string) => {
	if (a !== b) throw new Error(`${msg}: ${a} !== ${b}`);
};

eq(artworkDpr(1), 2, 'dpr 1 floors to 2×');
eq(artworkDpr(2), 2, 'dpr 2 stays 2×');
eq(artworkDpr(3), 3, 'dpr 3 stays 3×');
eq(artworkDpr(4), 3, 'dpr 4 caps at 3×');
eq(artworkDpr(0), 2, 'dpr 0 floors to 2×');

const wUrl = 'https://yt3.googleusercontent.com/abc=w40-h40-c-k';
eq(
	rewriteThumbSize(wUrl, 40, 2),
	'https://yt3.googleusercontent.com/abc=w80-h80-c-k',
	'w/h 2×'
);
eq(
	rewriteThumbSize(wUrl, 40, 3),
	'https://yt3.googleusercontent.com/abc=w120-h120-c-k',
	'w/h 3×'
);

const sUrl = 'https://lh3.googleusercontent.com/xyz=s96';
eq(rewriteThumbSize(sUrl, 48, 2), 'https://lh3.googleusercontent.com/xyz=s96', 's 2× of 48');
eq(rewriteThumbSize(sUrl, 40, 2), 'https://lh3.googleusercontent.com/xyz=s80', 's 2× of 40');

const ytimg = 'https://i.ytimg.com/vi/abc/hqdefault.jpg';
eq(rewriteThumbSize(ytimg, 200, 2), ytimg, 'ytimg unchanged');

const already = 'https://example.com/cover.png';
eq(rewriteThumbSize(already, 200, 2), already, 'plain url unchanged');

eq(isLetterTile('https://yt3.googleusercontent.com/abc=s88'), true, 'yt3 is a letter tile');
eq(isLetterTile('https://yt3.ggpht.com/xyz'), true, 'yt3 ggpht is a letter tile');
eq(isLetterTile('https://lh3.googleusercontent.com/cover=w544-h544'), false, 'lh3 album art');
eq(isLetterTile('https://i.ytimg.com/vi/abc/hqdefault.jpg'), false, 'ytimg video thumb');
eq(isLetterTile(undefined), false, 'empty');

console.log('ok');
