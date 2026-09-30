// Drives the web harness (react-native-web) with Playwright: renders the
// board, plays tap-tap and drag moves, a rejected drop, a promotion, a
// position jump and a flip, and records where pieces are mid-animation.
//
//   npm run example:web          # in one terminal (serves :5199)
//   node example-web/verify.mjs  # SHOTS=<dir> for screenshots
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('../../node_modules/playwright');
const OUT = process.env.SHOTS ?? 'example-web/shots';
mkdirSync(OUT, { recursive: true });
const URL = process.env.URL ?? 'http://localhost:5199/';
const SQ = 60; // 480px board

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 640, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text());
});
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-testid="board"]');
await page.waitForTimeout(600);

const box = await page.locator('[data-testid="board"]').boundingBox();
const center = (sq, orientation = 'white') => {
  const f = sq.charCodeAt(0) - 97;
  const r = sq.charCodeAt(1) - 49;
  const col = orientation === 'white' ? f : 7 - f;
  const row = orientation === 'white' ? 7 - r : r;
  return { x: box.x + (col + 0.5) * SQ, y: box.y + (row + 0.5) * SQ };
};
/** Rendered top-left of the piece element for a square (board px), or null. */
const piecePos = (testId) =>
  page.evaluate((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`);
    if (!el) return null;
    const board = document.querySelector('[data-testid="board"]').getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left - board.left), y: Math.round(r.top - board.top), w: Math.round(r.width), opacity: getComputedStyle(el).opacity };
  }, testId);
const fen = () => page.evaluate(() => window.__cc.fen());
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png`, clip: { x: box.x - 10, y: box.y - 10, width: 500, height: 540 } });
const tap = async (sq) => {
  const p = center(sq);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.up();
};

await shot('01-initial');
check('renders 32 pieces', (await page.locator('[data-testid^="piece-"]').count()) === 32);

// ── Tap-tap move with animation ──
await tap('e2');
await page.waitForTimeout(150);
await shot('02-e2-selected');
const dotsVisible = await page.evaluate(() => document.querySelectorAll('circle').length);
check('tap selects e2 and shows legal hints', dotsVisible >= 2, `${dotsVisible} hint circles`);
await tap('e4');
const samples = [];
for (let i = 0; i < 8; i++) {
  samples.push(await piecePos('piece-e4'));
  if (i === 2) await shot('03-e2e4-mid-flight');
  await page.waitForTimeout(40);
}
await page.waitForTimeout(400);
const e4 = await piecePos('piece-e4');
await shot('04-e2e4-done');
check('tap-tap e2-e4 committed', (await fen()).startsWith('rnbqkbnr/pppppppp/8/8/4P3/'));
const ys = samples.filter(Boolean).map((p) => p.y);
check(
  'pawn glides e2→e4 (intermediate positions)',
  ys.some((y) => y > 4 * SQ + 2 && y < 6 * SQ - 2) && e4.y === 4 * SQ,
  `y samples ${ys.join(',')} → ${e4.y}`,
);

// ── Drag and drop (black reply e7-e5), piece follows the pointer ──
{
  const a = center('e7');
  const b = center('e5');
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(a.x, a.y + ((b.y - a.y) * i) / 10);
  await page.waitForTimeout(150);
  await shot('05-drag-e7e5-lifted');
  const ghost = await page.evaluate(() => {
    // The ghost is the only piece-sized node with a scale transform > 1.
    const nodes = [...document.querySelectorAll('div')].filter((d) => /scale\((1\.[1-9])/.test(d.style.transform));
    return nodes.length;
  });
  check('dragged piece lifts (scaled ghost under the pointer)', ghost >= 1);
  await page.mouse.up();
  const after = [];
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(25);
    after.push((await piecePos('piece-e5'))?.y);
  }
  // Never drawn back near e7 (y=60): the carried piece is not replayed from its origin.
  check('dropped piece does not re-animate from its origin', after.every((y) => y !== undefined && y >= 3 * SQ - 12), `y ${after.join(',')}`);
  await page.waitForTimeout(300);
  check('drag e7-e5 committed', (await fen()).startsWith('rnbqkbnr/pppp1ppp/8/4p3/4P3/'));
  const e5 = await piecePos('piece-e5');
  check('dropped pawn rests on e5, fully opaque', e5 && e5.y === 3 * SQ && e5.x === 4 * SQ && e5.opacity === '1', JSON.stringify(e5));
  await shot('06-drag-done');
}

// ── Rejected drop snaps back ──
{
  const a = center('g1');
  const b = center('g4');
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(a.x, a.y + ((b.y - a.y) * i) / 8);
  await page.mouse.up();
  await page.waitForTimeout(60);
  await shot('07-illegal-drop-snapping-back');
  await page.waitForTimeout(500);
  const g1 = await piecePos('piece-g1');
  check('illegal drop rejected, knight back on g1', (await fen()).includes('RNBQKBNR') && g1?.y === 7 * SQ && g1?.opacity === '1', JSON.stringify(g1));
  const log = await page.evaluate(() => window.__cc.log.slice(-2));
  check('onPieceLift/onPieceDrop fired', log.some((l) => l.startsWith('lift g1')) && log.some((l) => l === 'drop g1g4 false'), log.join(' | '));
}

