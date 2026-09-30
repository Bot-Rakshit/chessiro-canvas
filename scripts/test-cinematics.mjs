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
// Every animate() call is logged so tests can assert on the keyframes an effect
// actually produced (jsdom applies none of them to the element).
const animationLog = [];
dom.window.HTMLElement.prototype.animate = function animate(keyframes, options) {
  const record = { target: this, keyframes, options, cancelled: false };
  animationLog.push(record);
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
      record.cancelled = true;
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
const { flushSync } = await import('react-dom');
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

async function waitFor(predicate, ms, label) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (predicate()) { assert(true, label); return; }
    await sleep(20);
  }
  assert(predicate(), label);
}

const container = document.getElementById('root');
const root = createRoot(container);
const ref = React.createRef();
root.render(React.createElement(ChessiroCanvas, { ref, interactive: false }));
await sleep(80);

assert(!!ref.current, 'board ref attached');
const countNodes = () => container.querySelectorAll('*').length;
// Board pieces hidden by the layer — overlay nodes (trail ghosts, flashes,
// confetti) legitimately start at opacity 0 and must not be counted.
const hiddenPieceCount = () =>
  [...container.querySelectorAll('div')].filter(
    (d) => d.style.opacity === '0' && !d.closest('[data-cine-overlay]'),
  ).length;

const START_POSITION = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR';
const pieceOuters = (pieceKey) =>
  [...container.querySelectorAll(`img[alt="${pieceKey}"]`)]
    .map((img) => img.parentElement?.parentElement)
    .filter(Boolean);

console.log('\n-- piece animation interruption + cleanup --');
flushSync(() => root.render(React.createElement(ChessiroCanvas, {
  ref,
  position: START_POSITION,
  interactive: false,
  showAnimations: false,
})));
const logBeforeMove = animationLog.length;
flushSync(() => root.render(React.createElement(ChessiroCanvas, {
  ref,
  position: AFTER_E4,
  interactive: false,
  showAnimations: true,
  animationDurationMs: 300,
})));
{
  const moveAnims = animationLog.slice(logBeforeMove);
  const e4Pawn = pieceOuters('wP').find((el) => el.style.transform === 'translate(400%, 400%)');
  assert(
    moveAnims.length === 1 && moveAnims[0].target === e4Pawn,
    'position move animated only the moved piece',
  );
  const kf = moveAnims[0]?.keyframes ?? [];
  assert(
    kf[0]?.transform === 'translate(400%, 600%)' && kf[kf.length - 1]?.transform === 'translate(400%, 400%)'
      && kf.every((k) => k.zIndex === '8'),
    'move keyframes glide e2 -> e4 raised above other pieces',
  );
}

flushSync(() => root.render(React.createElement(ChessiroCanvas, {
  ref,
  position: AFTER_E4,
  orientation: 'black',
  interactive: false,
  showAnimations: true,
  animationDurationMs: 300,
})));
flushSync(() => root.render(React.createElement(ChessiroCanvas, {
  ref,
  position: AFTER_E4,
  orientation: 'black',
  interactive: false,
  showAnimations: false,
})));
const interruptedPiece = pieceOuters('wP')
  .find((el) => el.style.transform === 'translate(300%, 300%)');
assert(
  interruptedPiece?.style.willChange === '' && interruptedPiece?.style.zIndex === '2',
  'orientation flip + interruption restored the resting transform',
);

const BEFORE_CAPTURE = '8/8/8/3p4/4P3/8/8/8';
const AFTER_CAPTURE = '8/8/8/3P4/8/8/8/8';
flushSync(() => root.render(React.createElement(ChessiroCanvas, {
  ref,
  position: BEFORE_CAPTURE,
  interactive: false,
  showAnimations: false,
})));
flushSync(() => root.render(React.createElement(ChessiroCanvas, {
  ref,
  position: AFTER_CAPTURE,
  interactive: false,
  showAnimations: true,
  animationDurationMs: 120,
})));
await sleep(30);
assert(pieceOuters('bP').length === 1, 'capture fade mounted the captured piece');
await sleep(220);
assert(pieceOuters('bP').length === 0, 'capture fade removed the captured piece');
assert(
  pieceOuters('wP').every((el) => el.style.willChange === '' && el.style.zIndex === '2'),
  'capture animation restored resting piece styles',
);

