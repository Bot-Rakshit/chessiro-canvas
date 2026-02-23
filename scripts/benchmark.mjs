import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import React, { Profiler, act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { Chessboard } from 'react-chessboard';
import { ChessiroCanvas } from '../dist/index.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'benchmarks');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'latest.json');

const BOARD_SIZE_PX = 640;
const ROUNDS = Number(process.env.BENCH_ROUNDS ?? 8);
const WARMUP_ROUNDS = Number(process.env.BENCH_WARMUP_ROUNDS ?? 2);
const UPDATES_PER_ROUND = Number(process.env.BENCH_UPDATES ?? 300);

const POSITIONS = [
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR',
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR',
  'rnbqkbnr/pppp1ppp/8/4p3/3PP3/8/PPP2PPP/RNBQKBNR',
];

function setGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
  });
}

function setupDom() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    pretendToBeVisual: true,
    url: 'http://localhost/',
  });
  const { window } = dom;

  setGlobal('window', window);
  setGlobal('document', window.document);
  setGlobal('navigator', window.navigator);
  setGlobal('Element', window.Element);
  setGlobal('Node', window.Node);
  setGlobal('HTMLElement', window.HTMLElement);
  setGlobal('SVGElement', window.SVGElement);
  setGlobal('DOMRect', window.DOMRect);
  setGlobal('MouseEvent', window.MouseEvent);
  setGlobal('TouchEvent', window.TouchEvent);
  setGlobal('IS_REACT_ACT_ENVIRONMENT', true);

  if (!window.matchMedia) {
    window.matchMedia = () => ({
      matches: false,
      media: '',
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    });
  }

  if (!window.ResizeObserver) {
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    window.ResizeObserver = ResizeObserver;
  }
  setGlobal('ResizeObserver', window.ResizeObserver);

  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
  }
  if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = (id) => clearTimeout(id);
  }
  setGlobal('requestAnimationFrame', window.requestAnimationFrame);
  setGlobal('cancelAnimationFrame', window.cancelAnimationFrame);

  const defaultRect = {
    left: 0,
    top: 0,
    width: BOARD_SIZE_PX,
    height: BOARD_SIZE_PX,
  };

  const getRect = () => {
    const width = defaultRect.width;
    const height = defaultRect.height;
    return {
      x: defaultRect.left,
      y: defaultRect.top,
      left: defaultRect.left,
      top: defaultRect.top,
      right: defaultRect.left + width,
      bottom: defaultRect.top + height,
      width,
      height,
      toJSON() {
        return this;
      },
    };
  };

  Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value() {
      return getRect();
    },
  });

  Object.defineProperty(window.HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      return BOARD_SIZE_PX;
    },
  });

  Object.defineProperty(window.HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      return BOARD_SIZE_PX;
    },
  });

  Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return BOARD_SIZE_PX;
    },
  });

  Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get() {
      return BOARD_SIZE_PX;
    },
  });

  return dom;
}

