// jsdom smoke test for the cinematic effects toolkit.
// jsdom has no WAAPI, so HTMLElement.prototype.animate is patched with a
// timed stub whose `finished` promise resolves after duration + delay and
// rejects on cancel — mirroring the real API surface the library relies on.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost/',
});

let reducedMotion = false;
dom.window.matchMedia = () => ({
  get matches() { return reducedMotion; },
  media: '(prefers-reduced-motion: reduce)',
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  onchange: null,
  dispatchEvent() { return false; },
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
dom.window.ResizeObserver = ResizeObserverStub;

let liveAnimations = 0;
dom.window.HTMLElement.prototype.animate = function animate(_keyframes, options) {
  const duration = (typeof options === 'number' ? options : options?.duration ?? 0);
  const delay = typeof options === 'object' ? options?.delay ?? 0 : 0;
  const iterations = typeof options === 'object' ? options?.iterations ?? 1 : 1;
  let settled = false;
  let resolveFinished;
  let rejectFinished;
  const finished = new Promise((res, rej) => { resolveFinished = res; rejectFinished = rej; });
  finished.catch(() => {});
  liveAnimations += 1;
  let tid = null;
  if (iterations !== Infinity) {
    tid = setTimeout(() => {
      if (!settled) {
        settled = true;
        liveAnimations -= 1;
        resolveFinished();
      }
    }, duration + delay);
  }
  return {
    finished,
    onfinish: null,
    oncancel: null,
    addEventListener() {},
    removeEventListener() {},
    cancel() {
      if (!settled) {
        settled = true;
        liveAnimations -= 1;
        if (tid !== null) clearTimeout(tid);
        rejectFinished(new Error('AbortError: animation cancelled'));
      }
    },
  };
};

const define = (name, value) => {
  try {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  } catch {
    globalThis[name] = value;
  }
};
define('window', dom.window);
define('document', dom.window.document);
define('navigator', dom.window.navigator);
define('HTMLElement', dom.window.HTMLElement);
define('Element', dom.window.Element);
define('Node', dom.window.Node);
define('getComputedStyle', dom.window.getComputedStyle.bind(dom.window));
define('requestAnimationFrame', dom.window.requestAnimationFrame.bind(dom.window));
define('cancelAnimationFrame', dom.window.cancelAnimationFrame.bind(dom.window));
define('ResizeObserver', ResizeObserverStub);
define('matchMedia', dom.window.matchMedia);
define('MutationObserver', dom.window.MutationObserver);
define('Image', dom.window.Image);

const React = (await import('react')).default;
const { createRoot } = await import('react-dom/client');
const { ChessiroCanvas } = await import('../dist/index.js');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let failures = 0;
function assert(cond, label) {
  if (cond) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${label}`);
  }
}
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise.then(() => true),
    sleep(ms).then(() => false),
  ]).then((done) => assert(done, label));
}

const container = document.getElementById('root');
const root = createRoot(container);
const ref = React.createRef();
root.render(React.createElement(ChessiroCanvas, { ref, interactive: false }));
await sleep(80);

assert(!!ref.current, 'board ref attached');
const countNodes = () => container.querySelectorAll('*').length;
const hiddenPieceCount = () =>
  [...container.querySelectorAll('div')].filter((d) => d.style.opacity === '0').length;
const baseline = countNodes();
assert(baseline > 0, 'board rendered');
assert(hiddenPieceCount() === 0, 'idle board has no hidden pieces');

console.log('\n-- cinematicMove (brilliant, badge, sparkles, shockwave) --');
const movePromise = ref.current.cinematicMove('e2', 'e4', { durationMs: 120, badge: '!!', force: true });
await sleep(40);
assert(countNodes() > baseline, 'cinematic overlay mounted during flight');
assert(hiddenPieceCount() === 1, 'origin piece hidden during flight');
await withTimeout(movePromise, 4000, 'cinematicMove resolved (after landing effects)');
await sleep(150);
assert(countNodes() === baseline, 'overlay fully unmounted after cinematicMove');
assert(hiddenPieceCount() === 0, 'hidden piece restored after cinematicMove');

console.log('\n-- squareBurst --');
const burstPromise = ref.current.squareBurst('d4', { durationMs: 100, force: true });
await sleep(30);
assert(countNodes() > baseline, 'burst overlay mounted');
await withTimeout(burstPromise, 2000, 'squareBurst resolved');
await sleep(100);
assert(countNodes() === baseline, 'burst overlay unmounted');

console.log('\n-- popBadge --');
const badgePromise = ref.current.popBadge('f7', { text: '!!', durationMs: 400, force: true });
await sleep(30);
assert(countNodes() > baseline, 'badge overlay mounted');
assert(container.textContent.includes('!!'), 'badge text rendered');
await withTimeout(badgePromise, 2000, 'popBadge resolved');
await sleep(100);
assert(countNodes() === baseline, 'badge overlay unmounted');

console.log('\n-- clearCinematics mid-flight --');
const longMove = ref.current.cinematicMove('d2', 'd4', { durationMs: 5000, force: true });
await sleep(40);
assert(countNodes() > baseline, 'long move overlay mounted');
assert(hiddenPieceCount() === 1, 'long move origin hidden');
ref.current.clearCinematics();
await withTimeout(longMove, 500, 'pending cinematicMove resolved by clearCinematics');
await sleep(100);
assert(countNodes() === baseline, 'clearCinematics unmounted all overlay nodes');
assert(hiddenPieceCount() === 0, 'clearCinematics restored the hidden piece');

console.log('\n-- playCinematic script (camera + move + call + parallel) --');
let committed = false;
const boardDivsWithTransform = () =>
  [...container.querySelectorAll('div')].filter((d) => d.style.transform.includes('scale(2)'));
const playback = ref.current.playCinematic([
  { type: 'camera', action: 'zoomTo', square: 'e4', options: { scale: 2, durationMs: 40 } },
  { type: 'move', from: 'g1', to: 'f3', options: { style: 'smooth', durationMs: 100 } },
  { type: 'call', fn: () => { committed = true; } },
  {
    type: 'parallel',
    steps: [
      { type: 'burst', square: 'f3', options: { durationMs: 60 } },
      { type: 'badge', square: 'f3', options: { text: '?!', durationMs: 400 } },
      { type: 'wait', ms: 50 },
    ],
  },
  { type: 'camera', action: 'shake', options: { durationMs: 40 } },
  { type: 'camera', action: 'reset' },
], { force: true });
await sleep(120);
assert(boardDivsWithTransform().length === 1, 'camera zoom applied scale(2) to board root');
await withTimeout(playback.finished, 4000, 'playCinematic finished');
assert(committed, "'call' step executed");
assert(boardDivsWithTransform().length === 0, 'camera reset cleared board transform');
await sleep(150);
assert(countNodes() === baseline, 'script left zero cinematic DOM nodes');
assert(hiddenPieceCount() === 0, 'script restored all pieces');

console.log('\n-- playCinematic cancellation --');
let laterStepRan = false;
const playback2 = ref.current.playCinematic([
  { type: 'wait', ms: 5000 },
  { type: 'call', fn: () => { laterStepRan = true; } },
], { force: true });
await sleep(30);
playback2.cancel();
await withTimeout(playback2.finished, 500, 'cancelled playback finished promise resolved');
assert(!laterStepRan, 'steps after cancel did not run');

console.log('\n-- camera drift + reset --');
const drift = ref.current.camera.drift({ durationMs: 1000 });
await sleep(30);
drift.stop();
ref.current.camera.reset();
assert(true, 'drift start/stop/reset did not throw');

console.log('\n-- prefers-reduced-motion --');
reducedMotion = true;
const preCount = countNodes();
await withTimeout(ref.current.squareBurst('e4'), 200, 'reduced-motion burst resolved immediately');
assert(countNodes() === preCount, 'reduced-motion burst mounted nothing');
await withTimeout(ref.current.popBadge('e4', { text: '!' }), 200, 'reduced-motion badge resolved immediately');
await withTimeout(ref.current.camera.zoomTo('e4'), 200, 'reduced-motion camera resolved immediately');
assert(boardDivsWithTransform().length === 0, 'reduced-motion camera did not transform the board');
const reducedMove = ref.current.cinematicMove('b1', 'c3', { durationMs: 80 });
await sleep(20);
assert(countNodes() > preCount, 'reduced-motion move still glides (overlay mounted)');
await withTimeout(reducedMove, 2000, 'reduced-motion move resolved');
await sleep(120);
assert(countNodes() === preCount, 'reduced-motion move cleaned up');
reducedMotion = false;

console.log('\n-- unmount safety --');
const pendingAtUnmount = ref.current.cinematicMove('e2', 'e4', { durationMs: 5000, force: true });
await sleep(30);
root.unmount();
await withTimeout(pendingAtUnmount, 500, 'pending cinematicMove resolved on unmount');
await sleep(50);
assert(liveAnimations === 0, 'no stray WAAPI animations after unmount');

if (failures > 0) {
  console.error(`\n${failures} cinematic test(s) failed`);
  process.exit(1);
}
console.log('\ncinematic tests passed');
