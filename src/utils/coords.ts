import type { File, Rank, Square, Pos, ScreenPos } from '../types';
import { FILES, RANKS } from '../types';

export const ALL_SQUARES: readonly Square[] = FILES.flatMap(f =>
  RANKS.map(r => `${f}${r}` as Square),
);

export function pos2square(pos: Pos): Square | undefined {
  if (pos[0] < 0 || pos[0] > 7 || pos[1] < 0 || pos[1] > 7) return undefined;
  return `${FILES[pos[0]]}${RANKS[pos[1]]}` as Square;
}

export function square2pos(sq: Square): Pos {
  return [sq.charCodeAt(0) - 97, sq.charCodeAt(1) - 49];
}

export function pos2translate(
  pos: Pos,
  asWhite: boolean,
  boundsWidth: number,
  boundsHeight: number,
): ScreenPos {
  const sqW = boundsWidth / 8;
  const sqH = boundsHeight / 8;
  return [
    (asWhite ? pos[0] : 7 - pos[0]) * sqW,
    (asWhite ? 7 - pos[1] : pos[1]) * sqH,
  ];
}

export function screenPos2square(
  clientX: number,
  clientY: number,
  asWhite: boolean,
  bounds: DOMRect,
): Square | undefined {
  let file = Math.floor((8 * (clientX - bounds.left)) / bounds.width);
  if (!asWhite) file = 7 - file;
  let rank = 7 - Math.floor((8 * (clientY - bounds.top)) / bounds.height);
  if (!asWhite) rank = 7 - rank;
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return undefined;
  return pos2square([file, rank]);
}

export function squareCenter(
  sq: Square,
  asWhite: boolean,
  bounds: DOMRect,
): ScreenPos {
  const pos = square2pos(sq);
  const [x, y] = pos2translate(pos, asWhite, bounds.width, bounds.height);
  return [
    bounds.left + x + bounds.width / 16,
    bounds.top + y + bounds.height / 16,
  ];
}

export function isLightSquare(sq: Square): boolean {
  const f = sq.charCodeAt(0) - 97;
  const r = sq.charCodeAt(1) - 49;
  return (f + r) % 2 !== 0;
}

export function fileOf(sq: string): File {
  return sq[0] as File;
}

export function rankOf(sq: string): Rank {
  return sq[1] as Rank;
}

export function distanceSq(a: Pos, b: Pos): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
}

export function samePiece(
  a: { color: string; role: string },
  b: { color: string; role: string },
): boolean {
  return a.color === b.color && a.role === b.role;
}