let dragMoveCommitted = false;
const dragDests = new Map([['e2', ['e4']]]);
const renderDragBoard = (position) => {
  root.render(React.createElement(ChessiroCanvas, {
    ref,
    position,
    dests: dragDests,
    turnColor: 'w',
    movableColor: 'w',
    interactive: true,
    showAnimations: true,
    animationDurationMs: 300,
    onMove: (from, to) => {
      dragMoveCommitted = from === 'e2' && to === 'e4';
      flushSync(() => renderDragBoard(AFTER_E4));
      return true;
    },
  }));
};
flushSync(() => root.render(React.createElement(ChessiroCanvas, {
  ref,
  position: START_POSITION,
  interactive: false,
  showAnimations: false,
})));
flushSync(() => renderDragBoard(START_POSITION));
const dragBoardElement = [...container.querySelectorAll('div')]
  .find((element) => element.style.paddingBottom === '100%');
if (!dragBoardElement) throw new Error('could not find board element for drag test');
Object.defineProperties(dragBoardElement, {
  offsetWidth: { configurable: true, get: () => 800 },
  offsetHeight: { configurable: true, get: () => 800 },
  getBoundingClientRect: {
    configurable: true,
    value: () => ({
      x: 0, y: 0, left: 0, top: 0,
      right: 800, bottom: 800, width: 800, height: 800,
      toJSON: () => ({}),
    }),
  },
});
dragBoardElement.dispatchEvent(new dom.window.MouseEvent('mousedown', {
  bubbles: true, button: 0, clientX: 450, clientY: 650,
}));
await sleep(0);
document.dispatchEvent(new dom.window.MouseEvent('mousemove', {
  bubbles: true, button: 0, clientX: 450, clientY: 450,
}));
await sleep(0);
document.dispatchEvent(new dom.window.MouseEvent('mouseup', {
  bubbles: true, button: 0, clientX: 450, clientY: 450,
}));
await sleep(50);
const droppedPiece = pieceOuters('wP')
  .find((el) => el.style.transform === 'translate(400%, 400%)');
assert(dragMoveCommitted, 'drag-drop committed the expected move');
assert(
  droppedPiece?.style.willChange === '' && droppedPiece?.style.zIndex === '2',
  'drag-drop release skipped and cleaned the position animation',
);

flushSync(() => root.render(React.createElement(ChessiroCanvas, {
  ref,
  interactive: false,
  showAnimations: false,
})));
await sleep(50);
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

console.log('\n-- frame-accurate impact (trail, flash, victim blast, onImpact) --');
const t0 = Date.now();
let impactAt = 0;
let impactCalls = 0;
const captureMove = ref.current.cinematicMove('d1', 'd7', {
  durationMs: 300,
  force: true,
  onImpact: () => { impactCalls += 1; impactAt = Date.now(); },
});
await sleep(100);
assert(container.querySelectorAll('[data-cine-trail]').length === 4, 'brilliant move mounts 4 trail ghosts');
assert(hiddenPieceCount() === 1, 'only origin hidden before impact (victim still standing)');
await sleep(150); // ~250ms: impact fired at ~210ms (landStart 0.7)
assert(impactCalls === 1, 'onImpact fired exactly once by touchdown');
assert(hiddenPieceCount() === 2, 'victim hidden at impact (blast in flight)');
assert(
  [...container.querySelectorAll('[data-cine-overlay] div')].some((d) => String(d.style.background).includes('radial-gradient')),
  'impact flash mounted at touchdown',
);
const resolveAt = await withTimeout(captureMove, 4000, 'capture move resolved').then(() => Date.now());
assert(impactAt > 0 && impactAt - t0 >= 150 && impactAt - t0 <= 450, `impact fired near touchdown (+${impactAt - t0}ms)`);
assert(resolveAt - impactAt >= 200, 'impact fired well before the move resolved');
await sleep(150);
assert(countNodes() === baseline, 'capture move overlay fully unmounted');
assert(hiddenPieceCount() === 0, 'origin and victim pieces restored');

