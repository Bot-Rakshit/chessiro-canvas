import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type {
  Arrow,
  ArrowBrushes,
  BoardTheme,
  Dests,
  MoveAnimationOptions,
  MoveAnimationPreset,
  Orientation,
  PieceCode,
  PieceColor,
  PromotionPiece,
  Square,
} from './core';

/** Controlled premoves: the board queues one move while it is not your turn. */
export interface NativePremoveConfig {
  enabled: boolean;
  /** Show premove destination dots for the selected piece. Default: true. */
  showDests?: boolean;
  /**
   * Controlled premove `[from, to]`. When the key is present the board mirrors
   * it, and `null`/`undefined` clears the queued premove.
   */
  current?: [string, string] | null;
  events?: {
    set?: (from: string, to: string) => void;
    unset?: () => void;
  };
}

/** Colors and shapes of the square-level hints. */
export interface NativeSquareVisuals {
  /** Legal-move indicator on empty squares. Default: 'rgba(80, 37, 19, 0.65)'. */
  legalDot?: string;
  /** Filled 'dot' or hollow 'ring'. Default: 'ring'. */
  legalMoveStyle?: 'dot' | 'ring';
  /** Ring drawn around capturable pieces. Default: 'rgba(80, 37, 19, 0.8)'. */
  legalCaptureRing?: string;
  /** Capture ring shape. Default: 'square' (rounded corners). */
  legalCaptureRingShape?: 'circle' | 'square';
  /** Premove destination dot. Default: 'rgba(20, 85, 30, 0.5)'. */
  premoveDot?: string;
  /** Premove capture ring. Default: 'rgba(20, 85, 30, 0.6)'. */
  premoveCaptureRing?: string;
  /** Fill for the queued premove's squares. Default: 'rgba(20, 30, 85, 0.4)'. */
  premoveCurrent?: string;
  /** Fill for `markedSquares`. Default: 'rgba(235, 64, 52, 0.65)'. */
  markOverlay?: string;
  /** Fill for the selected piece's square. Default: `theme.selectedPiece` at 50%. */
  selected?: string;
  /** Square under the finger while dragging. Default: `theme.selectedPiece` at 35%. */
  dragOverHighlight?: string;
  /** Opacity of the piece left behind on its square while dragging. Default: 0.3. */
  dragOriginOpacity?: number;
}

/** A move the student is expected to play in guided (drill) mode. */
export interface ExpectedMove {
  from: string;
  to: string;
  /** When set, only this promotion piece is accepted. */
  promotion?: PromotionPiece;
}

/**
 * Custom piece artwork, e.g. `(code, size) => <Image source={pngs[code]} style={{ width: size, height: size }} />`.
 * Called once per piece per size change — never per frame.
 */
export type PieceRenderFn = (code: PieceCode, size: number) => ReactNode;

export interface ChessiroBoardProps {
  // Core
  /** FEN (only the placement field is read) or 'start'. Default: the initial position. */
  position?: string;
  orientation?: Orientation;
  /** Board width/height in px. When omitted the board measures its container's width. */
  size?: number;
  /** Allow selecting and moving pieces. Default: true. */
  interactive?: boolean;
  /** Whose turn it is. Needed for premoves. */
  turnColor?: PieceColor;
  /** Which color(s) the user may move. Defaults to `turnColor`; both when neither is set. */
  movableColor?: PieceColor | 'both';

  // Moves
  /** Legal destinations per square. When omitted every move is offered to `onMove`. */
  dests?: Dests;
  /** Return true to accept the move (then update `position`), false to snap the piece back. */
  onMove?: (from: string, to: string, promotion?: PromotionPiece) => boolean;
  lastMove?: { from: string; to: string } | null;
  /** King square in check. */
  check?: string | null;
  /** Skip the promotion chooser and always promote to this piece. */
  autoPromoteTo?: PromotionPiece;
  premovable?: NativePremoveConfig;

  // Guided mode
  /** Only these move(s) are accepted; anything else snaps back, shakes and fires `onWrongMove`. */
  expectedMove?: ExpectedMove | ExpectedMove[] | null;
  onWrongMove?: (from: string, to: string) => void;
  /** Feedback for a wrong move in guided mode. Default: 'shake'. */
  wrongMoveFeedback?: 'shake' | 'none';

  // Decorations
  arrows?: Arrow[];
  arrowBrushes?: Partial<ArrowBrushes>;
  /** Square → color fills, painted under the pieces. */
  highlightedSquares?: Record<string, string>;
  markedSquares?: string[];
  theme?: Partial<BoardTheme>;
  /** File/rank labels inside the edge squares. Default: true. */
  showCoordinates?: boolean;
  squareVisuals?: NativeSquareVisuals;
  /** Rotate piece artwork 180° without changing coordinates (pass-and-play). Default: false. */
  flipPieces?: boolean;
  /** Custom artwork. Default: the built-in Chessiro set rendered with react-native-svg. */
  renderPiece?: PieceRenderFn;

  // Motion
  /** Preset name or options — same model and presets as the web board. Default: 'classic'. */
  moveAnimation?: MoveAnimationOptions | MoveAnimationPreset;
  /** Base move duration in ms. Default: 200. */
  animationDurationMs?: number;
  /** Master switch for piece motion. Default: true. */
  showAnimations?: boolean;
  /** Scale of a piece lifted under the finger (chessground-style). Default: 1.6. */
  dragScale?: number;
  /** How far above the finger a dragged piece floats, in squares. Default: 0.5. */
  dragLiftSquares?: number;

  // Events
  /** Every tap on a square (after the board's own selection handling). */
  onSquarePress?: (square: string) => void;
  /** A drag started — wire `Haptics.selectionAsync()` here. */
  onPieceLift?: (square: string) => void;
  /** A dragged piece was released. `to` is null when dropped off the board. */
  onPieceDrop?: (from: string, to: string | null, accepted: boolean) => void;

  style?: StyleProp<ViewStyle>;
  /** Accessibility label for the board. Default: describes the side at the bottom. */
  accessibilityLabel?: string;
  testID?: string;
}

export interface PulseSquareOptions {
  /** Default: 'rgba(255, 215, 0, 0.55)'. */
  color?: string;
  /** Length of one pulse in ms. Default: 600. */
  durationMs?: number;
  /** Number of pulses. Default: 2. */
  times?: number;
}

export interface NativeAnimateMoveOptions {
  /** Travel time in ms. Default: 3.5× `animationDurationMs` (a slow, readable demo). */
  durationMs?: number;
}

export interface ChessiroBoardRef {
  /** Draw attention to a square with a pulsing fill. Resolves when done. */
  pulseSquare: (square: string, options?: PulseSquareOptions) => Promise<void>;
  /** Shake the piece on a square ("wrong move"). Resolves when done. */
  shakePiece: (square: string) => Promise<void>;
  /**
   * Demonstrate a move: glide the piece on `from` to `to` without calling
   * `onMove`. The piece rests on `to` until you commit the move by updating
   * `position` (or until the position changes otherwise).
   */
  animateMove: (from: string, to: string, options?: NativeAnimateMoveOptions) => Promise<void>;
  /** Square under a board-local point (px), or null outside the board. */
  getSquareAtPoint: (x: number, y: number) => Square | null;
  /** Deselect and cancel any pending promotion. */
  clearSelection: () => void;
}
