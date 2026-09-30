// Static SVG snapshot of a position — for share cards, OG images, PDFs,
// thumbnails and anywhere a live React board is overkill. Pure string
// building: runs in Node, edge runtimes, workers and the browser alike.

import type { Arrow, ArrowBrushes, BoardTheme, Orientation, Square } from '../types';
import { DEFAULT_ARROW_BRUSHES } from '../types';
import { readFen, INITIAL_FEN } from '../utils/fen';
import { DEFAULT_PIECE_SVGS } from '../defaultPieceDataUris';

export type PieceCode = 'wp' | 'wn' | 'wb' | 'wr' | 'wq' | 'wk' | 'bp' | 'bn' | 'bb' | 'br' | 'bq' | 'bk';

export const DEFAULT_BOARD_THEME: BoardTheme = {
  id: 'Chessiro',
  name: 'Chessiro',
  darkSquare: '#785E45',
  lightSquare: '#DFC29A',
  margin: '#66503B',
  lastMoveHighlight: '#DFAA4E',
  selectedPiece: '#B57340',
};

export interface BoardSvgOptions {
  /** FEN (only the placement field is read). Default: the initial position. */
  position?: string;
  orientation?: Orientation;
  /** Rendered width/height in px. Default: 512. */
  size?: number;
  theme?: Partial<BoardTheme>;
  /** Draw the frame around the board. Default: true. */
  showMargin?: boolean;
  /** Frame thickness as a fraction of one square. Default: 0.375 (24px on a 512px board). */
  marginSquares?: number;
  /** Frame corner radius in px. Default: 4. */
  marginRadius?: number;
  /** File/rank labels: on the frame when shown, otherwise inside the edge squares. Default: true. */
  showCoordinates?: boolean;
  /** Coordinate font. Default: a system sans-serif stack. */
  fontFamily?: string;
  lastMove?: { from: string; to: string } | null;
  /** Opacity of the last-move highlight. Default: 0.5. */
  lastMoveOpacity?: number;
  /** King square in check — painted with a red radial glow. */
  check?: string | null;
  /** Square → CSS color fills (painted under the pieces). */
  highlightedSquares?: Record<string, string>;
  /** Right-click style marks (translucent red fill). */
  markedSquares?: string[];
  arrows?: Arrow[];
  arrowBrushes?: Partial<ArrowBrushes>;
  /** Arrow opacity. Default: 0.85. */
  arrowOpacity?: number;
  /** Draw knight arrows as an L like the live board. Default: true. */
  knightArrowsLShaped?: boolean;
  /**
   * Raw SVG markup per piece (e.g. `{ wk: '<svg …>…</svg>' }`). Missing codes
   * fall back to the built-in set. Inlined, so the output is self-contained.
   */
  pieceSvgs?: Partial<Record<PieceCode, string>>;
  /**
   * Image URL per piece. Used by reference (`<image href>`), so the SVG is not
   * self-contained — prefer `pieceSvgs` when rasterising.
   */
  pieceUrls?: Partial<Record<PieceCode, string>>;
  /** Rotate piece artwork 180° (pass-and-play). Default: false. */
  flipPieces?: boolean;
  /** Prefix for internal ids, to keep several inline SVGs on one page apart. Default: 'cc'. */
  idPrefix?: string;
  /** Accessible title. Default: a description of the side to view. */
  title?: string;
  /** Background behind a rounded frame (e.g. a card color). Default: transparent. */
  background?: string;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function num(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

function isSquare(s: string | undefined | null): s is Square {
  return !!s && s.length === 2 && s[0] >= 'a' && s[0] <= 'h' && s[1] >= '1' && s[1] <= '8';
}

/** Parse `<svg viewBox=…>inner</svg>` into a reusable <symbol>. */
function toSymbol(id: string, svg: string): string {
  const cleaned = svg.replace(/<\?xml[^>]*\?>/g, '').replace(/<!DOCTYPE[^>]*>/gi, '').trim();
  const open = /<svg\b([^>]*)>/i.exec(cleaned);
  const close = cleaned.lastIndexOf('</svg>');
  if (!open || close < 0) return '';
  const attrs = open[1];
  const inner = cleaned.slice(open.index + open[0].length, close);
  const viewBox = /viewBox\s*=\s*"([^"]+)"/i.exec(attrs)?.[1] ?? '0 0 45 45';
  return `<symbol id="${id}" viewBox="${esc(viewBox)}">${inner}</symbol>`;
}

/**
 * Render a board position to a standalone SVG string.
 *
 * ```ts
 * import { renderBoardSvg } from 'chessiro-canvas/core';
 * const svg = renderBoardSvg({ position: fen, lastMove: { from: 'e2', to: 'e4' }, size: 1200 });
 * ```
 */