console.log('\n-- celebrate (confetti + fireworks) --');
const celebratePromise = ref.current.celebrate({ durationMs: 500, force: true });
await sleep(60);
assert(countNodes() > baseline, 'celebration overlay mounted');
await withTimeout(celebratePromise, 4000, 'celebrate resolved');
await sleep(150);
assert(countNodes() === baseline, 'celebration overlay unmounted');

console.log('\n-- popBanner --');
const bannerPromise = ref.current.popBanner({ text: 'CHECKMATE', durationMs: 500, force: true });
await sleep(50);
assert(container.textContent.includes('CHECKMATE'), 'banner text rendered');
await withTimeout(bannerPromise, 2000, 'popBanner resolved');
await sleep(100);
assert(countNodes() === baseline, 'banner unmounted');

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
  { type: 'banner', options: { text: 'GG', durationMs: 300 } },
  { type: 'celebrate', options: { kind: 'confetti', durationMs: 300 } },
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
await withTimeout(ref.current.celebrate(), 200, 'reduced-motion celebrate resolved immediately');
await withTimeout(ref.current.popBanner({ text: 'GG' }), 200, 'reduced-motion banner resolved immediately');
assert(countNodes() === preCount, 'reduced-motion celebrate/banner mounted nothing');
await withTimeout(ref.current.camera.zoomTo('e4'), 200, 'reduced-motion camera resolved immediately');
assert(boardDivsWithTransform().length === 0, 'reduced-motion camera did not transform the board');
const reducedMove = ref.current.cinematicMove('b1', 'c3', { durationMs: 80 });
await sleep(20);
assert(countNodes() > preCount, 'reduced-motion move still glides (overlay mounted)');
await withTimeout(reducedMove, 2000, 'reduced-motion move resolved');
await sleep(120);
assert(countNodes() === preCount, 'reduced-motion move cleaned up');
reducedMotion = false;

console.log('\n-- promotionBeam (pillar of light + morph) --');
const promoPromise = ref.current.promotionBeam('a7', { fromPiece: 'wP', piece: 'wQ', durationMs: 300, force: true });
await sleep(60);
assert(countNodes() > baseline, 'promotionBeam overlay mounted');
assert(
  [...container.querySelectorAll('[data-cine-overlay] *')].length > 0,
  'promotionBeam rendered beam nodes',
);
await withTimeout(promoPromise, 4000, 'promotionBeam resolved');
await sleep(200);
assert(countNodes() === baseline, 'promotionBeam overlay unmounted');
assert(hiddenPieceCount() === 0, 'promotionBeam restored the morphed square');

console.log('\n-- implode (black hole) --');
const implodePromise = ref.current.implode('b8', { durationMs: 250, force: true });
await sleep(50);
assert(countNodes() > baseline, 'implode overlay mounted');
assert(hiddenPieceCount() === 1, 'implode hid the victim piece');
await withTimeout(implodePromise, 3000, 'implode resolved');
await sleep(200);
assert(countNodes() === baseline, 'implode overlay unmounted');
assert(hiddenPieceCount() === 0, 'implode restored the hidden square');

console.log('\n-- castleSwap (king + rook fly together) --');
const castlePromise = ref.current.castleSwap('e1', 'g1', 'h1', 'f1', { durationMs: 200, force: true });
await sleep(60);
assert(hiddenPieceCount() === 2, 'castleSwap hides both king and rook origins');
await withTimeout(castlePromise, 4000, 'castleSwap resolved');
await sleep(200);
assert(countNodes() === baseline, 'castleSwap overlay unmounted');
assert(hiddenPieceCount() === 0, 'castleSwap restored both pieces');

