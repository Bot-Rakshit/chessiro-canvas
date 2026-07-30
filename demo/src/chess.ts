import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';

export const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function posFromFen(fen: string) {
  return Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
}

export function createInitialPosition() {
  return posFromFen(STARTING_FEN);
}

export type Position = ReturnType<typeof createInitialPosition>;