// ── Castling by drag: the king is carried, the rook still animates ──
await page.evaluate(() => window.__cc.setFen('r3k2r/pppq1ppp/2np1n2/2b1p1B1/2B1P1b1/2NP1N2/PPPQ1PPP/R3K2R w KQkq - 0 8'));
await page.waitForTimeout(900);
{
  const a = center('e1');
  const b = center('g1');
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 8, a.y);
  await page.mouse.up();
  const rookXs = [];
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(30);
    rookXs.push((await piecePos('piece-f1'))?.x);
    if (i === 1) await shot('06b-castle-rook-gliding');
  }
  await page.waitForTimeout(400);
  const k = await piecePos('piece-g1');
  check('O-O by drag: king rests on g1', k?.x === 6 * SQ && k?.y === 7 * SQ, JSON.stringify(k));
  check('O-O by drag: rook glides h1→f1', rookXs.some((x) => x > 5 * SQ + 2 && x < 7 * SQ - 2), `x ${rookXs.join(',')}`);
}

// ── Capture with the 'playful' preset (knockout) ──
await page.evaluate(() => window.__cc.setFen('rnbqkbnr/ppp2ppp/8/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3'));
await page.waitForTimeout(900);
await tap('e4');
await tap('d5');
await page.waitForTimeout(170);
await shot('08-capture-knockout');
const exiting = await page.locator('[data-testid^="exiting-"]').count();
check('captured piece plays an exit (kept on screen while leaving)', exiting === 1, `${exiting} exiting`);
await page.waitForTimeout(900);
check('exiting piece removed afterwards', (await page.locator('[data-testid^="exiting-"]').count()) === 0);

// ── Promotion via drag, chooser, pick a knight ──
await page.evaluate(() => window.__cc.setFen('8/4P1k1/8/8/8/8/6K1/8 w - - 0 1'));
await page.waitForTimeout(900);
{
  const a = center('e7');
  const b = center('e8');
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(a.x, a.y + ((b.y - a.y) * i) / 6);
  await page.mouse.up();
  await page.waitForTimeout(250);
  await shot('09-promotion-chooser');
  const opts = await page.locator('[aria-label^="Promote to"]').count();
  check('promotion chooser shows 4 options', opts === 4, `${opts}`);
  await page.locator('[aria-label="Promote to knight"]').click();
  await page.waitForTimeout(500);
  check('promotion to knight committed', (await fen()).startsWith('4N3/6k1/'), await fen());
  await shot('10-promoted');
}

// ── Position jump: pieces glide, stagger ──
await page.evaluate(() => window.__cc.setPreset('arcade'));
await page.evaluate(() => window.__cc.setFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'));
await page.waitForTimeout(120);
await shot('11-new-game-arcade-mid');
await page.waitForTimeout(1200);
await shot('12-new-game-arcade-done');
check('new game restores 32 pieces', (await page.locator('[data-testid^="piece-"]').count()) === 32);

// ── Flip with rotate ──
await page.evaluate(() => window.__cc.setPreset('playful'));
await page.waitForTimeout(50);
await page.evaluate(() => window.__cc.setOrientation('black'));
await page.waitForTimeout(160);
await shot('13-flip-rotate-mid');
const midSpin = await page.evaluate(() => {
  const p = document.querySelector('[data-testid="piece-e1"]');
  return p?.parentElement?.style.transform ?? '';
});
await page.waitForTimeout(900);
await shot('14-flipped');
const e1 = await piecePos('piece-e1');
check('flip rotates the piece layer mid-way', /rotate\((?!0deg)/.test(midSpin), midSpin);
check('after flip, white king at top (black orientation)', e1?.y === 0 && e1?.x === 4 * SQ - SQ, JSON.stringify(e1));

// ── Imperative API ──
await page.evaluate(() => window.__cc.setOrientation('white'));
await page.waitForTimeout(900);
await page.evaluate(() => {
  const b = window.__cc.board();
  b.pulseSquare('d4', { times: 2, durationMs: 500 });
  b.shakePiece('e1');
});
await page.waitForTimeout(120);
await shot('15-pulse-and-shake');
await page.evaluate(() => window.__cc.board().animateMove('g1', 'f3', { durationMs: 600 }));
await page.waitForTimeout(300);
await shot('16-animateMove-demo');
await page.waitForTimeout(600);
const demo = await piecePos('piece-g1');
check('animateMove parks the knight on f3 without committing', demo?.x === 5 * SQ && demo?.y === 5 * SQ && (await fen()).includes('RNBQKBNR'), JSON.stringify(demo));
const hit = await page.evaluate(() => window.__cc.board().getSquareAtPoint(250, 430));
check('getSquareAtPoint(250, 430) → e1', hit === 'e1', String(hit));

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
