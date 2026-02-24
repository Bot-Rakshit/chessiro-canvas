import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEMO_DIR = path.join(ROOT_DIR, 'demo');
const ARTIFACT_DIR = path.join(ROOT_DIR, 'benchmarks', 'browser-artifacts');
const OUTPUT_DIR = path.join(ROOT_DIR, 'benchmarks', 'browser');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'latest.json');

const PORT = Number(process.env.BENCH_BROWSER_PORT ?? 5588);
const ROUNDS = Number(process.env.BENCH_ROUNDS ?? 8);
const WARMUP_ROUNDS = Number(process.env.BENCH_WARMUP_ROUNDS ?? 2);
const UPDATES_PER_ROUND = Number(process.env.BENCH_UPDATES ?? 300);
const SCENARIO_FILTER = (process.env.BENCH_SCENARIOS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function toViteFsModulePath(filePath) {
  const normalized = filePath.split(path.sep).join('/');
  return `/@fs/${encodeURI(normalized)}`;
}

async function runCommand(label, command, args, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      env: process.env,
      shell: false,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed with exit code ${code ?? 'unknown'}`));
    });
  });
}

function startViteServer(port) {
  const child = spawn(
    'npm',
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    {
      cwd: DEMO_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
      shell: false,
    },
  );

  child.stdout.on('data', (data) => process.stdout.write(`[vite] ${data}`));
  child.stderr.on('data', (data) => process.stderr.write(`[vite] ${data}`));

  return child;
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  const timeout = sleep(6000).then(() => {
    if (child.exitCode === null) child.kill('SIGKILL');
  });
  await Promise.race([once(child, 'exit'), timeout]);
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  let lastError = null;

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`Server responded with ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }

  throw new Error(`Vite server did not become ready at ${url}. Last error: ${lastError}`);
}

async function createGithubWorktree() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chessiro-browser-gh-'));
  await runCommand('Create github worktree', 'git', ['worktree', 'add', '--detach', tempDir, 'origin/main'], ROOT_DIR);
  return tempDir;
}

async function removeGithubWorktree(worktreePath) {
  if (!worktreePath) return;
  await runCommand('Remove github worktree', 'git', ['worktree', 'remove', '--force', worktreePath], ROOT_DIR);
}

async function prepareSnapshot(repoPath, snapshotId) {
  const outDir = path.join(ARTIFACT_DIR, snapshotId);
  const outFile = path.join(outDir, 'index.js');
  const outMapFile = path.join(outDir, 'index.js.map');
  fs.mkdirSync(outDir, { recursive: true });

  await runCommand(`Build ${snapshotId}`, 'npm', ['run', 'build'], repoPath);

  const srcFile = path.join(repoPath, 'dist', 'index.js');
  const srcMapFile = path.join(repoPath, 'dist', 'index.js.map');
  fs.copyFileSync(srcFile, outFile);
  if (fs.existsSync(srcMapFile)) {
    fs.copyFileSync(srcMapFile, outMapFile);
  }
  return outFile;
}

async function runBrowserBenchmarkOnce(chessiroModulePath) {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    throw new Error('Playwright is not installed. Run `npm install` then `npm run benchmark:browser:install`.');
  }

  const { chromium } = playwright;
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/bench.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__CHESSIRO_PLAYWRIGHT_BENCH__?.run));

    const result = await page.evaluate(
      async ({ modulePath, rounds, warmupRounds, updatesPerRound, scenarioIds }) =>
        window.__CHESSIRO_PLAYWRIGHT_BENCH__.run({
          chessiroModulePath: modulePath,
          rounds,
          warmupRounds,
          updatesPerRound,
          scenarioIds,
        }),
      {
        modulePath: toViteFsModulePath(chessiroModulePath),
        rounds: ROUNDS,
        warmupRounds: WARMUP_ROUNDS,
        updatesPerRound: UPDATES_PER_ROUND,
        scenarioIds: SCENARIO_FILTER.length > 0 ? SCENARIO_FILTER : undefined,
      },
    );

    return result;
  } finally {
    await browser.close();
  }
}

async function runBrowserBenchmark(chessiroModulePath) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await runBrowserBenchmarkOnce(chessiroModulePath);
    } catch (error) {
      const message = String(error?.message ?? error);
      const shouldRetry =
        attempt < maxAttempts &&
        (message.includes('Execution context was destroyed') ||
          message.includes('Timeout 30000ms exceeded'));
      if (!shouldRetry) throw error;
      console.warn(
        `[benchmark] Browser run attempt ${attempt}/${maxAttempts} failed (${message}). Retrying...`,
      );
      await sleep(500);
    }
  }
  throw new Error('Browser benchmark failed after retries.');
}

function buildScenarioDelta(githubRun, localRun) {
  const githubById = new Map(githubRun.results.chessiroCanvas.scenarios.map((scenario) => [scenario.id, scenario]));
  return localRun.results.chessiroCanvas.scenarios.map((localScenario) => {
    const githubScenario = githubById.get(localScenario.id);
    if (!githubScenario) {
      throw new Error(`Missing github scenario ${localScenario.id}`);
    }
    const githubMean = githubScenario.summary.updateWallPerUpdateMs.mean;
    const localMean = localScenario.summary.updateWallPerUpdateMs.mean;
    return {
      id: localScenario.id,
      name: localScenario.name,
      positionsTested: localScenario.positionsTested,
      githubUpdatePerRenderMs: githubMean,
      localUpdatePerRenderMs: localMean,
      localFasterPct: percentFaster(githubMean, localMean),
    };
  });
}