console.log('\n-- drawLaser (animated threat beam) --');
const laserPromise = ref.current.drawLaser('c1', 'h6', { durationMs: 150, holdMs: 50, force: true });
await sleep(60);
const laserBeams = () => container.querySelectorAll('[data-laser-beam]').length;
assert(laserBeams() === 1, 'laser beam mounted while drawing');
await withTimeout(laserPromise, 3000, 'drawLaser resolved (draw + hold + fade)');
await sleep(150);
assert(countNodes() === baseline, 'laser overlay unmounted after fade');

console.log('\n-- drawLaser persist + clearCinematics --');
const persistLaser = ref.current.drawLaser('a1', 'a8', { durationMs: 100, persist: true, force: true });
await withTimeout(persistLaser, 2000, 'persistent laser resolved after draw');
assert(container.querySelectorAll('[data-laser-beam]').length === 1, 'persistent laser stays on board');
ref.current.clearCinematics();
await sleep(80);
assert(countNodes() === baseline, 'clearCinematics removed the persistent laser');

console.log('\n-- spotlight (dim vignette) + clear --');
const spot = ref.current.spotlight(['c4', 'f7'], { durationMs: 80, force: true });
await sleep(40);
const dimNodes = () => [...container.querySelectorAll('[data-cine-overlay] > div')].filter(
  (d) => String(d.style.maskImage || d.style.webkitMaskImage).includes('radial-gradient'),
).length;
assert(dimNodes() === 1, 'spotlight dim overlay mounted with mask holes');
await withTimeout(spot.clear(60), 2000, 'spotlight clear() resolved');
await sleep(80);
assert(countNodes() === baseline, 'spotlight overlay unmounted after clear');

console.log('\n-- spotlight cleared by clearCinematics --');
ref.current.spotlight(['e4'], { durationMs: 80, force: true });
await sleep(40);
assert(dimNodes() === 1, 'second spotlight mounted');
ref.current.clearCinematics();
await sleep(60);
assert(countNodes() === baseline, 'clearCinematics removed the spotlight');

console.log('\n-- checkmate (king topple) --');
const matePieces = () => container.querySelectorAll('[data-mate-piece]').length;
const mateDim = () => container.querySelectorAll('[data-mate-dim]').length;
const matePromise = ref.current.checkmate('e1', { durationMs: 120, banner: null, force: true });
await sleep(40);
assert(matePieces() === 1, 'toppling king mounted');
assert(mateDim() === 1, 'board dimmed during the topple');
assert(hiddenPieceCount() === 1, 'real king hidden while it topples');
await withTimeout(matePromise, 3000, 'checkmate resolved');
await sleep(150);
assert(countNodes() === baseline, 'topple overlay unmounted');
assert(hiddenPieceCount() === 0, 'real king restored after topple');

// dim:false must not mount the dimmer, and direction is explicit-overridable.
await withTimeout(
  ref.current.checkmate('e1', { durationMs: 60, banner: null, dim: false, direction: 'left', force: true }),
  3000,
  'checkmate honoured dim:false + direction:left',
);
await sleep(120);
assert(countNodes() === baseline, 'undimmed topple cleaned up');

// The banner is part of the beat, so the promise must outlast the fall.
const mateBanner = ref.current.checkmate('e1', { durationMs: 60, force: true });
// The banner pops once the king has landed, so poll rather than guessing a
// sleep: the topple must unmount first and jsdom's timers are loose.
await waitFor(() => container.textContent.includes('CHECKMATE'), 2000,
  'checkmate popped its CHECKMATE banner after the king landed');
await withTimeout(mateBanner, 4000, 'checkmate with banner resolved');
await sleep(150);
assert(countNodes() === baseline, 'banner + topple fully unmounted');

