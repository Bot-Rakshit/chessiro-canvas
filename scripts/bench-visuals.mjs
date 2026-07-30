// Focused benchmark for the "config props as inline literals" path.
//
// scripts/benchmark.mjs renders a bare display board — no squareVisuals, no
// dests, interactive: false — so it never exercises the code path that most
// real apps hit:
//
//     <ChessiroCanvas squareVisuals={{ ... }} dests={dests} />
//
// That object literal has a new identity every render. This measures the React
// Profiler cost of position updates under that usage, which is where the
// per-square memoization either works or doesn't.
//
// Usage: node scripts/bench-visuals.mjs [rounds] [updatesPerRound]

import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost/',
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const define = (name, value) => {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
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
define('MutationObserver', dom.window.MutationObserver);
define('Image', dom.window.Image);
dom.window.matchMedia = () => ({
  matches: false, addEventListener() {}, removeEventListener() {},
  addListener() {}, removeListener() {}, onchange: null, dispatchEvent() { return false; },
});
define('matchMedia', dom.window.matchMedia);

const React = (await import('react')).default;
const { Profiler } = React;
const { createRoot } = await import('react-dom/client');
const { flushSync } = await import('react-dom');
const { ChessiroCanvas } = await import('../dist/index.js');

const ROUNDS = Number(process.argv[2] ?? 12);
const UPDATES = Number(process.argv[3] ?? 200);

// A short real sequence so pieces actually move between renders.
const POSITIONS = [
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR',
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR',
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R',
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R',
  'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R',
];

// Legal-ish destination map, so the legal-move indicator path is live.
const DESTS = new Map([
  ['e2', ['e3', 'e4']],
  ['g1', ['f3', 'h3']],
  ['f1', ['e2', 'd3', 'c4', 'b5']],
  ['d2', ['d3', 'd4']],
]);

const container = document.getElementById('root');
const root = createRoot(container);

let commits = 0;
let totalActual = 0;
const onRender = (_id, _phase, actualDuration) => {
  commits += 1;
  totalActual += actualDuration;
};

function render(position) {
  root.render(
    React.createElement(
      Profiler,
      { id: 'board', onRender },
      React.createElement(ChessiroCanvas, {
        position,
        dests: DESTS,
        lastMove: { from: 'e2', to: 'e4' },
        turnColor: 'w',
        movableColor: 'w',
        // The point of this benchmark: fresh object identities every render,
        // exactly as an app written normally would produce.
        squareVisuals: {
          legalMoveStyle: 'ring',
          legalDot: 'rgba(30, 144, 255, 0.55)',
          legalCaptureRing: 'rgba(30, 144, 255, 0.8)',
          selectedStyle: 'both',
          premoveDot: 'rgba(155, 89, 182, 0.55)',
        },
        highlightedSquares: { e4: 'rgba(0,255,0,0.25)' },
        interactive: true,
        showAnimations: false,
      }),
    ),
  );
}

// Warm up (JIT + first mount) without recording.
render(POSITIONS[0]);
await new Promise((r) => setTimeout(r, 50));

const roundMeans = [];
for (let round = 0; round < ROUNDS; round++) {
  commits = 0;
  totalActual = 0;
  const t0 = performance.now();
  for (let i = 0; i < UPDATES; i++) {
    const position = POSITIONS[i % POSITIONS.length];
    flushSync(() => render(position));
  }
  const wall = performance.now() - t0;
  roundMeans.push({
    wallPerUpdate: wall / UPDATES,
    profilerPerCommit: commits > 0 ? totalActual / commits : 0,
    commits,
  });
}

// Drop the two slowest rounds (GC noise) before averaging.
const sorted = [...roundMeans].sort((a, b) => a.wallPerUpdate - b.wallPerUpdate);
const kept = sorted.slice(0, Math.max(1, sorted.length - 2));
const mean = (key) => kept.reduce((sum, r) => sum + r[key], 0) / kept.length;
const median = (key) => {
  const values = kept.map((r) => r[key]).sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
};

console.log(JSON.stringify({
  rounds: ROUNDS,
  updatesPerRound: UPDATES,
  keptRounds: kept.length,
  wallPerUpdateMs: { mean: mean('wallPerUpdate'), median: median('wallPerUpdate') },
  profilerPerCommitMs: { mean: mean('profilerPerCommit'), median: median('profilerPerCommit') },
  commitsPerRound: kept[0].commits,
}, null, 1));
