/**
 * Minimal chess logic for the demo.
 * In production, the app provides dests via chessops - the library itself has no chess logic.
 * This is just enough to make the demo interactive.
 */

import type { Dests, Square } from 'chessiro-canvas';
import { readFen } from 'chessiro-canvas';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

interface SimpleMove {
  from: string;
  to: string;
  captured?: boolean;
  promotion?: string;
  castle?: boolean;
  enPassant?: boolean;
  san?: string;
}

// Very basic move generator for standard chess (enough for demo)
export function computeDests(fen: string): Dests {
  const dests: Dests = new Map();
  const pieces = readFen(fen);
  const parts = fen.split(' ');
  const turn = parts[1] === 'b' ? 'b' : 'w';

  for (const [sq, piece] of pieces) {
    if (piece.color !== turn) continue;
    const moves = getMovesForPiece(sq, piece, pieces, fen);
    if (moves.length > 0) {
      dests.set(sq, moves as Square[]);
    }
  }

  return dests;
}

function getMovesForPiece(
  sq: string,
  piece: { color: string; role: string },
  pieces: Map<string, { color: string; role: string }>,
  _fen: string,
): string[] {
  const f = sq.charCodeAt(0) - 97;
  const r = parseInt(sq[1]) - 1;
  const moves: string[] = [];
  const color = piece.color;

  const isEnemy = (s: string) => {
    const p = pieces.get(s as Square);
    return p && p.color !== color;
  };
  const isEmpty = (s: string) => !pieces.get(s as Square);
  const isValid = (file: number, rank: number) => file >= 0 && file < 8 && rank >= 0 && rank < 8;
  const sq2 = (file: number, rank: number) => `${FILES[file]}${RANKS[rank]}`;

  switch (piece.role) {
    case 'p': {
      const dir = color === 'w' ? 1 : -1;
      const startRank = color === 'w' ? 1 : 6;
      // Forward
      if (isValid(f, r + dir) && isEmpty(sq2(f, r + dir))) {
        moves.push(sq2(f, r + dir));
        if (r === startRank && isEmpty(sq2(f, r + 2 * dir))) {
          moves.push(sq2(f, r + 2 * dir));
        }
      }
      // Captures
      for (const df of [-1, 1]) {
        if (isValid(f + df, r + dir)) {
          const target = sq2(f + df, r + dir);
          if (isEnemy(target)) moves.push(target);
        }
      }
      break;
    }
    case 'n': {
      const offsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      for (const [df, dr] of offsets) {
        if (isValid(f + df, r + dr)) {
          const target = sq2(f + df, r + dr);
          if (isEmpty(target) || isEnemy(target)) moves.push(target);
        }
      }
      break;
    }
    case 'b': {
      for (const [df, dr] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
        for (let i = 1; i < 8; i++) {
          if (!isValid(f + df*i, r + dr*i)) break;
          const target = sq2(f + df*i, r + dr*i);
          if (isEmpty(target)) { moves.push(target); continue; }
          if (isEnemy(target)) moves.push(target);
          break;
        }
      }
      break;
    }
    case 'r': {
      for (const [df, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        for (let i = 1; i < 8; i++) {
          if (!isValid(f + df*i, r + dr*i)) break;
          const target = sq2(f + df*i, r + dr*i);
          if (isEmpty(target)) { moves.push(target); continue; }
          if (isEnemy(target)) moves.push(target);
          break;
        }
      }
      break;
    }
    case 'q': {
      for (const [df, dr] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
        for (let i = 1; i < 8; i++) {
          if (!isValid(f + df*i, r + dr*i)) break;
          const target = sq2(f + df*i, r + dr*i);
          if (isEmpty(target)) { moves.push(target); continue; }
          if (isEnemy(target)) moves.push(target);
          break;
        }
      }
      break;
    }
    case 'k': {
      for (const [df, dr] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
        if (isValid(f + df, r + dr)) {
          const target = sq2(f + df, r + dr);
          if (isEmpty(target) || isEnemy(target)) moves.push(target);
        }
      }
      break;
    }
  }

  return moves;
}

// Simple FEN updater for moves (no full validation)
export function applyMove(fen: string, from: string, to: string, promotion?: string): string {
  const pieces = readFen(fen);
  const piece = pieces.get(from as Square);
  if (!piece) return fen;

  pieces.delete(from as Square);
  pieces.set(to as Square, promotion
    ? { color: piece.color, role: promotion as any }
    : piece
  );

  // Rebuild FEN piece placement
  const ranks: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let empty = 0;
    let rankStr = '';
    for (let f = 0; f < 8; f++) {
      const sq = `${FILES[f]}${RANKS[r]}` as Square;
      const p = pieces.get(sq);
      if (p) {
        if (empty > 0) { rankStr += empty; empty = 0; }
        let ch: string = p.role;
        if (p.color === 'w') ch = ch.toUpperCase();
        rankStr += ch;
      } else {
        empty++;
      }
    }
    if (empty > 0) rankStr += empty;
    ranks.push(rankStr);
  }

  const parts = fen.split(' ');
  const newTurn = parts[1] === 'w' ? 'b' : 'w';
  const moveNum = parts[1] === 'b' ? String(parseInt(parts[5] || '1') + 1) : (parts[5] || '1');

  return `${ranks.join('/')} ${newTurn} ${parts[2] || 'KQkq'} ${parts[3] || '-'} 0 ${moveNum}`;
}