// A square with no piece must not hang the promise.
await withTimeout(
  ref.current.checkmate('d5', { durationMs: 60, banner: null, force: true }),
  2000,
  'checkmate on an empty square still resolves',
);
await sleep(100);

console.log('\n-- tiltPiece (piece leans about its own centre) --');
const kingInner = () => pieceOuters('wK')[0]?.firstElementChild ?? null;
// The tilt rides the real piece element, so grab the animation logged against it.
const tiltRecordSince = (start) => animationLog.slice(start).find((r) => r.target === kingInner());
const lastFrame = (rec) => String(rec.keyframes[rec.keyframes.length - 1].transform);
const firstFrame = (rec) => String(rec.keyframes[0].transform);
const tiltBaseline = countNodes();
assert(!!kingInner(), 'white king element found for tilting');

let logAt = animationLog.length;
const tiltDone = ref.current.tiltPiece('e1', { angle: 60, durationMs: 80, force: true });
const tiltRec = tiltRecordSince(logAt);
assert(!!tiltRec, 'tiltPiece animated the real king element (no overlay clone)');
assert(lastFrame(tiltRec).includes('rotateZ(60deg)'), 'tilt leans right by the requested angle');
assert(
  tiltRec.keyframes.every((k) => k.transformOrigin === '50% 50%'),
  'tilt pivots on the centre of the piece',
);
assert(
  tiltRec.options.duration === 80 && tiltRec.options.fill === 'forwards',
  'tilt runs for the requested duration and holds the angle',
);
await withTimeout(tiltDone, 2000, 'tiltPiece resolved');
assert(countNodes() === tiltBaseline, 'tiltPiece mounted no nodes');
assert(!tiltRec.cancelled, 'held tilt is still applied after the promise resolves');

logAt = animationLog.length;
const untiltDone = ref.current.resetPieceTilt('e1', 40);
const untiltRec = tiltRecordSince(logAt);
assert(!!untiltRec, 'resetPieceTilt animated the king back');
assert(firstFrame(untiltRec).includes('rotateZ(60deg)'), 'reset starts from the angle being held');
assert(lastFrame(untiltRec).includes('rotateZ(0deg)'), 'reset ends upright');
await withTimeout(untiltDone, 2000, 'resetPieceTilt resolved');
assert(untiltRec.cancelled, 'reset released its fill so the piece owns its transform again');

// direction:'left' mirrors the angle.
logAt = animationLog.length;
await withTimeout(
  ref.current.tiltPiece('e1', { angle: 30, durationMs: 40, direction: 'left', force: true }),
  2000,
  "tilt direction:'left' resolved",
);
assert(lastFrame(tiltRecordSince(logAt)).includes('rotateZ(-30deg)'), "direction:'left' leans the other way");

// A second tilt continues from wherever the piece already leans.
logAt = animationLog.length;
await withTimeout(
  ref.current.tiltPiece('e1', { angle: 70, durationMs: 40, force: true }),
  2000,
  'stacked tilt resolved',
);
assert(firstFrame(tiltRecordSince(logAt)).includes('rotateZ(-30deg)'), 'a second tilt starts from the held angle');
await withTimeout(ref.current.resetPieceTilt(), 2000, 'resetPieceTilt without a square reset every tilt');

// hold:false leans over and springs back within the same duration.
logAt = animationLog.length;
await withTimeout(
  ref.current.tiltPiece('e1', { angle: 20, durationMs: 40, hold: false, force: true }),
  2000,
  'hold:false tilt resolved',
);
const springRec = tiltRecordSince(logAt);
assert(springRec.keyframes.length === 4, 'hold:false tilts over, holds briefly and returns');
assert(lastFrame(springRec).includes('rotateZ(0deg)'), 'hold:false ends upright');
await sleep(40);
assert(springRec.cancelled, 'a sprung tilt stops tracking the square once upright');

