// node --experimental-strip-types ui/src/lib/clock.check.ts
import { fmtClock, parseClock, trackDurationSecs } from './clock.ts';

const eq = (a: unknown, b: unknown, msg: string) => {
	if (a !== b) throw new Error(`${msg}: ${a} !== ${b}`);
};

eq(parseClock('3:21'), 201, 'm:ss');
eq(parseClock('1:02:03'), 3723, 'h:mm:ss');
eq(parseClock(201), 201, 'numeric seconds');
eq(parseClock(0), 0, 'zero is empty');
eq(parseClock(''), 0, 'empty string');
eq(parseClock(undefined), 0, 'missing');
eq(parseClock('nope'), 0, 'garbage');

eq(trackDurationSecs({ playback: 0, catalog: '3:21' }), 201, 'catalog when mpv is 0');
eq(trackDurationSecs({ playback: 180, catalog: '3:21' }), 180, 'live mpv wins');
eq(trackDurationSecs({ playback: 0, catalog: '', queue: '4:00' }), 240, 'queue fallback');
eq(trackDurationSecs({ playback: 0 }), 0, 'all empty');

eq(fmtClock(201), '3:21', 'fmt m:ss');
eq(fmtClock(3723), '1:02:03', 'fmt h:mm:ss');
eq(fmtClock(0), '0:00', 'fmt empty');

console.log('clock.check.ts ok');
