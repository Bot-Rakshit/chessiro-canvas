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

const dom = new JSDOM(
  '<!doctype html><html><body><div id="plain-root"></div><div id="legal-root"></div></body></html>',
  {
  pretendToBeVisual: true,
  url: 'http://localhost/',
  },
);

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
  // d7 is deliberately included as an occupied target so the selected phase
  // exercises both the empty-square legal indicator and capture ring.
  ['d2', ['d3', 'd4', 'd7']],
]);

const createPhase = (rootId) => {
  const container = document.getElementById(rootId);
  const root = createRoot(container);
  const metrics = { commits: 0, totalActual: 0 };
  const roundMeans = [];
  const onRender = (_id, _phase, actualDuration) => {
    metrics.commits += 1;
    metrics.totalActual += actualDuration;
  };
  const render = (position) => {
    root.render(
      React.createElement(
        Profiler,
        { id: rootId, onRender },
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
  };
  return { container, metrics, render, roundMeans };
};

const plainPhase = createPhase('plain-root');
const legalPhase = createPhase('legal-root');
const findBoardElement = (phase) => [...phase.container.querySelectorAll('div')]
  .find((element) => element.style.paddingBottom === '100%');
const waitFor = async (predicate, timeoutMs = 2000) => {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return predicate();
};
plainPhase.render(POSITIONS[0]);
legalPhase.render(POSITIONS[0]);
if (!(await waitFor(() => findBoardElement(plainPhase) && findBoardElement(legalPhase)))) {
  throw new Error('benchmark boards did not mount');
}

const stats = (rounds, key) => {
  const values = rounds.map((round) => round[key]).sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const middle = Math.floor(values.length / 2);
  const median = values.length % 2 === 0
    ? (values[middle - 1] + values[middle]) / 2
    : values[middle];
  const p95 = values[Math.max(0, Math.ceil(values.length * 0.95) - 1)];
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return { mean, median, p95, stdev: Math.sqrt(variance) };
};

const measureRound = (phase) => {
  phase.metrics.commits = 0;
  phase.metrics.totalActual = 0;
  const t0 = performance.now();
  for (let i = 0; i < UPDATES; i++) {
    const position = POSITIONS[i % POSITIONS.length];
    flushSync(() => phase.render(position));
  }
  const wall = performance.now() - t0;
  phase.roundMeans.push({
    wallPerUpdate: wall / UPDATES,
    profilerPerCommit: phase.metrics.commits > 0
      ? phase.metrics.totalActual / phase.metrics.commits
      : 0,
    commits: phase.metrics.commits,
  });
};

const summarizePhase = (phase) => {
  return {
    wallPerUpdateMs: stats(phase.roundMeans, 'wallPerUpdate'),
    profilerPerCommitMs: stats(phase.roundMeans, 'profilerPerCommit'),
    commitsPerRound: phase.roundMeans.map((round) => round.commits),
  };
};

// Select d2 through the public interaction path. Patch geometry only on the
// board element so the setup can hit-test without changing the measured
// render tree (jsdom otherwise reports zero-sized elements).
const boardElement = findBoardElement(legalPhase);
if (!boardElement) throw new Error('benchmark could not find the board element');
Object.defineProperties(boardElement, {
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
boardElement.dispatchEvent(new dom.window.MouseEvent('mousedown', {
  bubbles: true,
  button: 0,
  clientX: 350,
  clientY: 650,
}));
await new Promise((r) => setTimeout(r, 0));
document.dispatchEvent(new dom.window.MouseEvent('mouseup', {
  bubbles: true,
  button: 0,
  clientX: 350,
  clientY: 650,
}));

const indicatorsActive = () => {
  const legalDot = legalPhase.container.querySelector('[data-square="d3"]');
  const captureRing = legalPhase.container.querySelector('[data-square="d7"]');
  return !!legalDot?.style.backgroundImage && !!captureRing?.style.boxShadow;
};
if (!(await waitFor(indicatorsActive))) {
  throw new Error('benchmark failed to activate legal-dot and capture-ring indicators');
}

// Warm both paths equally, then alternate which one runs first each round so
// JIT/GC timing does not systematically favor either phase.
for (let i = 0; i < Math.min(UPDATES, 50); i++) {
  const position = POSITIONS[i % POSITIONS.length];
  if (i % 2 === 0) {
    flushSync(() => plainPhase.render(position));
    flushSync(() => legalPhase.render(position));
  } else {
    flushSync(() => legalPhase.render(position));
    flushSync(() => plainPhase.render(position));
  }
}

for (let round = 0; round < ROUNDS; round++) {
  if (round % 2 === 0) {
    measureRound(plainPhase);
    measureRound(legalPhase);
  } else {
    measureRound(legalPhase);
    measureRound(plainPhase);
  }
}

const plainPositionUpdates = summarizePhase(plainPhase);
const selectedLegalIndicators = summarizePhase(legalPhase);

console.log(JSON.stringify({
  rounds: ROUNDS,
  updatesPerRound: UPDATES,
  phases: {
    plainPositionUpdates,
    selectedLegalIndicators: {
      selectedSquare: 'd2',
      legalDotSquare: 'd3',
      captureRingSquare: 'd7',
      ...selectedLegalIndicators,
    },
  },
}, null, 1));