function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values) {
  if (values.length <= 1) return 0;
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function summarize(values) {
  return {
    mean: mean(values),
    median: percentile(values, 50),
    p95: percentile(values, 95),
    stdev: stddev(values),
  };
}

function gzipSize(bytes) {
  return zlib.gzipSync(bytes).length;
}

function readFileSize(filePath) {
  const file = fs.readFileSync(filePath);
  return {
    bytes: file.length,
    gzipBytes: gzipSize(file),
  };
}

function formatMs(ms) {
  return `${ms.toFixed(2)} ms`;
}

function formatPct(value) {
  return `${value.toFixed(1)}%`;
}

function percentFaster(baseline, candidate) {
  if (baseline === 0) return 0;
  return ((baseline - candidate) / baseline) * 100;
}

async function runBenchmark(name, renderBoard) {
  const rounds = [];

  for (let round = 0; round < WARMUP_ROUNDS + ROUNDS; round += 1) {
    const container = document.createElement('div');
    container.style.width = `${BOARD_SIZE_PX}px`;
    container.style.height = `${BOARD_SIZE_PX}px`;
    document.body.appendChild(container);

    const root = createRoot(container);
    const commits = [];
    const onRender = (_id, phase, actualDuration) => {
      commits.push({ phase, actualDuration });
    };

    const renderWithProfiler = (position) =>
      React.createElement(
        Profiler,
        { id: name, onRender },
        renderBoard(position),
      );

    let positionIndex = 0;
    const mountStart = performance.now();
    act(() => {
      root.render(renderWithProfiler(POSITIONS[positionIndex]));
    });
    const mountWallMs = performance.now() - mountStart;

    const updatesStart = performance.now();
    for (let i = 0; i < UPDATES_PER_ROUND; i += 1) {
      positionIndex = (positionIndex + 1) % POSITIONS.length;
      act(() => {
        root.render(renderWithProfiler(POSITIONS[positionIndex]));
      });
    }
    const updatesWallMs = performance.now() - updatesStart;

    act(() => {
      root.unmount();
    });
    container.remove();

    const mountCommit = commits.find((commit) => commit.phase === 'mount');
    const updateCommits = commits.filter((commit) => commit.phase !== 'mount').map((commit) => commit.actualDuration);

    const metrics = {
      mountWallMs,
      updatesWallMs,
      updateWallPerUpdateMs: updatesWallMs / UPDATES_PER_ROUND,
      mountActualMs: mountCommit?.actualDuration ?? 0,
      updateActualAvgMs: mean(updateCommits),
      updateActualP95Ms: percentile(updateCommits, 95),
      profilerCommitCount: commits.length,
    };

    if (round >= WARMUP_ROUNDS) {
      rounds.push(metrics);
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return {
    rounds,
    summary: {
      mountWallMs: summarize(rounds.map((r) => r.mountWallMs)),
      updatesWallMs: summarize(rounds.map((r) => r.updatesWallMs)),
      updateWallPerUpdateMs: summarize(rounds.map((r) => r.updateWallPerUpdateMs)),
      mountActualMs: summarize(rounds.map((r) => r.mountActualMs)),
      updateActualAvgMs: summarize(rounds.map((r) => r.updateActualAvgMs)),
      updateActualP95Ms: summarize(rounds.map((r) => r.updateActualP95Ms)),
    },
  };
}

function createBundleSummary() {
  const chessiroPath = path.join(ROOT_DIR, 'dist/index.js');
  const reactPath = path.join(ROOT_DIR, 'node_modules/react-chessboard/dist/index.esm.js');
  const chessiroSize = readFileSize(chessiroPath);
  const reactSize = readFileSize(reactPath);

  return {
    chessiroCanvas: chessiroSize,
    reactChessboard: reactSize,
    gzipReductionPct: percentFaster(reactSize.gzipBytes, chessiroSize.gzipBytes),
  };
}

function printSummary(result) {
  const chessiro = result.results.chessiroCanvas.summary;
  const react = result.results.reactChessboard.summary;
  const cmp = result.results.comparison;

  console.log('\nBenchmark Summary\n');
  console.log(`Config: ${result.config.rounds} rounds (+${result.config.warmupRounds} warmup), ${result.config.updatesPerRound} updates/round`);
  console.log('');
  console.log('| Metric | chessiro-canvas | react-chessboard | Delta |');
  console.log('| --- | ---: | ---: | ---: |');
  console.log(`| Mount wall time (mean) | ${formatMs(chessiro.mountWallMs.mean)} | ${formatMs(react.mountWallMs.mean)} | ${formatPct(cmp.mountWallFasterPct)} faster |`);
  console.log(`| Update wall time (mean, ${result.config.updatesPerRound} renders) | ${formatMs(chessiro.updatesWallMs.mean)} | ${formatMs(react.updatesWallMs.mean)} | ${formatPct(cmp.updatesWallFasterPct)} faster |`);
  console.log(`| Update wall per render (mean) | ${formatMs(chessiro.updateWallPerUpdateMs.mean)} | ${formatMs(react.updateWallPerUpdateMs.mean)} | ${formatPct(cmp.updateWallPerRenderFasterPct)} faster |`);
  console.log(`| React Profiler update duration (mean) | ${formatMs(chessiro.updateActualAvgMs.mean)} | ${formatMs(react.updateActualAvgMs.mean)} | ${formatPct(cmp.profilerUpdateFasterPct)} faster |`);
  console.log(`| Bundle ESM (gzip) | ${(result.bundle.chessiroCanvas.gzipBytes / 1024).toFixed(2)} KB | ${(result.bundle.reactChessboard.gzipBytes / 1024).toFixed(2)} KB | ${formatPct(result.bundle.gzipReductionPct)} smaller |`);
  console.log('');
  console.log(`Saved detailed results to ${OUTPUT_FILE}`);
}

setupDom();

const chessiroCanvas = await runBenchmark('chessiro-canvas', (position) =>
  React.createElement(
    'div',
    { style: { width: `${BOARD_SIZE_PX}px`, height: `${BOARD_SIZE_PX}px` } },
    React.createElement(ChessiroCanvas, {
      position,
      orientation: 'white',
      interactive: false,
      showNotation: false,
      showMargin: false,
      allowDragging: false,
      allowDrawingArrows: false,
      showAnimations: false,
    }),
  ),
);

const reactChessboard = await runBenchmark('react-chessboard', (position) =>
  React.createElement(
    'div',
    { style: { width: `${BOARD_SIZE_PX}px`, height: `${BOARD_SIZE_PX}px` } },
    React.createElement(Chessboard, {
      id: 'react-chessboard-bench',
      position,
      boardWidth: BOARD_SIZE_PX,
      boardOrientation: 'white',
      arePiecesDraggable: false,
      areArrowsAllowed: false,
      showBoardNotation: false,
      animationDuration: 0,
    }),
  ),
);

const bundle = createBundleSummary();

const comparison = {
  mountWallFasterPct: percentFaster(
    reactChessboard.summary.mountWallMs.mean,
    chessiroCanvas.summary.mountWallMs.mean,
  ),
  updatesWallFasterPct: percentFaster(
    reactChessboard.summary.updatesWallMs.mean,
    chessiroCanvas.summary.updatesWallMs.mean,
  ),
  updateWallPerRenderFasterPct: percentFaster(
    reactChessboard.summary.updateWallPerUpdateMs.mean,
    chessiroCanvas.summary.updateWallPerUpdateMs.mean,
  ),
  profilerUpdateFasterPct: percentFaster(
    reactChessboard.summary.updateActualAvgMs.mean,
    chessiroCanvas.summary.updateActualAvgMs.mean,
  ),
};

const result = {
  generatedAt: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpuModel: os.cpus()[0]?.model ?? 'unknown',
    cpuCount: os.cpus().length,
    memoryGB: Number((os.totalmem() / (1024 ** 3)).toFixed(2)),
  },
  config: {
    rounds: ROUNDS,
    warmupRounds: WARMUP_ROUNDS,
    updatesPerRound: UPDATES_PER_ROUND,
    boardSizePx: BOARD_SIZE_PX,
    positionsTested: POSITIONS.length,
  },
  bundle,
  results: {
    chessiroCanvas,
    reactChessboard,
    comparison,
  },
};

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

printSummary(result);
