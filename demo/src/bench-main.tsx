import React, { Profiler } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Chessboard } from 'react-chessboard';

type SummaryStats = {
  mean: number;
  median: number;
  p95: number;
  stdev: number;
};

type RoundMetrics = {
  mountWallMs: number;
  updatesWallMs: number;
  updateWallPerUpdateMs: number;
  mountActualMs: number;
  updateActualAvgMs: number;
  updateActualP95Ms: number;
  profilerCommitCount: number;
};

type Scenario = {
  id: string;
  name: string;
  positions: string[];
};

type BenchmarkSuite = {
  rounds: RoundMetrics[];
  summary: {
    mountWallMs: SummaryStats;
    updatesWallMs: SummaryStats;
    updateWallPerUpdateMs: SummaryStats;
    mountActualMs: SummaryStats;
    updateActualAvgMs: SummaryStats;
    updateActualP95Ms: SummaryStats;
    profilerCommitCount: SummaryStats;
  };
  scenarios: Array<{
    id: string;
    name: string;
    positionsTested: number;
    rounds: RoundMetrics[];
    summary: BenchmarkSuite['summary'];
  }>;
};

type RunConfig = {
  chessiroModulePath: string;
  rounds?: number;
  warmupRounds?: number;
  updatesPerRound?: number;
  scenarioIds?: string[];
};

type ScenarioComparison = {
  id: string;
  name: string;
  positionsTested: number;
  mountWallFasterPct: number;
  updatesWallFasterPct: number;
  updateWallPerRenderFasterPct: number;
  profilerUpdateFasterPct: number;
  chessiroCanvas: {
    updateWallPerUpdateMsMean: number;
    updateActualAvgMsMean: number;
  };
  reactChessboard: {
    updateWallPerUpdateMsMean: number;
    updateActualAvgMsMean: number;
  };
};

type BrowserBenchmarkResult = {
  generatedAt: string;
  config: {
    rounds: number;
    warmupRounds: number;
    updatesPerRound: number;
    boardSizePx: number;
    scenarioCount: number;
    scenarios: Array<{ id: string; name: string; positions: number }>;
  };
  results: {
    chessiroCanvas: BenchmarkSuite;
    reactChessboard: BenchmarkSuite;
    comparison: {
      mountWallFasterPct: number;
      updatesWallFasterPct: number;
      updateWallPerRenderFasterPct: number;
      profilerUpdateFasterPct: number;
      overall: {
        mountWallFasterPct: number;
        updatesWallFasterPct: number;
        updateWallPerRenderFasterPct: number;
        profilerUpdateFasterPct: number;
      };
      scenarios: ScenarioComparison[];
    };
  };
};

const BOARD_SIZE_PX = 640;
const DEFAULT_ROUNDS = 8;
const DEFAULT_WARMUP_ROUNDS = 2;
const DEFAULT_UPDATES_PER_ROUND = 300;
const STABLE_EMPTY_ARROWS: any[] = Object.freeze([]);
const STABLE_EMPTY_MARKS: string[] = Object.freeze([]);
const STABLE_EMPTY_OVERLAYS: any[] = Object.freeze([]);
const STABLE_EMPTY_OBJECT: Record<string, string> = Object.freeze({});

const SCENARIOS: Scenario[] = [
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

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length <= 1) return 0;
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function summarize(values: number[]): SummaryStats {
  return {
    mean: mean(values),
    median: percentile(values, 50),
    p95: percentile(values, 95),
    stdev: stddev(values),
  };
}