function printSummary(githubRun, localRun, comparisons) {
  const githubChessiro = githubRun.results.chessiroCanvas.summary;
  const localChessiro = localRun.results.chessiroCanvas.summary;
  const githubVsReact = githubRun.results.comparison.overall;
  const localVsReact = localRun.results.comparison.overall;

  console.log('\nPlaywright Browser Benchmark\n');
  console.log(
    `Config: ${ROUNDS} rounds (+${WARMUP_ROUNDS} warmup), ${UPDATES_PER_ROUND} updates/round`,
  );
  if (SCENARIO_FILTER.length > 0) {
    console.log(`Scenario filter: ${SCENARIO_FILTER.join(', ')}`);
  }

  console.log('\nOverall (Chessiro only)\n');
  console.log('| Metric | github main | local | Local vs github |');
  console.log('| --- | ---: | ---: | ---: |');
  console.log(`| Mount wall time | ${formatMs(githubChessiro.mountWallMs.mean)} | ${formatMs(localChessiro.mountWallMs.mean)} | ${formatPct(comparisons.localVsGithub.mountWallFasterPct)} faster |`);
  console.log(`| Update wall per render | ${formatMs(githubChessiro.updateWallPerUpdateMs.mean)} | ${formatMs(localChessiro.updateWallPerUpdateMs.mean)} | ${formatPct(comparisons.localVsGithub.updateWallPerRenderFasterPct)} faster |`);
  console.log(`| React profiler update | ${formatMs(githubChessiro.updateActualAvgMs.mean)} | ${formatMs(localChessiro.updateActualAvgMs.mean)} | ${formatPct(comparisons.localVsGithub.profilerUpdateFasterPct)} faster |`);

  console.log('\nVs react-chessboard\n');
  console.log('| Snapshot | Update/render delta vs react | Profiler update delta vs react |');
  console.log('| --- | ---: | ---: |');
  console.log(`| github main | ${formatPct(githubVsReact.updateWallPerRenderFasterPct)} faster | ${formatPct(githubVsReact.profilerUpdateFasterPct)} faster |`);
  console.log(`| local | ${formatPct(localVsReact.updateWallPerRenderFasterPct)} faster | ${formatPct(localVsReact.profilerUpdateFasterPct)} faster |`);

  console.log('\nScenario delta (Chessiro local vs github)\n');
  console.log('| Scenario | Positions | github update/render | local update/render | Local vs github |');
  console.log('| --- | ---: | ---: | ---: | ---: |');
  for (const scenario of comparisons.scenarios) {
    console.log(
      `| ${scenario.name} | ${scenario.positionsTested} | ${formatMs(scenario.githubUpdatePerRenderMs)} | ${formatMs(scenario.localUpdatePerRenderMs)} | ${formatPct(scenario.localFasterPct)} faster |`,
    );
  }

  console.log(`\nSaved detailed results to ${OUTPUT_FILE}`);
}

let viteProcess = null;
let githubWorktreePath = null;

try {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  await runCommand('Install demo dependencies', 'npm', ['install'], DEMO_DIR);

  const localArtifactFile = await prepareSnapshot(ROOT_DIR, 'local');

  githubWorktreePath = await createGithubWorktree();
  await runCommand('Install github worktree dependencies', 'npm', ['install'], githubWorktreePath);
  const githubArtifactFile = await prepareSnapshot(githubWorktreePath, 'github-main');

  viteProcess = startViteServer(PORT);
  await waitForServer(`http://127.0.0.1:${PORT}/bench.html`);

  const githubRun = await runBrowserBenchmark(githubArtifactFile);
  const localRun = await runBrowserBenchmark(localArtifactFile);

  const localVsGithub = {
    mountWallFasterPct: percentFaster(
      githubRun.results.chessiroCanvas.summary.mountWallMs.mean,
      localRun.results.chessiroCanvas.summary.mountWallMs.mean,
    ),
    updateWallPerRenderFasterPct: percentFaster(
      githubRun.results.chessiroCanvas.summary.updateWallPerUpdateMs.mean,
      localRun.results.chessiroCanvas.summary.updateWallPerUpdateMs.mean,
    ),
    profilerUpdateFasterPct: percentFaster(
      githubRun.results.chessiroCanvas.summary.updateActualAvgMs.mean,
      localRun.results.chessiroCanvas.summary.updateActualAvgMs.mean,
    ),
  };

  const comparisons = {
    localVsGithub,
    scenarios: buildScenarioDelta(githubRun, localRun),
  };

  const output = {
    generatedAt: new Date().toISOString(),
    config: {
      rounds: ROUNDS,
      warmupRounds: WARMUP_ROUNDS,
      updatesPerRound: UPDATES_PER_ROUND,
      scenarioFilter: SCENARIO_FILTER.length > 0 ? SCENARIO_FILTER : null,
      browser: 'chromium',
    },
    runs: {
      githubMain: githubRun,
      local: localRun,
    },
    comparisons,
  };

  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  printSummary(githubRun, localRun, comparisons);
} finally {
  await stopProcess(viteProcess);
  await removeGithubWorktree(githubWorktreePath);
}
