//     node --experimental-strip-types ui/src/lib/userLyrics.check.ts
import { applyUserLyricsSave, getUserLyrics, lyricsFromUserText, setUserLyrics } from './userLyrics.ts';

const eq = (a: unknown, b: unknown, msg: string) => {
	if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
};

const mem: Record<string, string> = {};
eq(getUserLyrics('vid1', mem), null, 'empty');
const after = setUserLyrics('vid1', '  hello\nworld  ', mem);
eq(getUserLyrics('vid1', after), 'hello\nworld', 'stores trimmed');
const cleared = setUserLyrics('vid1', '   ', after);
eq(getUserLyrics('vid1', cleared), null, 'blank deletes');

// Save path LyricsView.saveMine uses — must produce display lyrics without a track change.
const draft = 'line one\nline two';
const saved = applyUserLyricsSave('abc123', draft, {});
eq(saved.lyrics?.source, 'You', 'source You');
eq(saved.lyrics?.synced, false, 'unsynced');
eq(
	saved.lyrics?.lines.map((l) => l.text),
	['line one', 'line two'],
	'lines from draft'
);
eq(getUserLyrics('abc123', saved.stored), draft, 'persisted for same videoId');
eq(lyricsFromUserText('   '), null, 'blank paste is no lyrics');

console.log('ok');