function summarizeRounds(rounds: RoundMetrics[]): BenchmarkSuite['summary'] {
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

function percentFaster(baseline: number, candidate: number): number {
  if (baseline === 0) return 0;
  return ((baseline - candidate) / baseline) * 100;
}

function compareSummaries(
  baseline: BenchmarkSuite['summary'],
  candidate: BenchmarkSuite['summary'],
) {
  return {
    mountWallFasterPct: percentFaster(baseline.mountWallMs.mean, candidate.mountWallMs.mean),
    updatesWallFasterPct: percentFaster(baseline.updatesWallMs.mean, candidate.updatesWallMs.mean),
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

function selectScenarios(ids?: string[]): Scenario[] {
  if (!ids || ids.length === 0) return SCENARIOS;
  const byId = new Map(SCENARIOS.map((scenario) => [scenario.id, scenario]));
  const selected = ids.map((id) => {
    const scenario = byId.get(id);
    if (!scenario) throw new Error(`Unknown scenario id: ${id}`);
    return scenario;
  });
  return selected;
}

function renderBoardShell(child: React.ReactNode) {
  return React.createElement('div', {
    style: { width: `${BOARD_SIZE_PX}px`, height: `${BOARD_SIZE_PX}px` },
    children: child,
  });
}

async function runBenchmark(
  name: string,
  renderBoard: (position: string) => React.ReactElement,
  positions: string[],
  config: { rounds: number; warmupRounds: number; updatesPerRound: number },
): Promise<{ rounds: RoundMetrics[]; summary: BenchmarkSuite['summary'] }> {
  const rounds: RoundMetrics[] = [];

  for (let round = 0; round < config.rounds + config.warmupRounds; round += 1) {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const root = createRoot(container);
    const commits: Array<{ phase: string; actualDuration: number }> = [];

    const onRender: React.ProfilerOnRenderCallback = (_id, phase, actualDuration) => {
      commits.push({ phase, actualDuration });
    };

    let positionIndex = round % positions.length;
    let setPosition:
      | React.Dispatch<React.SetStateAction<string>>
      | null = null;

    function BenchmarkHost() {
      const [position, setPositionState] = React.useState(positions[positionIndex]);
      setPosition = setPositionState;
      return React.createElement(
        Profiler,
        { id: `${name}-${round}`, onRender },
        renderBoard(position),
      );
    }

    const mountStart = performance.now();
    flushSync(() => {
      root.render(React.createElement(BenchmarkHost));
    });
    const mountWallMs = performance.now() - mountStart;
    if (!setPosition) {
      throw new Error(`Benchmark host did not initialize for ${name}`);
    }

    const updatesStart = performance.now();
    for (let i = 0; i < config.updatesPerRound; i += 1) {
      positionIndex = (positionIndex + 1) % positions.length;
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          flushSync(() => {
            setPosition?.(positions[positionIndex]);
          });
          resolve();
        }, 0);
      });
    }
    const updatesWallMs = performance.now() - updatesStart;

    flushSync(() => {
      root.unmount();
    });
    container.remove();

    const mountCommit = commits.find((commit) => commit.phase === 'mount');
    const updateCommits = commits
      .filter((commit) => commit.phase !== 'mount')
      .map((commit) => commit.actualDuration);

    const metrics: RoundMetrics = {
      mountWallMs,
      updatesWallMs,
      updateWallPerUpdateMs: updatesWallMs / config.updatesPerRound,
      mountActualMs: mountCommit?.actualDuration ?? 0,
      updateActualAvgMs: mean(updateCommits),
      updateActualP95Ms: percentile(updateCommits, 95),
      profilerCommitCount: commits.length,
    };

    if (round >= config.warmupRounds) {
      rounds.push(metrics);
    }
  }

  return {
    rounds,
    summary: summarizeRounds(rounds),
  };
}