// holdMs waits at the angle, then stands the piece back up unaided.
logAt = animationLog.length;
const timedDone = ref.current.tiltPiece('e1', { angle: 50, durationMs: 40, holdMs: 60, force: true });
const timedRec = tiltRecordSince(logAt);
assert(timedRec.options.duration === 140, 'holdMs adds the wait plus the return trip to the duration');
assert(timedRec.keyframes.length === 4, 'timed hold leans over, waits and returns');
assert(
  String(timedRec.keyframes[1].transform).includes('rotateZ(50deg)')
    && String(timedRec.keyframes[2].transform).includes('rotateZ(50deg)'),
  'timed hold sits at the angle for the whole wait',
);
assert(
  Math.abs(timedRec.keyframes[1].offset - 40 / 140) < 1e-9
    && Math.abs(timedRec.keyframes[2].offset - 100 / 140) < 1e-9,
  'the wait occupies exactly holdMs of the timeline',
);
assert(lastFrame(timedRec).includes('rotateZ(0deg)'), 'timed hold ends upright');
await withTimeout(timedDone, 2000, 'timed hold resolved once the piece was upright again');
assert(timedRec.cancelled, 'a timed hold stops tracking the square once upright');

// clearTeachingEffects is the blunt escape hatch: held tilts snap upright.
logAt = animationLog.length;
await withTimeout(
  ref.current.tiltPiece('e1', { angle: 84, durationMs: 40, force: true }),
  2000,
  'tilt before clearTeachingEffects resolved',
);
const clearedRec = tiltRecordSince(logAt);
ref.current.clearTeachingEffects();
assert(clearedRec.cancelled, 'clearTeachingEffects snaps held tilts upright');

// Empty squares and no-op resets must never hang.
await withTimeout(ref.current.tiltPiece('d5', { durationMs: 40, force: true }), 1000,
  'tilt on an empty square still resolves');
await withTimeout(ref.current.resetPieceTilt('e1'), 1000, 'reset of an untilted square resolves');
await withTimeout(ref.current.tiltPiece('zz', {}), 1000, 'tilt of an invalid square resolves');
await sleep(60);
assert(countNodes() === tiltBaseline, 'tilts left no nodes behind');

// A tilt belongs to a piece, not to a square. When the tilted piece leaves and
// another arrives, the newcomer inherited no angle: resetting must not whip it
// back from an angle it never leaned to, and re-tilting must start upright.
console.log('\n-- tilt bookkeeping when the tilted piece leaves the square --');
await withTimeout(
  ref.current.tiltPiece('e1', { angle: 84, durationMs: 20, force: true }),
  2000,
  'tilted the king before replacing it',
);
// King gone from e1, a rook standing there instead.
const KING_REPLACED = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQRBN1';
root.render(React.createElement(ChessiroCanvas, { ref, interactive: false, position: KING_REPLACED }));
await sleep(120);
const newcomer = () => pieceOuters('wR').map((o) => o.firstElementChild);

logAt = animationLog.length;
await withTimeout(ref.current.resetPieceTilt('e1', 30), 1000, 'reset of a replaced piece resolves');
assert(
  !animationLog.slice(logAt).some((r) => newcomer().includes(r.target)),
  'resetting a replaced square leaves the new piece alone',
);

logAt = animationLog.length;
await withTimeout(
  ref.current.tiltPiece('e1', { angle: 84, durationMs: 20, force: true }),
  2000,
  'tilting the replacement piece resolves',
);
const newcomerRec = animationLog.slice(logAt).find((r) => newcomer().includes(r.target));
assert(!!newcomerRec, 'the replacement piece can still be tilted');
assert(firstFrame(newcomerRec).includes('rotateZ(0deg)'), 'the replacement piece tilts from upright');
assert(lastFrame(newcomerRec).includes('rotateZ(84deg)'), 'the replacement piece reaches the angle');
ref.current.clearTeachingEffects();

