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
import { ChessiroCanvas, readFen, writeFen } from '../dist/index.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'benchmarks');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'latest.json');

const BOARD_SIZE_PX = 640;
const ROUNDS = Number(process.env.BENCH_ROUNDS ?? 8);
const WARMUP_ROUNDS = Number(process.env.BENCH_WARMUP_ROUNDS ?? 2);
const UPDATES_PER_ROUND = Number(process.env.BENCH_UPDATES ?? 300);
const SCENARIO_FILTER = (process.env.BENCH_SCENARIOS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const DRAG_MOVES_PER_ROUND = Number(process.env.BENCH_DRAG_MOVES ?? 500);
const DRAG_FROM = 'e2';
const DRAG_TO = 'e4';
const DRAG_START_POSITION = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

const SCENARIOS = [
  {
    id: 'italian-castling',
    name: 'Italian Development + Castling',
    positions: [
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR',
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR',
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R',
      'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R',
      'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R',
      'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R',
      'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R',
      'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R',
      'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQK2R',
      'r1bqk2r/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQK2R',
      'r1bqk2r/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1',
      'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1',
      'r1bq1rk1/ppp2ppp/2np1n2/2b1p1B1/2B1P3/2PP1N2/PP3PPP/RN1Q1RK1',
      'r2q1rk1/ppp2ppp/2npbn2/2b1p1B1/2B1P3/2PP1N2/PP3PPP/RN1Q1RK1',
      'r2q1rk1/ppp2ppp/2npbn2/2b1p1B1/2B1P3/2PP1N2/PP1N1PPP/R2Q1RK1',
      'r2q1rk1/1pp2ppp/p1npbn2/2b1p1B1/2B1P3/2PP1N2/PP1N1PPP/R2Q1RK1',
    ],
  },
  {
    id: 'sicilian-captures',
    name: 'Sicilian Structure + Captures',
    positions: [
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR',
      'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR',
      'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R',
      'rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R',
      'rnbqkbnr/pp2pppp/3p4/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R',
      'rnbqkbnr/pp2pppp/3p4/8/3pP3/5N2/PPP2PPP/RNBQKB1R',
      'rnbqkbnr/pp2pppp/3p4/8/3NP3/8/PPP2PPP/RNBQKB1R',
      'rnbqkb1r/pp2pppp/3p1n2/8/3NP3/8/PPP2PPP/RNBQKB1R',
      'rnbqkb1r/pp2pppp/3p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R',
      'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R',
      'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N1B3/PPP2PPP/R2QKB1R',
      'rnbqkb1r/1p3ppp/p2p1n2/4p3/3NP3/2N1B3/PPP2PPP/R2QKB1R',
      'rnbqkb1r/1p3ppp/p2p1n2/4p3/4P3/1NN1B3/PPP2PPP/R2QKB1R',
      'rn1qkb1r/1p3ppp/p2pbn2/4p3/4P3/1NN1B3/PPP2PPP/R2QKB1R',
      'rn1qkb1r/1p3ppp/p2pbn2/4p3/4P3/1NN1BP2/PPP3PP/R2QKB1R',
      'r2qkb1r/1p1n1ppp/p2pbn2/4p3/4P3/1NN1BP2/PPP3PP/R2QKB1R',
    ],
  },
  {
    id: 'french-advance',
    name: 'French Advance Pawn Tension',
    positions: [
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR',
      'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR',
      'rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR',
      'rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPP2PPP/RNBQKBNR',
      'rnbqkbnr/ppp2ppp/4p3/3pP3/3P4/8/PPP2PPP/RNBQKBNR',
      'rnbqkbnr/pp3ppp/4p3/2ppP3/3P4/8/PPP2PPP/RNBQKBNR',
      'rnbqkbnr/pp3ppp/4p3/2ppP3/3P4/2P5/PP3PPP/RNBQKBNR',
      'r1bqkbnr/pp3ppp/2n1p3/2ppP3/3P4/2P5/PP3PPP/RNBQKBNR',
      'r1bqkbnr/pp3ppp/2n1p3/2ppP3/3P4/2P2N2/PP3PPP/RNBQKB1R',
      'r2qkbnr/pp1b1ppp/2n1p3/2ppP3/3P4/2P2N2/PP3PPP/RNBQKB1R',
      'r2qkbnr/pp1b1ppp/2n1p3/2ppP3/3P4/2PB1N2/PP3PPP/RNBQK2R',
      'r3kbnr/pp1b1ppp/1qn1p3/2ppP3/3P4/2PB1N2/PP3PPP/RNBQK2R',
      'r3kbnr/pp1b1ppp/1qn1p3/2ppP3/3P4/2PB1N2/PP3PPP/RNBQ1RK1',
      'r3kbnr/pp1b1ppp/1qn1p3/3pP3/3p4/2PB1N2/PP3PPP/RNBQ1RK1',
      'r3kbnr/pp1b1ppp/1qn1p3/3pP3/3P4/3B1N2/PP3PPP/RNBQ1RK1',
      'r3kbnr/pp1b1ppp/1q2p3/3pP3/3n4/3B1N2/PP3PPP/RNBQ1RK1',
    ],
  },
  {
    id: 'king-pawn-endgame',
    name: 'King + Pawn Endgame Maneuvers',
    positions: [
      '8/3k4/8/3P4/8/4K3/8/8',
      '8/3k4/8/3P4/3K4/8/8/8',
      '8/8/3k4/3P4/3K4/8/8/8',
      '8/8/3k4/3P4/4K3/8/8/8',
      '8/3k4/8/3P4/4K3/8/8/8',
      '8/3k4/8/3PK3/8/8/8/8',
      '8/4k3/8/3PK3/8/8/8/8',
      '8/4k3/3P4/4K3/8/8/8/8',
      '8/3k4/3P4/4K3/8/8/8/8',
      '8/3k4/3P4/3K4/8/8/8/8',
    ],
  },
  {
    id: 'promotion-line',
    name: 'Promotion Conversion Sequence',
    positions: [
      'k7/3P4/8/8/8/8/4K3/8',
      'k2Q4/8/8/8/8/8/4K3/8',
      '3Q4/1k6/8/8/8/8/4K3/8',
      '3Q4/1k6/8/8/8/4K3/8/8',
      '3Q4/8/2k5/8/8/4K3/8/8',
      '8/8/2k5/8/8/3QK3/8/8',
      '8/8/8/2k5/8/3QK3/8/8',
      '8/8/8/2k5/4K3/3Q4/8/8',
    ],
  },
];

function applyMoveOnPlacement(position, from, to) {
  const pieces = readFen(position);
  const piece = pieces.get(from);
  if (!piece) return position;
  pieces.delete(from);
  pieces.set(to, piece);
  return writeFen(pieces);
}

function squareCenter(square) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  return {
    x: ((file + 0.5) / 8) * BOARD_SIZE_PX,
    y: ((8 - rank + 0.5) / 8) * BOARD_SIZE_PX,
  };
}

