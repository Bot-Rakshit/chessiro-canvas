// `chessiro-canvas/core` — the framework-free half of the library.
//
// No React, no DOM: FEN parsing, square geometry, move diffing, the motion
// model and the static SVG renderer. Safe to import from Node (OG images,
// server rendering), web workers, edge runtimes and React Native.

import type { Orientation, Square } from '../types';
import type { BoardPoint } from './motion';

export { readFen, writeFen, INITIAL_FEN, INITIAL_GAME_FEN } from '../utils/fen';
export { premoveDests } from '../utils/premove';
export { ALL_SQUARES, isLightSquare } from '../utils/coords';
export { computeAnimPlan } from '../animation/anim';
export type { AnimationPlan, PlannedMove, PlannedPiece } from '../animation/anim';
export { DEFAULT_PIECE_SVGS } from '../defaultPieceDataUris';
export { renderBoardSvg, DEFAULT_BOARD_THEME } from './boardSvg';
export type { BoardSvgOptions, PieceCode } from './boardSvg';
export {
  EASINGS,
  MOVE_ANIMATION_PRESETS,
  cubicBezier,
  resolveEasing,
  resolveMoveAnimation,
  moveDurationMs,
  planMoveTrack,
  planCaptureTrack,
  planAppearTrack,
  planSnapBackTrack,
  planLandingTrack,
  planFlipFadeTrack,
  sampleTrack,
  staggerRank,
} from './motion';
export type {
  EasingFunction,
  EasingName,
  CaptureAnimation,
  LandingAnimation,
  AppearAnimation,
  FlipAnimation,
  MoveAnimationPreset,
  MoveAnimationOptions,
  ResolvedMoveAnimation,
  ResolveMoveAnimationContext,
  MotionKeyframe,
  MotionTrack,
  BoardPoint,
} from './motion';
export { DEFAULT_ARROW_BRUSHES, FILES, RANKS } from '../types';
export type {
  Square,
  Piece,
  Pieces,
  PieceColor,
  PieceRole,
  Orientation,
  Arrow,
  ArrowBrush,
  ArrowBrushes,
  BoardTheme,
  Dests,
  PromotionPiece,
} from '../types';

/** Screen-space column/row (0..7) of a square for the given orientation. */
export function squareToPoint(square: Square | string, orientation: Orientation = 'white'): BoardPoint {
  const f = square.charCodeAt(0) - 97;
  const r = square.charCodeAt(1) - 49;
  return orientation === 'white' ? [f, 7 - r] : [7 - f, r];
}

/** Inverse of `squareToPoint`; floors fractional points. Null when off the board. */
export function pointToSquare(x: number, y: number, orientation: Orientation = 'white'): Square | null {
  const col = Math.floor(x);
  const row = Math.floor(y);
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  const f = orientation === 'white' ? col : 7 - col;
  const r = orientation === 'white' ? 7 - row : row;
  return `${String.fromCharCode(97 + f)}${r + 1}` as Square;
}