async function runSuite(
  name: string,
  renderBoard: (position: string) => React.ReactElement,
  scenarios: Scenario[],
  config: { rounds: number; warmupRounds: number; updatesPerRound: number },
): Promise<BenchmarkSuite> {
  const scenarioResults: BenchmarkSuite['scenarios'] = [];

  for (const scenario of scenarios) {
    const benchmark = await runBenchmark(
      `${name}:${scenario.id}`,
      renderBoard,
      scenario.positions,
      config,
    );
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

async function runBrowserBenchmark(runConfig: RunConfig): Promise<BrowserBenchmarkResult> {
  const rounds = runConfig.rounds ?? DEFAULT_ROUNDS;
  const warmupRounds = runConfig.warmupRounds ?? DEFAULT_WARMUP_ROUNDS;
  const updatesPerRound = runConfig.updatesPerRound ?? DEFAULT_UPDATES_PER_ROUND;
  const scenarios = selectScenarios(runConfig.scenarioIds);
  const sharedConfig = { rounds, warmupRounds, updatesPerRound };

  const cacheBust = `v=${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const separator = runConfig.chessiroModulePath.includes('?') ? '&' : '?';
  const modulePath = `${runConfig.chessiroModulePath}${separator}${cacheBust}`;
  const mod = await import(/* @vite-ignore */ modulePath);
  const chessiroExport = mod?.ChessiroCanvas ?? mod?.default?.ChessiroCanvas ?? mod?.default;
  if (!mod || !chessiroExport) {
    throw new Error(`Invalid chessiro module path: ${runConfig.chessiroModulePath}`);
  }

  const ChessiroCanvas = chessiroExport as React.ComponentType<any>;

  const chessiroCanvas = await runSuite(
    'chessiro-canvas',
    (position) =>
      renderBoardShell(
        React.createElement(ChessiroCanvas, {
          position,
          orientation: 'white',
          interactive: false,
          arrows: STABLE_EMPTY_ARROWS,
          markedSquares: STABLE_EMPTY_MARKS,
          overlays: STABLE_EMPTY_OVERLAYS,
          highlightedSquares: STABLE_EMPTY_OBJECT,
          showNotation: false,
          showMargin: false,
          allowDragging: false,
          allowDrawingArrows: false,
          showAnimations: false,
        }),
      ),
    scenarios,
    sharedConfig,
  );

  const reactChessboard = await runSuite(
    'react-chessboard',
    (position) =>
      renderBoardShell(
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
    sharedConfig,
  );

  const overall = compareSummaries(reactChessboard.summary, chessiroCanvas.summary);

  const reactById = new Map(reactChessboard.scenarios.map((scenario) => [scenario.id, scenario]));
  const scenarioComparisons: ScenarioComparison[] = chessiroCanvas.scenarios.map((scenario) => {
    const reactScenario = reactById.get(scenario.id);
    if (!reactScenario) throw new Error(`Missing react-chessboard scenario for ${scenario.id}`);
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

  return {
    generatedAt: new Date().toISOString(),
    config: {
      rounds,
      warmupRounds,
      updatesPerRound,
      boardSizePx: BOARD_SIZE_PX,
      scenarioCount: scenarios.length,
      scenarios: scenarios.map((scenario) => ({
        id: scenario.id,
        name: scenario.name,
        positions: scenario.positions.length,
      })),
    },
    results: {
      chessiroCanvas,
      reactChessboard,
      comparison: {
        ...overall,
        overall,
        scenarios: scenarioComparisons,
      },
    },
  };
}

declare global {
  interface Window {
    __CHESSIRO_PLAYWRIGHT_BENCH__?: {
      run: (config: RunConfig) => Promise<BrowserBenchmarkResult>;
      scenarios: Array<{ id: string; name: string; positions: number }>;
    };
  }
}

window.__CHESSIRO_PLAYWRIGHT_BENCH__ = {
  run: runBrowserBenchmark,
  scenarios: SCENARIOS.map((scenario) => ({
    id: scenario.id,
    name: scenario.name,
    positions: scenario.positions.length,
  })),
};

function App() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '16px', color: '#111' }}>
      <h1 style={{ margin: 0, fontSize: '20px' }}>Chessiro Browser Benchmark Harness</h1>
      <p style={{ marginTop: '8px' }}>
        Ready for Playwright. Use <code>window.__CHESSIRO_PLAYWRIGHT_BENCH__.run(...)</code>.
      </p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
