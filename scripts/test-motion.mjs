// Tests for the framework-free core (motion model, move diffing, SVG export)
// and for how the board turns position changes into Web Animations.
//
// Part 1 imports dist/core.js BEFORE any DOM globals exist, proving the core
// runs in plain Node (server-side OG images, workers, React Native).
import {
  EASINGS,
  resolveMoveAnimation,
  planMoveTrack,
  planCaptureTrack,
  planAppearTrack,
  planLandingTrack,
  sampleTrack,
  computeAnimPlan,
  readFen,
  renderBoardSvg,
  squareToPoint,
  pointToSquare,
  MOVE_ANIMATION_PRESETS,
} from '../dist/core.js';

let failures = 0;
function assert(cond, label) {
  if (cond) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${label}`);
  }
}
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

console.log('\n-- easing curves --');
for (const [name, fn] of Object.entries(EASINGS)) {
  assert(near(fn(0), 0, 1e-3) && near(fn(1), 1, 1e-3), `${name} starts at 0 and lands on 1`);
}

console.log('\n-- resolving presets --');
{
  const classic = resolveMoveAnimation(undefined, { baseDurationMs: 200 });
  assert(classic.enabled && classic.durationMs === 200 && classic.arc === 0 && classic.capture === 'fade',
    'default resolves to the classic slide at the base duration');
  assert(classic.easing === EASINGS.easeInOut, 'classic keeps the historical cubic in-out curve');
  const playful = resolveMoveAnimation('playful', { baseDurationMs: 200 });
  assert(playful.knightArc > 0 && playful.landing === 'squash' && playful.flip === 'rotate',
    'playful preset hops knights, squashes landings and turns on flip');
  const tuned = resolveMoveAnimation({ preset: 'arcade', capture: 'fade', durationMs: 500 });
  assert(tuned.capture === 'fade' && tuned.durationMs === 500 && tuned.landing === 'bounce',
    'overrides win over the preset, untouched knobs keep preset values');
  const reduced = resolveMoveAnimation({ preset: 'arcade', arc: 1 }, { reducedMotion: true });
  assert(reduced.arc === 0 && reduced.landing === 'none' && reduced.flip === 'none',
    'reduced motion degrades any preset to a flat minimal slide');
  const optOut = resolveMoveAnimation({ preset: 'arcade', respectReducedMotion: false }, { reducedMotion: true });
  assert(optOut.landing === 'bounce', 'respectReducedMotion: false keeps the flourish');
  assert(!resolveMoveAnimation('none').enabled, "'none' disables motion");
  assert(!resolveMoveAnimation('snappy', { enabled: false }).enabled, 'showAnimations=false disables motion');
  assert(Object.keys(MOVE_ANIMATION_PRESETS).length === 7, 'seven named presets are exported');
}

console.log('\n-- move tracks --');
{
  const m = resolveMoveAnimation('playful', { baseDurationMs: 200 });
  const t = planMoveTrack([6, 7], [5, 5], m); // Ng1-f3 from white's side
  const first = t.frames[0];
  const last = t.frames[t.frames.length - 1];
  assert(first.x === 6 && first.y === 7 && first.offset === 0, 'track starts on the origin square');
  assert(near(last.x, 5) && near(last.y, 5) && last.offset === 1, 'track ends on the destination square');
  assert(t.frames.every((f, i) => i === 0 || f.offset >= t.frames[i - 1].offset), 'keyframe offsets never go backwards');
  assert(t.frames.some((f) => f.y < 4.8), 'knight hops above its path (arc in time)');
  assert(t.frames.some((f) => f.scaleY < 1), 'playful landing squashes the piece');
  const flat = planMoveTrack([4, 6], [4, 4], resolveMoveAnimation('classic'));
  assert(flat.frames.every((f) => f.x === 4 && f.scaleX === 1), 'classic slide stays flat and unscaled');
  const mid = sampleTrack(flat, flat.durationMs / 2);
  assert(mid.y < 6 && mid.y > 4, 'sampleTrack interpolates an in-flight pose');
  const long = planMoveTrack([0, 7], [7, 0], resolveMoveAnimation('elegant', { baseDurationMs: 200 }));
  const short = planMoveTrack([0, 7], [0, 6], resolveMoveAnimation('elegant', { baseDurationMs: 200 }));
  assert(long.durationMs > short.durationMs, 'distance scaling makes long moves take longer');
  const knockout = planCaptureTrack([3, 3], resolveMoveAnimation('playful'), { arriveMs: 200, push: [1, -1] });
  assert(knockout.delayMs > 0 && knockout.frames.at(-1).opacity === 0 && knockout.frames.at(-1).rotate !== 0,
    'knockout waits for the attacker, then spins the victim away');
  const pop = planAppearTrack([0, 0], resolveMoveAnimation('playful'), 40);
  assert(pop.delayMs === 40 && pop.frames[0].opacity === 0, 'appear tracks start hidden and respect their delay');
  assert(planLandingTrack([0, 0], resolveMoveAnimation('classic')) === null, 'no landing track without a landing style');
}

console.log('\n-- move diffing --');
{
  const castle = computeAnimPlan(
    readFen('r3k2r/8/8/8/8/8/8/R3K2R'),
    readFen('r3k2r/8/8/8/8/8/8/R4RK1'),
  );
  const moves = castle.moves.map((m) => `${m.from}${m.to}`).sort();
  assert(moves.join() === 'e1g1,h1f1' && castle.captures.length === 0, 'castling moves king and rook together');
  const cap = computeAnimPlan(readFen('8/8/8/3p4/4P3/8/8/8'), readFen('8/8/8/3P4/8/8/8/8'));
  assert(cap.moves.length === 1 && cap.captures.length === 1 && cap.captures[0].square === 'd5', 'capture diffs into a move and a victim');
  const ep = computeAnimPlan(readFen('8/8/8/3pP3/8/8/8/8'), readFen('8/8/3P4/8/8/8/8/8'));
  assert(ep.moves[0]?.from === 'e5' && ep.moves[0]?.to === 'd6' && ep.captures[0]?.square === 'd5', 'en passant victim is found off the arrival square');
  const promo = computeAnimPlan(readFen('8/4P3/8/8/8/8/8/8'), readFen('4Q3/8/8/8/8/8/8/8'));
  assert(promo.appears[0]?.square === 'e8' && promo.captures[0]?.square === 'e7', 'promotion = pawn leaves, queen appears');
  const setup = computeAnimPlan(readFen('8/8/8/8/8/8/8/8'), readFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'));
  assert(setup.appears.length === 32, 'new game from an empty board is 32 appearances');
}

console.log('\n-- geometry --');
{
  assert(squareToPoint('a1').join() === '0,7' && squareToPoint('a1', 'black').join() === '7,0', 'squareToPoint respects orientation');
  let roundTrip = true;
  for (const o of ['white', 'black']) {
    for (const sq of ['a1', 'h8', 'e4', 'c6']) {
      const [x, y] = squareToPoint(sq, o);
      if (pointToSquare(x + 0.5, y + 0.5, o) !== sq) roundTrip = false;
    }
  }
  assert(roundTrip, 'pointToSquare inverts squareToPoint');
  assert(pointToSquare(8.2, 1) === null, 'off-board points map to null');
}

console.log('\n-- SVG export (Node) --');
const svgStart = renderBoardSvg();
const svgMarked = renderBoardSvg({
  position: 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR',
  orientation: 'black',
  lastMove: { from: 'h5', to: 'f7' },
  check: 'e8',
  arrows: [{ startSquare: 'g1', endSquare: 'f3', color: '#15781B' }, { startSquare: 'c4', endSquare: 'f7', color: '#882020' }],
  highlightedSquares: { e4: 'rgba(0,0,255,.4)' },
  size: 800,
  idPrefix: 'share',
});
assert((svgStart.match(/<use /g) ?? []).length === 32, 'start position stamps 32 pieces');
assert((svgStart.match(/<symbol /g) ?? []).length === 12, 'each piece type is defined once');
assert(svgMarked.includes('width="800"') && svgMarked.includes('url(#share-check)'), 'size, id prefix and check glow are applied');
assert((svgMarked.match(/<g opacity/g) ?? []).length === 2, 'arrows are drawn');
{
  const fileLabels = [...svgMarked.matchAll(/>([a-h])<\/text>/g)].map((m) => m[1]).join('');
  assert(fileLabels === 'hgfedcba', 'black orientation mirrors the file labels');
}
const urlSvg = renderBoardSvg({ pieceUrls: { wk: '/pieces/wk.svg' } });
assert(urlSvg.includes('<image href="/pieces/wk.svg"') && (urlSvg.match(/<symbol /g) ?? []).length === 11, 'pieceUrls reference external art');

// ── Part 2: the board in jsdom ────────────────────────────────────────
const { JSDOM } = await import('jsdom');
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost/',
});
{
  const doc = new dom.window.DOMParser().parseFromString(svgMarked, 'image/svg+xml');
  assert(!doc.querySelector('parsererror') && doc.documentElement.nodeName === 'svg', 'exported SVG is well-formed XML');
}
dom.window.matchMedia = () => ({
  matches: false, media: '', onchange: null,
  addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; },
});
class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
const animationLog = [];
dom.window.HTMLElement.prototype.animate = function animate(keyframes, options) {
  const record = { target: this, keyframes, options, cancelled: false };
  animationLog.push(record);
  let resolveFinished;
  let rejectFinished;
  const finished = new Promise((res, rej) => { resolveFinished = res; rejectFinished = rej; });
  finished.catch(() => {});
  const tid = setTimeout(() => resolveFinished(), (options?.duration ?? 0) + (options?.delay ?? 0));
  return {
    finished,
    onfinish: null,
    oncancel: null,
    cancel() { record.cancelled = true; clearTimeout(tid); rejectFinished(new Error('AbortError')); },
  };
};
const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
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
define('Image', dom.window.Image);

const React = (await import('react')).default;
const { createRoot } = await import('react-dom/client');
const { flushSync } = await import('react-dom');
const { ChessiroCanvas } = await import('../dist/index.js');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const container = document.getElementById('root');
const root = createRoot(container);
const ref = React.createRef();
const EMPTY = '8/8/8/8/8/8/8/8';
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
const render = (props) => flushSync(() => root.render(React.createElement(ChessiroCanvas, { ref, interactive: false, ...props })));
const since = (n) => animationLog.slice(n);

console.log('\n-- board: presets drive Web Animations --');
render({ position: EMPTY, moveAnimation: 'playful' });
let mark = animationLog.length;
render({ position: START, moveAnimation: 'playful' });
{
  const anims = since(mark);
  const delays = anims.map((a) => a.options.delay);
  assert(anims.length === 32, 'new game pops in all 32 pieces');
  assert(delays.every((d, i) => i === 0 || d >= delays[i - 1]) && delays.at(-1) > 0 && delays.at(-1) <= 450,
    'pieces cascade in rank order, capped under half a second');
  assert(anims[0].keyframes[0].opacity === 0, 'appearing pieces start transparent');
  assert(anims.every((a) => a.options.easing === 'linear' && a.options.fill === 'backwards'),
    'easing is baked into keyframes; delayed pieces hold their first pose');
}
await sleep(700);

mark = animationLog.length;
render({ position: 'rnbqkbnr/pppp1ppp/8/4p3/3P4/8/PPP1PPPP/RNBQKBNR', moveAnimation: { preset: 'playful', stagger: 0 } });
await sleep(0);
mark = animationLog.length;
render({ position: 'rnbqkbnr/pppp1ppp/8/4P3/8/8/PPP1PPPP/RNBQKBNR', moveAnimation: { preset: 'playful', stagger: 0 } });
{
  const anims = since(mark);
  const victim = anims.find((a) => a.keyframes.some((k) => /rotate\(/.test(k.transform)));
  assert(anims.length === 2 && !!victim, 'capture plays the mover and a knockout for the victim');
  assert(victim && victim.options.delay > 0, 'the victim waits for the attacker to arrive');
}
await sleep(900);
assert(container.querySelectorAll('img[alt="bP"]').length === 7, 'captured piece is removed once its exit ends');

console.log('\n-- board: flip turntable --');
mark = animationLog.length;
render({ position: 'rnbqkbnr/pppp1ppp/8/4P3/8/8/PPP1PPPP/RNBQKBNR', orientation: 'black', moveAnimation: 'playful' });
{
  const anims = since(mark);
  const spin = anims.find((a) => a.keyframes[0].transform === 'rotate(180deg)');
  const counter = anims.filter((a) => /rotate\(-180deg\)/.test(a.keyframes[0].transform));
  assert(!!spin, 'the piece layer turns from 180° back to 0°');
  assert(counter.length === 31, 'every piece counter-rotates to stay upright');
}
await sleep(600);

console.log('\n-- board: switches --');
mark = animationLog.length;
render({ position: START, orientation: 'black', showAnimations: false, moveAnimation: 'arcade' });
assert(since(mark).length === 0, 'showAnimations=false plays nothing');
mark = animationLog.length;
render({ position: EMPTY, orientation: 'black', moveAnimation: 'none' });
assert(since(mark).length === 0, "moveAnimation='none' plays nothing");

console.log('\n-- board: toSVG snapshot --');
render({ position: START, orientation: 'black', lastMove: { from: 'e2', to: 'e4' }, check: 'e1' });
{
  const svg = ref.current.toSVG({ size: 300 });
  const files = [...svg.matchAll(/>([a-h])<\/text>/g)].map((m) => m[1]).join('');
  assert(svg.startsWith('<svg') && svg.includes('width="300"'), 'ref.toSVG returns an SVG with option overrides');
  assert(files === 'hgfedcba' && svg.includes('-check)'), 'snapshot carries orientation and check from props');
  assert((svg.match(/<use /g) ?? []).length === 32, 'snapshot carries the live position');
}

root.unmount();
if (failures > 0) {
  console.error(`\n${failures} motion test(s) failed`);
  process.exit(1);
}
console.log('\nmotion tests passed');
process.exit(0);
