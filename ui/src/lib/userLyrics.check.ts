//     node --experimental-strip-types ui/src/lib/userLyrics.check.ts
import { getUserLyrics, setUserLyrics } from './userLyrics.ts';

const eq = (a: unknown, b: unknown, msg: string) => {
	if (a !== b) throw new Error(`${msg}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
};

const mem: Record<string, string> = {};
eq(getUserLyrics('vid1', mem), null, 'empty');
const after = setUserLyrics('vid1', '  hello\nworld  ', mem);
eq(getUserLyrics('vid1', after), 'hello\nworld', 'stores trimmed');
const cleared = setUserLyrics('vid1', '   ', after);
eq(getUserLyrics('vid1', cleared), null, 'blank deletes');

console.log('ok');
