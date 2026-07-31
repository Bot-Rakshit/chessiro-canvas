// Browser regression test for the cinematic handoff.
//
// When a cinematic move lands, the layer resolves so the caller can commit the
// real move. React commits that in a task which lands AFTER a rAF callback but
// BEFORE paint, so any attempt to hide the newly committed piece from a rAF is
// always one frame late — the clone and the real piece both get painted, which
// reads as the piece "appearing twice".
//
// This cannot be caught in jsdom: it has no paint pipeline, and its commit
// timing does not reproduce the interleaving (a jsdom version of this test
// passes even with the fix removed). It needs a real browser.
//
// Usage: npm run test:frames    (boots its own Vite server against demo/)

import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.FRAME_TEST_PORT ?? 5233);
const URL = `http://localhost:${PORT}/`;

// Styles to exercise, with how long to watch each. Trail ghosts are an
// intentional part of brilliant/meteor and are excluded from the count.
const CASES = [
  { name: 'Smooth replay', rx: /Smooth replay/, ms: 5000 },
  { name: 'Brilliant', rx: /Brilliant move/, ms: 5000 },
  { name: 'Slam', rx: /^Slam/, ms: 3500 },
  { name: 'Meteor', rx: /Meteor smash/, ms: 5000 },
];

const PIECES_ON_BOARD = 32;

const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  cwd: path.join(ROOT, 'demo'),
  stdio: 'ignore',
  detached: true,
});
const shutdown = () => { try { process.kill(-server.pid); } catch { /* already gone */ } };
process.on('exit', shutdown);
process.on('SIGINT', () => { shutdown(); process.exit(130); });

let failures = 0;
const assert = (cond, label) => {
  console.log(`${cond ? '  ok  ' : 'FAIL  '}${label}`);
  if (!cond) failures += 1;
};

try {
  // Wait for the dev server.
  let up = false;
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(URL); if (r.ok) { up = true; break; } } catch { /* not yet */ }
    await delay(500);
  }
  if (!up) throw new Error(`dev server did not start on ${URL}`);

  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.locator('#cinematics').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  const startWatching = () => page.evaluate(() => {
    window.__peak = { max: 0, frames: 0 };
    const plate = document.querySelector('#cinematics .plate');
    const t0 = performance.now();
    const visible = (el) => {
      let n = el, opacity = 1;
      while (n && n !== plate) {
        const s = getComputedStyle(n);
        opacity *= parseFloat(s.opacity || '1');
        if (s.display === 'none') return false;
        n = n.parentElement;
      }
      return opacity > 0.05;
    };
    const inTrail = (el) => {
      let n = el;
      while (n && n !== plate) {
        if (n.dataset && n.dataset.cineTrail !== undefined) return true;
        n = n.parentElement;
      }
      return false;
    };
    const tick = () => {
      const overlay = plate.querySelector('[data-cine-overlay]');
      const imgs = [...plate.querySelectorAll('img')];
      const clones = overlay ? imgs.filter((i) => overlay.contains(i) && !inTrail(i)) : [];
      const reals = imgs.filter((i) => !overlay || !overlay.contains(i));
      window.__peak.max = Math.max(window.__peak.max, reals.filter(visible).length + clones.filter(visible).length);
      window.__peak.frames += 1;
      if (performance.now() - t0 < 8000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  for (const testCase of CASES) {
    await page.getByRole('button', { name: /Reset & cancel/ }).click();
    await page.waitForTimeout(600);
    await startWatching();
    await page.getByRole('button', { name: testCase.rx }).click();
    await page.waitForTimeout(testCase.ms);
    const peak = await page.evaluate(() => window.__peak);
    assert(peak.frames > 0, `${testCase.name}: frames sampled (${peak.frames})`);
    assert(
      peak.max <= PIECES_ON_BOARD,
      `${testCase.name}: clone never painted alongside the committed piece `
      + `(peak ${peak.max}, expected <= ${PIECES_ON_BOARD})`,
    );
  }

  await browser.close();
} finally {
  shutdown();
}

if (failures > 0) {
  console.error(`\n${failures} cinematic frame test(s) failed`);
  process.exit(1);
}
console.log('\ncinematic frame tests passed');
