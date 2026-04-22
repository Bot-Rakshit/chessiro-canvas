import type { Square, Pieces, PieceColor } from '../types';
import { FILES, RANKS } from '../types';

const isValid = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8;
const sq = (f: number, r: number): Square => `${FILES[f]}${RANKS[r]}` as Square;

/**
 * Compute all legal premove destinations for a piece on a given square.
 *
 * Premoves allow any geometrically reachable square — including squares
 * currently occupied by one of *our own* pieces, because by the time the
 * premove fires the opponent may well have captured that piece (the classic
 * "premove a recapture" case). Sliding pieces still stop AT the first
 * occupied square (they can't jump through pieces mid-premove), but they
 * may target it.
 */
export function premoveDests(
  square: Square,
  pieces: Pieces,
  color: PieceColor,
): Square[] {
  const piece = pieces.get(square);
  if (!piece || piece.color !== color) return [];

  const f = square.charCodeAt(0) - 97;
  const r = parseInt(square[1]) - 1;
  const results: Square[] = [];

  switch (piece.role) {
    case 'p': {
      const dir = color === 'w' ? 1 : -1;
      const startRank = color === 'w' ? 1 : 6;
      // Forward
      if (isValid(f, r + dir)) {
        results.push(sq(f, r + dir));
        if (r === startRank && isValid(f, r + 2 * dir)) {
          results.push(sq(f, r + 2 * dir));
        }
      }
      // Diagonal captures (always available for premove - en passant possible)
      for (const df of [-1, 1]) {
        if (isValid(f + df, r + dir)) {
          results.push(sq(f + df, r + dir));
        }
      }
      break;
    }
    case 'n': {
      for (const [df, dr] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        if (isValid(f + df, r + dr)) {
          results.push(sq(f + df, r + dr));
        }
      }
      break;
    }
    case 'b': {
      for (const [df, dr] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
        for (let i = 1; i < 8; i++) {
          const tf = f + df*i, tr = r + dr*i;
          if (!isValid(tf, tr)) break;
          results.push(sq(tf, tr));
          if (pieces.get(sq(tf, tr))) break; // stop AT any occupant
        }
      }
      break;
    }
    case 'r': {
      for (const [df, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        for (let i = 1; i < 8; i++) {
          const tf = f + df*i, tr = r + dr*i;
          if (!isValid(tf, tr)) break;
          results.push(sq(tf, tr));
          if (pieces.get(sq(tf, tr))) break;
        }
      }
      break;
    }
    case 'q': {
      for (const [df, dr] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
        for (let i = 1; i < 8; i++) {
          const tf = f + df*i, tr = r + dr*i;
          if (!isValid(tf, tr)) break;
          results.push(sq(tf, tr));
          if (pieces.get(sq(tf, tr))) break;
        }
      }
      break;
    }
    case 'k': {
      // Normal king moves
      for (const [df, dr] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
        if (isValid(f + df, r + dr)) {
          results.push(sq(f + df, r + dr));
        }
      }
      // Castling premoves: king on e-file. Require that the target king
      // square is empty or an enemy — otherwise castling can't possibly be
      // legal by the time the premove fires.
      const homeRank = color === 'w' ? 0 : 7;
      if (f === 4 && r === homeRank) {
        const empty = (tf: number, tr: number) => {
          const occ = pieces.get(sq(tf, tr));
          return !occ || occ.color !== color;
        };
        if (empty(6, homeRank)) results.push(sq(6, homeRank));
        if (empty(2, homeRank)) results.push(sq(2, homeRank));
      }
      break;
    }
  }

  return results;
}

/**
 * Snap a position to the nearest valid queen or knight direction from origin.
 * Used for arrow drawing to snap to valid piece movement directions.
 */
export function snapToValidDirection(
  origFile: number,
  origRank: number,
  targetFile: number,
  targetRank: number,
): [number, number] {
  // All possible squares reachable by queen or knight moves
  let bestSq: [number, number] = [targetFile, targetRank];
  let bestDist = Infinity;

  for (let f = 0; f < 8; f++) {
    for (let r = 0; r < 8; r++) {
      if (f === origFile && r === origRank) continue;
      if (!isQueenOrKnightMove(origFile, origRank, f, r)) continue;

      const dx = targetFile - f;
      const dy = targetRank - r;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        bestSq = [f, r];
      }
    }
  }

  return bestSq;
}

function isQueenOrKnightMove(f1: number, r1: number, f2: number, r2: number): boolean {
  const df = Math.abs(f2 - f1);
  const dr = Math.abs(r2 - r1);

  // Knight
  if ((df === 1 && dr === 2) || (df === 2 && dr === 1)) return true;

  // Queen (rook + bishop directions)
  if (df === 0 || dr === 0 || df === dr) return true;

  return false;
}
