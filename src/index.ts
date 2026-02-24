export { ChessiroCanvas } from './ChessiroCanvas';
export { readFen, writeFen, INITIAL_FEN } from './utils/fen';
export { preloadPieceSet } from './hooks/usePieceCache';
export { premoveDests } from './utils/premove';

export type {
  ChessiroCanvasProps,
  ChessiroCanvasRef,
  Arrow,
  ArrowBrush,
  ArrowBrushes,
  BoardTheme,
  SquareVisuals,
  PieceSet,
  Orientation,
  PromotionPiece,
  PromotionContext,
  PremoveConfig,
  MoveQualityBadge,
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
