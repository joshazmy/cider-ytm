// Self-check for the play-control glyph rule.
//
//     node --experimental-strip-types ui/src/lib/transport.check.ts
//
import { nextPaused, transportGlyph } from './transport.ts';

const eq = (a: unknown, b: unknown, msg: string) => {
	if (a !== b) throw new Error(`${msg}: ${a} !== ${b}`);
};

eq(transportGlyph(true), 'play', 'paused shows play');
eq(transportGlyph(false), 'pause', 'playing shows pause');
eq(nextPaused(true), false, 'click while paused starts playback');
eq(nextPaused(false), true, 'click while playing pauses');

console.log('ok');
