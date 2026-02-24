export { ChessiroCanvas } from './ChessiroCanvas';
export { readFen, writeFen, INITIAL_FEN, INITIAL_GAME_FEN } from './utils/fen';
export { preloadPieceSet } from './hooks/usePieceCache';
export { premoveDests } from './utils/premove';

export type {
  ChessiroCanvasProps,
  ChessiroCanvasRef,
  Arrow,
  ArrowBrush,
  ArrowBrushes,
  ArrowVisuals,
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
