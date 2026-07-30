/**
 * Generates the README hero screenshot and the social (og:image) card by
 * driving the real demo board in Chromium.
 *
 * Prerequisites:
 *   npm run build
 *   npm --prefix demo run dev -- --port 5199   (or set PREVIEW_URL)
 *   npx playwright install chromium
 *
 * Usage:
 *   node scripts/generate-readme-preview.mjs
 *
 * Outputs:
 *   media/board-preview.png     - board only, for the README (not published to npm)
 *   demo/public/og-image.png    - 1200x630 social card
 */

import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const URL_BASE = process.env.PREVIEW_URL ?? 'http://localhost:5199';
const BOARD_PNG = resolve(ROOT, 'media/board-preview.png');
const OG_PNG = resolve(ROOT, 'demo/public/og-image.png');

// Board is rendered white-to-move at the bottom, so a1 is bottom-left.
function squareCenter(box, square) {
  const file = square.charCodeAt(0) - 97;          // a..h -> 0..7
  const rank = Number.parseInt(square[1], 10) - 1; // 1..8 -> 0..7
  const size = box.width / 8;
  return {
    x: box.x + (file + 0.5) * size,
    y: box.y + (7 - rank + 0.5) * size,
  };
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
  });

  await page.goto(URL_BASE, { waitUntil: 'networkidle' });

  // The playground board: a square container holding the ChessiroCanvas root.
  const board = page.locator('#playground .aspect-square > div').first();
  await board.waitFor({ state: 'visible' });
  await board.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600); // let fonts + piece SVGs settle

  const box = await board.boundingBox();
  if (!box) throw new Error('could not measure the board element');

  const at = (square) => squareCenter(box, square);
  const clickSquare = async (square) => {
    const { x, y } = at(square);
    await page.mouse.click(x, y);
    await page.waitForTimeout(320); // outlast the 200ms move animation
  };

  // Play 1. e4 e5 2. Nf3 so the shot shows a real position with a last-move
  // highlight rather than the start position.
  for (const [from, to] of [['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3']]) {
    await clickSquare(from);
    await clickSquare(to);
  }

  // Select the black knight so legal-move indicators are visible. This must
  // come BEFORE the arrow: a left click clears drawn arrows.
  await clickSquare('b8');

  // Right-drag an arrow f3 -> e5 (the knight's pressure on the pawn).
  const f3 = at('f3');
  const e5 = at('e5');
  await page.mouse.move(f3.x, f3.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(e5.x, e5.y, { steps: 12 });
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(400);

  await mkdir(dirname(BOARD_PNG), { recursive: true });
  await board.screenshot({ path: BOARD_PNG });
  console.log(`wrote ${BOARD_PNG}`);

  // ── Social card ────────────────────────────────────────────────────
  const boardDataUri = `data:image/png;base64,${(await readFile(BOARD_PNG)).toString('base64')}`;
  const card = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 2,
  });
  await card.setContent(`
    <html><head><meta charset="utf-8" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet" />
      <style>
        * { margin: 0; box-sizing: border-box; }
        body {
          width: 1200px; height: 630px; display: flex; align-items: center; gap: 64px;
          padding: 0 72px; background: #0a0e17; color: #f8fafc;
          font-family: Inter, -apple-system, sans-serif;
        }
        .copy { flex: 1; }
        h1 { font-size: 60px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.05; }
        h1 span { color: #f59e0b; }
        p { margin-top: 24px; font-size: 26px; line-height: 1.45; color: #94a3b8; }
        ul { margin-top: 32px; display: flex; gap: 11px; list-style: none; padding: 0; flex-wrap: nowrap; }
        li {
          font-size: 17px; font-weight: 600; color: #cbd5e1; padding: 8px 15px; white-space: nowrap;
          border: 1px solid #1e293b; border-radius: 999px; background: #0f172a;
        }
        img { width: 430px; height: 430px; border-radius: 18px; box-shadow: 0 30px 70px rgba(0,0,0,.55); }
      </style></head>
      <body>
        <div class="copy">
          <h1>chessiro<span>-canvas</span></h1>
          <p>A fast, lightweight React chessboard<br />component for TypeScript apps.</p>
          <ul><li>Zero dependencies</li><li>~32 KB gzip</li><li>TypeScript-first</li></ul>
        </div>
        <img src="${boardDataUri}" alt="" />
      </body></html>
  `, { waitUntil: 'networkidle' });
  await card.waitForTimeout(500); // webfont paint

  await mkdir(dirname(OG_PNG), { recursive: true });
  await card.screenshot({ path: OG_PNG });
  console.log(`wrote ${OG_PNG}`);

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
