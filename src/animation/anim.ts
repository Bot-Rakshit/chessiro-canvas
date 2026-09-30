import type { Pieces, Piece, Square } from '../types';
import { ALL_SQUARES } from '../utils/coords';

export interface PlannedMove {
  from: Square;
  to: Square;
  piece: Piece;
}

export interface PlannedPiece {
  square: Square;
  piece: Piece;
}

/** What changed between two positions, expressed as motion. */
export interface AnimationPlan {
  /** Pieces that travel: matched by type to the nearest vacated square. */
  moves: PlannedMove[];
  /** Pieces that left without a matching arrival (captures, removals). */
  captures: PlannedPiece[];
  /** Pieces that arrived without a matching departure (setup, promotion). */
  appears: PlannedPiece[];
}

function pieceKey(p: Piece): string {
  return p.color + p.role;
}

function dist2(a: Square, b: Square): number {
  const df = a.charCodeAt(0) - b.charCodeAt(0);
  const dr = a.charCodeAt(1) - b.charCodeAt(1);
  return df * df + dr * dr;
}

/**
 * Diff two positions into moves, captures and appearances. Each arrival is
 * paired with the nearest vacated square holding the same piece type, which
 * is exact for normal moves and castling and a good guess for position jumps.
 * Runs in O(64 + n·m) with n, m the (tiny) per-type arrival/departure counts.
 */
export function computeAnimPlan(prevPieces: Pieces, nextPieces: Pieces): AnimationPlan {
  const vacated = new Map<string, PlannedPiece[]>();
  const arrivals: PlannedPiece[] = [];

  for (const sq of ALL_SQUARES) {
    const prev = prevPieces.get(sq);
    const next = nextPieces.get(sq);
    if (prev && next && prev.color === next.color && prev.role === next.role) continue;
    if (prev) {
      const key = pieceKey(prev);
      const list = vacated.get(key);
      if (list) list.push({ square: sq, piece: prev });
      else vacated.set(key, [{ square: sq, piece: prev }]);
    }
    if (next) arrivals.push({ square: sq, piece: next });
  }

  const moves: PlannedMove[] = [];
  const appears: PlannedPiece[] = [];
  for (const arrival of arrivals) {
    const candidates = vacated.get(pieceKey(arrival.piece));
    if (!candidates || candidates.length === 0) {
      appears.push(arrival);
      continue;
    }
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const d = dist2(candidates[i].square, arrival.square);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const [origin] = candidates.splice(best, 1);
    moves.push({ from: origin.square, to: arrival.square, piece: arrival.piece });
  }

  const captures: PlannedPiece[] = [];
  for (const list of vacated.values()) {
    for (const left of list) captures.push(left);
  }

  return { moves, captures, appears };
}
