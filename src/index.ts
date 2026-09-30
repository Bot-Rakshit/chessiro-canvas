export { ChessiroCanvas } from './ChessiroCanvas';
export { readFen, writeFen, INITIAL_FEN, INITIAL_GAME_FEN } from './utils/fen';
export { preloadPieceSet } from './hooks/usePieceCache';
export { premoveDests } from './utils/premove';
// Piece artwork resolver ('wN' -> image src). Useful for building external
// piece palettes / spare-piece trays alongside ref.getSquareAtPoint().
export { resolvePieceImageSrc } from './defaultPieces';
// Motion model and static rendering, also available React-free from
// 'chessiro-canvas/core'.
export {
  EASINGS,
  MOVE_ANIMATION_PRESETS,
  cubicBezier,
  resolveMoveAnimation,
} from './core/motion';
export { renderBoardSvg, DEFAULT_BOARD_THEME } from './core/boardSvg';
export { svgToImageBlob } from './utils/exportImage';

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
  PieceTiltOptions,
  SquareLabel,
  ExpectedMove,
  CinematicStyle,
  CinematicMoveOptions,
  SquareBurstOptions,
  PopBadgeOptions,
  CelebrateOptions,
  PopBannerOptions,
  PromotionBeamOptions,
  ImplodeOptions,
  CastleSwapOptions,
  SpotlightOptions,
  SpotlightHandle,
  LaserOptions,
  DrawArrowOptions,
  CameraController,
  CameraZoomOptions,
  CameraTiltOptions,
  CameraShakeOptions,
  CameraDriftOptions,
  CinematicStep,
  PlayCinematicOptions,
  CinematicPlayback,
  TextOverlay,
  AnimationEvent,
  Dests,
  Square,
  Piece,
  PieceColor,
  PieceRole,
  PieceRenderer,
} from './types';
export type {
  MoveAnimationOptions,
  MoveAnimationPreset,
  EasingName,
  EasingFunction,
  CaptureAnimation,
  LandingAnimation,
  AppearAnimation,
  FlipAnimation,
  ResolvedMoveAnimation,
} from './core/motion';
export type { BoardSvgOptions, PieceCode } from './core/boardSvg';
export type { RasterOptions } from './utils/exportImage';

export { DEFAULT_ARROW_BRUSHES } from './types';