export function renderBoardSvg(options: BoardSvgOptions = {}): string {
  const theme = { ...DEFAULT_BOARD_THEME, ...options.theme };
  const asWhite = (options.orientation ?? 'white') === 'white';
  const size = options.size ?? 512;
  const showMargin = options.showMargin ?? true;
  const m = showMargin ? options.marginSquares ?? 0.375 : 0;
  const total = 8 + 2 * m;
  const unit = size / total; // px per square, for px-denominated knobs
  const prefix = options.idPrefix ?? 'cc';
  const pieces = readFen(options.position || INITIAL_FEN);
  const brushes = { ...DEFAULT_ARROW_BRUSHES, ...options.arrowBrushes };
  const font = options.fontFamily ?? "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

  const xy = (sq: string): [number, number] => {
    const f = sq.charCodeAt(0) - 97;
    const r = sq.charCodeAt(1) - 49;
    return [m + (asWhite ? f : 7 - f), m + (asWhite ? 7 - r : r)];
  };
  const center = (sq: string): [number, number] => {
    const [x, y] = xy(sq);
    return [x + 0.5, y + 0.5];
  };

  const out: string[] = [];
  const title = options.title ?? `Chess position, ${asWhite ? 'white' : 'black'} at the bottom`;
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${num(size)}" height="${num(size)}" viewBox="0 0 ${num(total)} ${num(total)}" role="img" aria-label="${esc(title)}">`,
    `<title>${esc(title)}</title>`,
  );

  // Piece symbols: each type defined once, stamped with <use>.
  const used = new Set<PieceCode>();
  for (const p of pieces.values()) used.add(`${p.color}${p.role}` as PieceCode);
  const defs: string[] = [];
  for (const code of used) {
    if (options.pieceUrls?.[code] && !options.pieceSvgs?.[code]) continue;
    const svg = options.pieceSvgs?.[code] ?? DEFAULT_PIECE_SVGS[code];
    defs.push(toSymbol(`${prefix}-${code}`, svg));
  }
  defs.push(
    `<radialGradient id="${prefix}-check" cx="50%" cy="50%" r="50%">` +
      '<stop offset="0%" stop-color="#ff0000" stop-opacity="1"/>' +
      '<stop offset="25%" stop-color="#e70000" stop-opacity="1"/>' +
      '<stop offset="89%" stop-color="#a90000" stop-opacity="0"/>' +
      '<stop offset="100%" stop-color="#9e0000" stop-opacity="0"/>' +
      '</radialGradient>',
  );
  out.push(`<defs>${defs.join('')}</defs>`);

  if (options.background) {
    out.push(`<rect width="${num(total)}" height="${num(total)}" fill="${esc(options.background)}"/>`);
  }
  if (m > 0) {
    const rx = (options.marginRadius ?? 4) / unit;
    out.push(`<rect width="${num(total)}" height="${num(total)}" rx="${num(rx)}" fill="${esc(theme.margin || theme.darkSquare)}"/>`);
  }

  // Squares: one light backdrop + 32 dark cells keeps the output small.
  out.push(`<rect x="${num(m)}" y="${num(m)}" width="8" height="8" fill="${esc(theme.lightSquare)}"/>`);
  let dark = '';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) dark += `M${num(m + col)} ${num(m + row)}h1v1h-1z`;
    }
  }
  out.push(`<path d="${dark}" fill="${esc(theme.darkSquare)}"/>`);

  const fill = (sq: string, color: string, opacity?: number) => {
    if (!isSquare(sq)) return;
    const [x, y] = xy(sq);
    out.push(`<rect x="${num(x)}" y="${num(y)}" width="1" height="1" fill="${esc(color)}"${opacity !== undefined ? ` fill-opacity="${num(opacity)}"` : ''}/>`);
  };

  if (options.lastMove) {
    const color = theme.lastMoveHighlight ?? '#DFAA4E';
    const opacity = options.lastMoveOpacity ?? 0.5;
    fill(options.lastMove.from, color, opacity);
    fill(options.lastMove.to, color, opacity);
  }
  for (const [sq, color] of Object.entries(options.highlightedSquares ?? {})) fill(sq, color);
  for (const sq of options.markedSquares ?? []) fill(sq, 'rgba(235, 64, 52, 0.65)');
  if (isSquare(options.check)) {
    const [x, y] = xy(options.check);
    out.push(`<rect x="${num(x)}" y="${num(y)}" width="1" height="1" fill="url(#${prefix}-check)"/>`);
  }

  // Coordinates.
  if (options.showCoordinates ?? true) {
    const files = 'abcdefgh';
    if (m > 0) {
      const fs = Math.min(m * 0.62, 0.3);
      const color = esc(theme.lightSquare);
      for (let i = 0; i < 8; i++) {
        const file = files[asWhite ? i : 7 - i];
        const rank = String(asWhite ? 8 - i : i + 1);
        out.push(
          `<text x="${num(m + i + 0.5)}" y="${num(m + 8 + m / 2)}" font-size="${num(fs)}" fill="${color}" font-family="${esc(font)}" font-weight="600" text-anchor="middle" dominant-baseline="central">${file}</text>`,
          `<text x="${num(m / 2)}" y="${num(m + i + 0.5)}" font-size="${num(fs)}" fill="${color}" font-family="${esc(font)}" font-weight="600" text-anchor="middle" dominant-baseline="central">${rank}</text>`,
        );
      }
    } else {
      const fs = 0.2;
      for (let i = 0; i < 8; i++) {
        const file = files[asWhite ? i : 7 - i];
        const rank = String(asWhite ? 8 - i : i + 1);
        // Bottom row / left column colors alternate with the squares beneath.
        const fileColor = (7 + i) % 2 === 1 ? theme.lightSquare : theme.darkSquare;
        const rankColor = i % 2 === 1 ? theme.lightSquare : theme.darkSquare;
        out.push(
          `<text x="${num(m + i + 0.94)}" y="${num(m + 7.94)}" font-size="${fs}" fill="${esc(fileColor)}" font-family="${esc(font)}" font-weight="600" text-anchor="end">${file}</text>`,
          `<text x="${num(m + 0.05)}" y="${num(m + i + 0.22)}" font-size="${fs}" fill="${esc(rankColor)}" font-family="${esc(font)}" font-weight="600">${rank}</text>`,
        );
      }
    }
  }

  // Pieces.
  for (const [sq, p] of pieces) {
    const code = `${p.color}${p.role}` as PieceCode;
    const [x, y] = xy(sq);
    const flip = options.flipPieces ? ` transform="rotate(180 ${num(x + 0.5)} ${num(y + 0.5)})"` : '';
    const url = !options.pieceSvgs?.[code] ? options.pieceUrls?.[code] : undefined;
    if (url) {
      out.push(`<image href="${esc(url)}" xlink:href="${esc(url)}" x="${num(x)}" y="${num(y)}" width="1" height="1"${flip}/>`);
    } else {
      out.push(`<use href="#${prefix}-${code}" xlink:href="#${prefix}-${code}" x="${num(x)}" y="${num(y)}" width="1" height="1"${flip}/>`);
    }
  }

  // Arrows, on top of pieces like the live board.
  const opacity = options.arrowOpacity ?? 0.85;
  const lw = 0.13;
  for (const a of options.arrows ?? []) {
    if (!isSquare(a.startSquare) || !isSquare(a.endSquare) || a.startSquare === a.endSquare) continue;
    const color = esc(a.color || (a.brush ? brushes[a.brush] : brushes.green));
    const [sx, sy] = center(a.startSquare);
    const [ex, ey] = center(a.endSquare);
    const df = Math.abs(a.endSquare.charCodeAt(0) - a.startSquare.charCodeAt(0));
    const dr = Math.abs(a.endSquare.charCodeAt(1) - a.startSquare.charCodeAt(1));
    const knight = (options.knightArrowsLShaped ?? true) && ((df === 1 && dr === 2) || (df === 2 && dr === 1));
    // Knight arrows bend: the long leg first, then the short one.
    const points: Array<[number, number]> = [[sx, sy]];
    if (knight) {
      const longIsX = Math.abs(ex - sx) > Math.abs(ey - sy);
      points.push(longIsX ? [ex, sy] : [sx, ey]);
    }
    const [px, py] = points[points.length - 1];
    const len = Math.hypot(ex - px, ey - py);
    const ux = (ex - px) / len;
    const uy = (ey - py) / len;
    const headLen = 0.4;
    const headHalf = 0.2;
    const tipX = ex - ux * 0.12;
    const tipY = ey - uy * 0.12;
    const baseX = tipX - ux * headLen;
    const baseY = tipY - uy * headLen;
    points.push([baseX + ux * 0.02, baseY + uy * 0.02]);
    const d = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${num(x)} ${num(y)}`).join('');
    out.push(
      `<g opacity="${num(opacity)}">` +
        `<path d="${d}" fill="none" stroke="${color}" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<path d="M${num(tipX)} ${num(tipY)}L${num(baseX - uy * headHalf)} ${num(baseY + ux * headHalf)}L${num(baseX + uy * headHalf)} ${num(baseY - ux * headHalf)}Z" fill="${color}"/>` +
        '</g>',
    );
  }

  out.push('</svg>');
  return out.join('');
}