root.render(React.createElement(ChessiroCanvas, { ref, interactive: false }));
await sleep(120);

console.log('\n-- annotate (text over a square) --');
const annotTexts = () =>
  [...container.querySelectorAll('[data-cine-overlay] span')].map((s) => s.textContent);
const note = ref.current.annotate('e4', '+1.4');
await sleep(40);
assert(annotTexts().includes('+1.4'), 'annotation text mounted');
note.setText('+2.1');
await sleep(30);
assert(annotTexts().includes('+2.1'), 'setText updated in place');
assert(annotTexts().filter((t) => t === '+2.1').length === 1, 'setText did not duplicate the node');
await withTimeout(note.clear(40), 2000, 'annotation clear() resolved');
await sleep(80);
assert(countNodes() === baseline, 'annotation unmounted after clear');
// clear() twice must be safe and must not reject.
await withTimeout(note.clear(), 500, 'second clear() is a no-op');

// Auto-dismiss after durationMs.
ref.current.annotate('a1', 'fork!', { durationMs: 60, corner: 'topRight' });
await sleep(40);
assert(annotTexts().includes('fork!'), 'timed annotation mounted');
await sleep(300);
assert(countNodes() === baseline, 'timed annotation auto-removed');

// Annotations persist until explicitly cleared, and clearCinematics gets them.
ref.current.annotate('h8', 'A');
ref.current.annotate('h7', 'B');
await sleep(60);
assert(annotTexts().filter((t) => t === 'A' || t === 'B').length === 2, 'two annotations coexist');
await sleep(400);
assert(annotTexts().includes('A'), 'annotation persisted without a duration');
ref.current.clearCinematics();
await sleep(60);
assert(countNodes() === baseline, 'clearCinematics removed annotations');

console.log('\n-- new effects under reduced motion --');
reducedMotion = true;
const rmCount = countNodes();
await withTimeout(ref.current.promotionBeam('a7', { piece: 'wQ' }), 200, 'reduced-motion promotionBeam resolved immediately');
await withTimeout(ref.current.implode('b8'), 200, 'reduced-motion implode resolved immediately');
await withTimeout(ref.current.castleSwap('e1', 'g1', 'h1', 'f1'), 200, 'reduced-motion castleSwap resolved immediately');
await withTimeout(ref.current.drawLaser('c1', 'h6'), 200, 'reduced-motion drawLaser resolved immediately');
const rmSpot = ref.current.spotlight(['e4']);
await withTimeout(rmSpot.clear(), 200, 'reduced-motion spotlight handle is a no-op');
await withTimeout(
  ref.current.checkmate('e1', { banner: null }),
  200,
  'reduced-motion checkmate skips the topple and resolves immediately',
);
assert(countNodes() === rmCount, 'reduced-motion new effects mounted nothing');

// A toppled king is information, not decoration: the angle is still applied
// under reduced motion, only the travel is skipped.
logAt = animationLog.length;
await withTimeout(ref.current.tiltPiece('e1', { angle: 50 }), 500, 'reduced-motion tiltPiece resolved immediately');
const rmTilt = tiltRecordSince(logAt);
assert(rmTilt?.options.duration === 0, 'reduced-motion tilt skips the travel');
assert(lastFrame(rmTilt).includes('rotateZ(50deg)'), 'reduced-motion tilt still applies the angle');
await withTimeout(ref.current.resetPieceTilt(), 500, 'reduced-motion reset resolved');

// Text is information, not motion: an annotation must still appear under
// reduced motion — only its entry animation is skipped.
const rmNote = ref.current.annotate('e4', 'still shown');
await sleep(40);
assert(
  [...container.querySelectorAll('[data-cine-overlay] span')].some(
    (s) => s.textContent === 'still shown',
  ),
  'reduced-motion annotation still renders its text',
);
await withTimeout(rmNote.clear(0), 500, 'reduced-motion annotation cleared');
await sleep(60);
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
