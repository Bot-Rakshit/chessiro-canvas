import type { Pieces, Square, PieceRole, PieceColor } from '../types';
import { FILES, RANKS } from '../types';

const ROLE_MAP: Record<string, PieceRole> = {
  p: 'p', r: 'r', n: 'n', b: 'b', q: 'q', k: 'k',
};

export const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
export const INITIAL_GAME_FEN = `${INITIAL_FEN} w KQkq - 0 1`;

export function readFen(fen: string): Pieces {
  const pieces: Pieces = new Map();
  // Only parse the piece placement part (before first space)
  const placement = fen.split(' ')[0] || fen;
  if (placement === 'start') return readFen(INITIAL_FEN);

  let rank = 7;
  let file = 0;

  for (const ch of placement) {
    if (ch === '/') {
      rank--;
      file = 0;
      if (rank < 0) break;
      continue;
    }
    if (ch === ' ' || ch === '[') break;

    const num = ch.charCodeAt(0);
    if (num >= 49 && num <= 56) {
      // digit 1-8: skip squares
      file += num - 48;
    } else {
      const lower = ch.toLowerCase();
      const role = ROLE_MAP[lower];
      if (role && file < 8 && rank >= 0) {
        const color: PieceColor = ch === lower ? 'b' : 'w';
        const square = `${FILES[file]}${RANKS[rank]}` as Square;
        pieces.set(square, { color, role });
      }
      file++;
    }
  }

  return pieces;
}

export function writeFen(pieces: Pieces): string {
  const ranks: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let empty = 0;
    let rankStr = '';
    for (let f = 0; f < 8; f++) {
      const sq = `${FILES[f]}${RANKS[r]}` as Square;
      const piece = pieces.get(sq);
      if (piece) {
        if (empty > 0) {
          rankStr += empty;
          empty = 0;
        }
        let ch = piece.role;
        if (piece.color === 'w') ch = ch.toUpperCase() as PieceRole;
        rankStr += ch;
      } else {
        empty++;
      }
    }
    if (empty > 0) rankStr += empty;
    ranks.push(rankStr);
  }
  return ranks.join('/');
}
