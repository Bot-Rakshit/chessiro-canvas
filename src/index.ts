export { ChessiroCanvas } from './ChessiroCanvas';
export { readFen, writeFen, INITIAL_FEN, INITIAL_GAME_FEN } from './utils/fen';
export { preloadPieceSet } from './hooks/usePieceCache';
export { premoveDests } from './utils/premove';
// Piece artwork resolver ('wN' -> image src). Useful for building external
// piece palettes / spare-piece trays alongside ref.getSquareAtPoint().
export { resolvePieceImageSrc } from './defaultPieces';

export type {
  ChessiroCanvasProps,
  ChessiroCanvasRef,
  Arrow,
  ArrowBrush,
  ArrowBrushes,
  ArrowVisuals,
  ArrowHeadShape,
  BoardTheme,
  NotationVisuals,
  OverlayVisuals,
  PromotionVisuals,
  SquareVisuals,
  PieceSet,
  Orientation,
  PromotionPiece,
  PromotionContext,
  PremoveConfig,
  MoveQualityBadge,
  GhostPiece,
  AnimateMoveOptions,
  PulseSquareOptions,
  SquareLabel,
  ExpectedMove,
  TextOverlay,
  AnimationEvent,
  Dests,
  Square,
  Piece,
  PieceColor,
  PieceRole,
  PieceRenderer,
} from './types';

export { DEFAULT_ARROW_BRUSHES } from './types';