function findChessiroDragTarget(container) {
  const board = Array.from(container.querySelectorAll('div'))
    .find((el) => el.style.paddingBottom === '100%');
  return board ?? container;
}

function findReactChessboardDragTarget(container) {
  return container.querySelector(`[data-square="${DRAG_FROM}"] [data-piece]`)
    ?? container.querySelector(`[data-square="${DRAG_FROM}"]`)
    ?? container;
}

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
      addListener() { },
      removeListener() { },
      addEventListener() { },
      removeEventListener() { },
      dispatchEvent() {
        return false;
      },
    });
  }

  if (!window.ResizeObserver) {
    class ResizeObserver {
      observe() { }
      unobserve() { }
      disconnect() { }
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

  class PointerEvent extends window.MouseEvent { }
  setGlobal('PointerEvent', PointerEvent);

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

function summarizeRounds(rounds) {
  return {
    mountWallMs: summarize(rounds.map((r) => r.mountWallMs)),
    updatesWallMs: summarize(rounds.map((r) => r.updatesWallMs)),
    updateWallPerUpdateMs: summarize(rounds.map((r) => r.updateWallPerUpdateMs)),
    mountActualMs: summarize(rounds.map((r) => r.mountActualMs)),
    updateActualAvgMs: summarize(rounds.map((r) => r.updateActualAvgMs)),
    updateActualP95Ms: summarize(rounds.map((r) => r.updateActualP95Ms)),
    profilerCommitCount: summarize(rounds.map((r) => r.profilerCommitCount)),
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

function pickScenarios() {
  if (SCENARIO_FILTER.length === 0) return SCENARIOS;

  const byId = new Map(SCENARIOS.map((scenario) => [scenario.id, scenario]));
  const missing = [];
  const picked = [];

  for (const id of SCENARIO_FILTER) {
    const scenario = byId.get(id);
    if (!scenario) {
      missing.push(id);
      continue;
    }
    picked.push(scenario);
  }

  if (missing.length > 0) {
    throw new Error(
      `Unknown BENCH_SCENARIOS id(s): ${missing.join(', ')}. Available: ${SCENARIOS.map((s) => s.id).join(', ')}`,
    );
  }

  return picked;
}

async function runBenchmark(name, renderBoard, positions) {
  if (positions.length < 2) {
    throw new Error(`Scenario for ${name} must contain at least 2 positions.`);
  }

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

    let positionIndex = round % positions.length;
    const mountStart = performance.now();
    act(() => {
      root.render(renderWithProfiler(positions[positionIndex]));
    });
    const mountWallMs = performance.now() - mountStart;

    const updatesStart = performance.now();
    for (let i = 0; i < UPDATES_PER_ROUND; i += 1) {
      positionIndex = (positionIndex + 1) % positions.length;
      act(() => {
        root.render(renderWithProfiler(positions[positionIndex]));
      });
    }
    const updatesWallMs = performance.now() - updatesStart;

    act(() => {
      root.unmount();
    });
    container.remove();

    const mountCommit = commits.find((commit) => commit.phase === 'mount');
    const updateCommits = commits
      .filter((commit) => commit.phase !== 'mount')
      .map((commit) => commit.actualDuration);

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
    summary: summarizeRounds(rounds),
  };
}

async function runSuite(name, renderBoard, scenarios) {
  const scenarioResults = [];

  for (const scenario of scenarios) {
    const benchmark = await runBenchmark(`${name}:${scenario.id}`, renderBoard, scenario.positions);
    scenarioResults.push({
      id: scenario.id,
      name: scenario.name,
      positionsTested: scenario.positions.length,
      rounds: benchmark.rounds,
      summary: benchmark.summary,
    });
  }

  const allRounds = scenarioResults.flatMap((scenario) => scenario.rounds);

  return {
    rounds: allRounds,
    summary: summarizeRounds(allRounds),
    scenarios: scenarioResults,
  };
}

async function runDragStressTest(name, renderBoard) {
  const rounds = [];
  const fromCenter = squareCenter(DRAG_FROM);
  const toCenter = squareCenter(DRAG_TO);

  for (let round = 0; round < WARMUP_ROUNDS + ROUNDS; round += 1) {
    const container = document.createElement('div');
    container.style.width = `${BOARD_SIZE_PX}px`;
    container.style.height = `${BOARD_SIZE_PX}px`;
    document.body.appendChild(container);

    const root = createRoot(container);
    let commitCount = 0;
    let acceptedDropCount = 0;
    const onRender = () => { commitCount++; };
    const onAcceptedDrop = (from, to) => {
      if (from === DRAG_FROM && to === DRAG_TO) acceptedDropCount += 1;
    };

    const renderWithProfiler = () =>
      React.createElement(
        Profiler,
        { id: `drag-${name}`, onRender },
        renderBoard(DRAG_START_POSITION, onAcceptedDrop),
      );

    act(() => { root.render(renderWithProfiler()); });
    await new Promise(resolve => setTimeout(resolve, 0)); // flush

    commitCount = 0; // reset after mount

    const target = name === 'chessiro-canvas'
      ? findChessiroDragTarget(container)
      : findReactChessboardDragTarget(container);

    act(() => {
      target.dispatchEvent(new window.MouseEvent('mousedown', {
        bubbles: true,
        clientX: fromCenter.x,
        clientY: fromCenter.y,
      }));
      target.dispatchEvent(new window.PointerEvent('pointerdown', {
        bubbles: true,
        clientX: fromCenter.x,
        clientY: fromCenter.y,
      }));
    });

    const dragStart = performance.now();
    for (let i = 1; i <= DRAG_MOVES_PER_ROUND; i += 1) {
      const t = i / DRAG_MOVES_PER_ROUND;
      const x = fromCenter.x + (toCenter.x - fromCenter.x) * t;
      const y = fromCenter.y + (toCenter.y - fromCenter.y) * t;
      act(() => {
        document.dispatchEvent(new window.MouseEvent('mousemove', {
          bubbles: true,
          clientX: x,
          clientY: y,
        }));
        document.dispatchEvent(new window.PointerEvent('pointermove', {
          bubbles: true,
          clientX: x,
          clientY: y,
        }));
      });
    }
    const dragTimeMs = performance.now() - dragStart;

    act(() => {
      document.dispatchEvent(new window.MouseEvent('mouseup', {
        bubbles: true,
        clientX: toCenter.x,
        clientY: toCenter.y,
      }));
      document.dispatchEvent(new window.PointerEvent('pointerup', {
        bubbles: true,
        clientX: toCenter.x,
        clientY: toCenter.y,
      }));
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    if (round >= WARMUP_ROUNDS) {
      rounds.push({
        timeMs: dragTimeMs,
        commits: commitCount,
        acceptedDropCount,
      });
    }

    act(() => { root.unmount(); });
    container.remove();
  }

  const times = rounds.map((r) => r.timeMs);
  const commits = rounds.map((r) => r.commits);
  const drops = rounds.map((r) => r.acceptedDropCount);
  const successfulRoundsPct = rounds.length > 0
    ? (rounds.filter((r) => r.acceptedDropCount > 0).length / rounds.length) * 100
    : 0;

  return {
    timeMs: summarize(times),
    reactCommits: summarize(commits),
    acceptedDrops: summarize(drops),
    successfulRoundsPct,
    movesPerRound: DRAG_MOVES_PER_ROUND,
    fromSquare: DRAG_FROM,
    toSquare: DRAG_TO,
  };
}

function compareSummaries(baseline, candidate) {
  return {
    mountWallFasterPct: percentFaster(
      baseline.mountWallMs.mean,
      candidate.mountWallMs.mean,
    ),
    updatesWallFasterPct: percentFaster(
      baseline.updatesWallMs.mean,
      candidate.updatesWallMs.mean,
    ),
    updateWallPerRenderFasterPct: percentFaster(
      baseline.updateWallPerUpdateMs.mean,
      candidate.updateWallPerUpdateMs.mean,
    ),
    profilerUpdateFasterPct: percentFaster(
      baseline.updateActualAvgMs.mean,
      candidate.updateActualAvgMs.mean,
    ),
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

function buildScenarioComparisons(chessiroScenarios, reactScenarios) {
  const reactById = new Map(reactScenarios.map((scenario) => [scenario.id, scenario]));

  return chessiroScenarios.map((scenario) => {
    const reactScenario = reactById.get(scenario.id);
    if (!reactScenario) {
      throw new Error(`Missing scenario result for ${scenario.id} in react-chessboard benchmark.`);
    }

    const cmp = compareSummaries(reactScenario.summary, scenario.summary);

    return {
      id: scenario.id,
      name: scenario.name,
      positionsTested: scenario.positionsTested,
      ...cmp,
      chessiroCanvas: {
        updateWallPerUpdateMsMean: scenario.summary.updateWallPerUpdateMs.mean,
        updateActualAvgMsMean: scenario.summary.updateActualAvgMs.mean,
      },
      reactChessboard: {
        updateWallPerUpdateMsMean: reactScenario.summary.updateWallPerUpdateMs.mean,
        updateActualAvgMsMean: reactScenario.summary.updateActualAvgMs.mean,
      },
    };
  });
}

function printSummary(result) {
  const chessiro = result.results.chessiroCanvas.summary;
  const react = result.results.reactChessboard.summary;
  const cmp = result.results.comparison.overall;

  console.log('\nBenchmark Summary\n');
  console.log(
    `Config: ${result.config.rounds} rounds (+${result.config.warmupRounds} warmup), ${result.config.updatesPerRound} updates/round`,
  );
  console.log(
    `Scenarios: ${result.config.scenarioCount} (${result.config.scenarios.map((scenario) => scenario.id).join(', ')})`,
  );
  console.log('');
  console.log('| Metric | chessiro-canvas | react-chessboard | Delta |');
  console.log('| --- | ---: | ---: | ---: |');
  console.log(`| Mount wall time (mean) | ${formatMs(chessiro.mountWallMs.mean)} | ${formatMs(react.mountWallMs.mean)} | ${formatPct(cmp.mountWallFasterPct)} faster |`);
  console.log(`| Update wall time (mean, ${result.config.updatesPerRound} renders) | ${formatMs(chessiro.updatesWallMs.mean)} | ${formatMs(react.updatesWallMs.mean)} | ${formatPct(cmp.updatesWallFasterPct)} faster |`);
  console.log(`| Update wall per render (mean) | ${formatMs(chessiro.updateWallPerUpdateMs.mean)} | ${formatMs(react.updateWallPerUpdateMs.mean)} | ${formatPct(cmp.updateWallPerRenderFasterPct)} faster |`);
  console.log(`| React Profiler update duration (mean) | ${formatMs(chessiro.updateActualAvgMs.mean)} | ${formatMs(react.updateActualAvgMs.mean)} | ${formatPct(cmp.profilerUpdateFasterPct)} faster |`);
  console.log(`| Bundle ESM (gzip) | ${(result.bundle.chessiroCanvas.gzipBytes / 1024).toFixed(2)} KB | ${(result.bundle.reactChessboard.gzipBytes / 1024).toFixed(2)} KB | ${formatPct(result.bundle.gzipReductionPct)} smaller |`);

  console.log(`\nDrag Interaction Stress Test (${result.dragTest.chessiro.movesPerRound} synthetic moves: ${result.dragTest.chessiro.fromSquare} -> ${result.dragTest.chessiro.toSquare})\n`);
  console.log('| Metric | chessiro-canvas | react-chessboard |');
  console.log('| --- | ---: | ---: |');
  console.log(`| Wall Time | ${formatMs(result.dragTest.chessiro.timeMs.mean)} | ${formatMs(result.dragTest.reactCb.timeMs.mean)} |`);
  console.log(`| React Renders Tracker | ${result.dragTest.chessiro.reactCommits.mean.toFixed(0)} | ${result.dragTest.reactCb.reactCommits.mean.toFixed(0)} |`);
  console.log(`| Accepted Drops / Round (mean) | ${result.dragTest.chessiro.acceptedDrops.mean.toFixed(2)} | ${result.dragTest.reactCb.acceptedDrops.mean.toFixed(2)} |`);
  console.log(`| Rounds With Successful Drop | ${formatPct(result.dragTest.chessiro.successfulRoundsPct)} | ${formatPct(result.dragTest.reactCb.successfulRoundsPct)} |`);

  console.log('\nScenario Breakdown\n');
  console.log('| Scenario | Positions | chessiro update/render | react update/render | Delta | chessiro profiler update | react profiler update | Delta |');
  console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');

  for (const scenario of result.results.comparison.scenarios) {
    console.log(
      `| ${scenario.name} | ${scenario.positionsTested} | ${formatMs(scenario.chessiroCanvas.updateWallPerUpdateMsMean)} | ${formatMs(scenario.reactChessboard.updateWallPerUpdateMsMean)} | ${formatPct(scenario.updateWallPerRenderFasterPct)} faster | ${formatMs(scenario.chessiroCanvas.updateActualAvgMsMean)} | ${formatMs(scenario.reactChessboard.updateActualAvgMsMean)} | ${formatPct(scenario.profilerUpdateFasterPct)} faster |`,
    );
  }

  console.log('');
  console.log(`Saved detailed results to ${OUTPUT_FILE}`);
}

const scenarios = pickScenarios();
setupDom();

const chessiroCanvas = await runSuite('chessiro-canvas', (position) =>
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
  scenarios,
);

const reactChessboard = await runSuite('react-chessboard', (position) =>
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
  scenarios,
);

const bundle = createBundleSummary();
const overallComparison = compareSummaries(reactChessboard.summary, chessiroCanvas.summary);
const scenarioComparisons = buildScenarioComparisons(chessiroCanvas.scenarios, reactChessboard.scenarios);

const dragChessiro = await runDragStressTest('chessiro-canvas', (position, onAcceptedDrop) =>
  React.createElement(
    'div',
    { style: { width: `${BOARD_SIZE_PX}px`, height: `${BOARD_SIZE_PX}px` } },
    React.createElement(function ChessiroDragHarness() {
      const [currentPosition, setCurrentPosition] = React.useState(position);
      return React.createElement(ChessiroCanvas, {
        position: currentPosition,
        orientation: 'white',
        interactive: true,
        allowDragging: true,
        allowDrawingArrows: false,
        showAnimations: false,
        onMove: (from, to) => {
          const next = applyMoveOnPlacement(currentPosition, from, to);
          if (next === currentPosition) return false;
          setCurrentPosition(next);
          onAcceptedDrop(from, to);
          return true;
        },
      });
    }),
  )
);

const dragReactCb = await runDragStressTest('react-chessboard', (position, onAcceptedDrop) =>
  React.createElement(
    'div',
    { style: { width: `${BOARD_SIZE_PX}px`, height: `${BOARD_SIZE_PX}px` } },
    React.createElement(function ReactChessboardDragHarness() {
      const [currentPosition, setCurrentPosition] = React.useState(position);
      return React.createElement(Chessboard, {
        id: 'react-cb-drag',
        position: currentPosition,
        boardWidth: BOARD_SIZE_PX,
        arePiecesDraggable: true,
        animationDuration: 0,
        onPieceDrop: (from, to) => {
          const next = applyMoveOnPlacement(currentPosition, from, to);
          if (next === currentPosition) return false;
          setCurrentPosition(next);
          onAcceptedDrop(from, to);
          return true;
        },
      });
    }),
  )
);

const comparison = {
  ...overallComparison,
  overall: overallComparison,
  scenarios: scenarioComparisons,
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
    scenarioCount: scenarios.length,
    scenarioFilter: SCENARIO_FILTER.length > 0 ? SCENARIO_FILTER : null,
    scenarios: scenarios.map((scenario) => ({
      id: scenario.id,
      name: scenario.name,
      positions: scenario.positions.length,
    })),
    positionsTested: scenarios.reduce((sum, scenario) => sum + scenario.positions.length, 0),
  },
  bundle,
  dragTest: {
    chessiro: dragChessiro,
    reactCb: dragReactCb
  },
  results: {
    chessiroCanvas,
    reactChessboard,
    comparison,
  },
};

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

printSummary(result);
