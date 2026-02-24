import type { CSSProperties, ReactNode } from 'react';

// ── Square & Coordinate Types ──────────────────────────────────────

export type File = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';
export type Rank = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
export type Square = `${File}${Rank}`;
export type Pos = [number, number]; // [file 0-7, rank 0-7]
export type ScreenPos = [number, number]; // [x px, y px]

export const FILES: readonly File[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
export const RANKS: readonly Rank[] = ['1', '2', '3', '4', '5', '6', '7', '8'];

// ── Piece Types ────────────────────────────────────────────────────

export type PieceColor = 'w' | 'b';
export type PieceRole = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PieceKey = `${PieceColor}${Uppercase<PieceRole>}`;

export interface Piece {
  color: PieceColor;
  role: PieceRole;
}

export type Pieces = Map<Square, Piece>;
export type PiecesDiff = Map<Square, Piece | undefined>;

// ── Board Orientation ──────────────────────────────────────────────

export type Orientation = 'white' | 'black';

// ── Arrows ─────────────────────────────────────────────────────────

export type ArrowBrush = 'green' | 'red' | 'blue' | 'yellow';

export interface Arrow {
  startSquare: string;
  endSquare: string;
  color: string;
  brush?: ArrowBrush;
}

export interface ArrowBrushes {
  green: string;
  red: string;
  blue: string;
  yellow: string;
}

export const DEFAULT_ARROW_BRUSHES: ArrowBrushes = {
  green: '#15781B',
  red: '#882020',
  blue: '#003088',
  yellow: '#e68f00',
};

// ── Premove ────────────────────────────────────────────────────────

export interface PremoveConfig {
  enabled: boolean;
  showDests?: boolean;         // show premove destination dots
  current?: [string, string];  // current premove [from, to]
  events?: {
    set?: (from: string, to: string) => void;
    unset?: () => void;
  };
}

// ── Dests (legal move destinations) ────────────────────────────────

export type Dests = Map<Square, Square[]>;

// ── Theme ──────────────────────────────────────────────────────────

export interface BoardTheme {
  id: string;
  name: string;
  darkSquare: string;
  lightSquare: string;
  margin?: string;
  lastMoveHighlight?: string;
  selectedPiece?: string;
}

export interface SquareVisuals {
  markOverlay?: string;
  markOutline?: string;
  selectedOutline?: string;
  legalDot?: string;
  legalDotOutline?: string;
  legalCaptureRing?: string;
  premoveDot?: string;
  premoveCaptureRing?: string;
  premoveCurrent?: string;
  checkGradient?: string;
}

// ── Piece Set ──────────────────────────────────────────────────────

export interface PieceSet {
  id: string;
  name: string;
  path: string; // URL path prefix, pieces at `${path}/wp.svg`, etc.
}

// ── Highlights ─────────────────────────────────────────────────────

export interface SquareHighlight {
  square: Square;
  className?: string;
  color?: string;
}

// ── Move Quality Badge ─────────────────────────────────────────────

export interface MoveQualityBadge {
  square: Square;
  icon: string; // URL to badge icon
  label?: string;
}

// ── Animation ──────────────────────────────────────────────────────

export interface AnimationVector {
  fromPos: Pos;
  toPos: Pos;
  // current offset from final position (decreases to 0)
  currentX: number;
  currentY: number;
}

export type AnimationVectors = Map<Square, AnimationVector>;

export interface AnimationPlan {
  anims: AnimationVectors;
  fadings: Map<Square, Piece>;
}

export interface AnimationCurrent {
  start: number;
  frequency: number; // 1 / durationMs
  plan: AnimationPlan;
}

// ── Extensibility: Custom Animation Events ─────────────────────────

export interface AnimationEvent {
  type: 'check' | 'checkmate' | 'capture' | 'promotion' | 'castle' | string;
  square?: string;
  pieces?: string[];
}

// ── Extensibility: Text Overlay ────────────────────────────────────

export interface TextOverlay {
  id: string;
  text: string;
  square?: string;
  position?: { x: number; y: number };
  duration?: number;
  className?: string;
  style?: CSSProperties;
}

// ── Promotion ──────────────────────────────────────────────────────

export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

export interface PromotionContext {
  from: string;
  to: string;
  color: PieceColor;
}

// ── Piece Renderer ─────────────────────────────────────────────────

export type PieceRenderer = Record<string, () => ReactNode>;

// ── Board Props ────────────────────────────────────────────────────

export interface ChessiroCanvasProps {
  // Core
  position?: string; // FEN string
  orientation?: Orientation;
  interactive?: boolean;
  turnColor?: PieceColor; // whose turn it is ('w' or 'b'); needed for premoves
  movableColor?: PieceColor | 'both'; // which color(s) the user can move; defaults to turnColor

  // Move handling
  onMove?: (from: string, to: string, promotion?: PromotionPiece) => boolean;
  lastMove?: { from: string; to: string } | null;
  dests?: Dests; // legal move destinations (if not provided, all moves allowed when interactive)

  // Premoves
  premovable?: PremoveConfig;

  // Arrows
  arrows?: Arrow[];
  onArrowsChange?: (arrows: Arrow[]) => void;
  arrowBrushes?: Partial<ArrowBrushes>; // override default brush colors
  snapArrowsToValidMoves?: boolean; // snap drawn arrows to queen/knight directions (default: true)

  // Marks (right-click square marking)
  markedSquares?: string[];
  onMarkedSquaresChange?: (squares: string[]) => void;

  // Ply-based arrow/mark storage
  plyIndex?: number;
  plyArrows?: Map<number, Arrow[]>;
  onPlyArrowsChange?: (plyIndex: number, arrows: Arrow[]) => void;
  plyMarks?: Map<number, string[]>;
  onPlyMarksChange?: (plyIndex: number, marks: string[]) => void;

  // Visual
  theme?: BoardTheme;
  pieceSet?: PieceSet;
  showMargin?: boolean;
  marginThickness?: number;
  showNotation?: boolean;
  highlightedSquares?: Record<string, string>; // square → color
  squareVisuals?: Partial<SquareVisuals>;
  check?: string | null; // square of the king in check (e.g. 'e1')
  moveQualityBadge?: MoveQualityBadge | null;

  // Behavior
  allowDragging?: boolean;
  allowDrawingArrows?: boolean;
  animationDurationMs?: number;
  showAnimations?: boolean;
  blockTouchScroll?: boolean; // prevent scrolling when touching the board (default: false)

  // Keyboard nav callbacks
  onPrevious?: () => void;
  onNext?: () => void;
  onFirst?: () => void;
  onLast?: () => void;
  onFlipBoard?: () => void;
  onShowThreat?: () => void;
  onDeselect?: () => void;

  // Events
  onSquareClick?: (square: string) => void;
  onClearOverlays?: () => void;

  // Extensibility
  onAnimationEvent?: (event: AnimationEvent) => void;
  overlays?: TextOverlay[];
  overlayRenderer?: (overlay: TextOverlay) => ReactNode;

  // Custom piece rendering
  pieces?: PieceRenderer;

  // Styling
  className?: string;
  style?: CSSProperties;
}

// ── Imperative API ─────────────────────────────────────────────────

export interface ChessiroCanvasRef {
  getSquareRect: (square: string) => DOMRect | null;
  getBoardRect: () => DOMRect | null;
}
