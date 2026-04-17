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
  /** Visual style for the currently-queued premove from/to squares. Default: 'fill'. */
  premoveCurrentStyle?: 'fill' | 'dashed' | 'both';
  /** Border width (px) when `premoveCurrentStyle` is 'dashed' or 'both'. Default: 3. */
  premoveCurrentBorderWidth?: number;
  /** Border color for the dashed box. Defaults to `premoveCurrent` when undefined. */
  premoveCurrentBorderColor?: string;
  checkGradient?: string;

  // Selected piece style
  /** How to highlight the selected piece square: background color only, border only, or both. Default: 'fill' */
  selectedStyle?: 'fill' | 'border' | 'both';
  /** Border width in px when selectedStyle includes a border. Default: 4 */
  selectedBorderWidth?: number;

  // Legal move indicator style
  /** Legal move indicator: filled 'dot' or hollow 'ring'. Default: 'ring' */
  legalMoveStyle?: 'dot' | 'ring';
  /** Outer radius of the hollow ring as % of square size. Default: 24 */
  legalRingOuterRadius?: number;
  /** Inner radius of the hollow ring as % of square size. Default: 17 */
  legalRingInnerRadius?: number;
  /** Inset border width in px for capture-move rings. Default: 3 */
  legalCaptureRingWidth?: number;
  /** Shape for capture-move rings (applies to both legal and premove captures). Default: 'square' */
  legalCaptureRingShape?: 'circle' | 'square';
  /** Corner radius (% of square size) when `legalCaptureRingShape` is 'square'. Default: 14 */
  legalCaptureRingCornerRadius?: number;

  // Drag hover
  /** Color overlay for the square the piece is hovering over during drag. Default: selectedPiece color at 0.3 opacity */
  dragOverHighlight?: string;
}

export type ArrowHeadShape = 'classic' | 'open' | 'concave' | 'diamond';

export interface ArrowVisuals {
  // ── Geometry ──
  /** Stroke width in board-units (1 = one square). Default: 0.086 (~5.5/64). */
  lineWidth?: number;
  /** Line + arrowhead opacity. Default: 0.85. */
  opacity?: number;
  /** Distance to pull back the arrow TIP from the target square center. Board-units. Default: 0.18. */
  margin?: number;
  /** Distance to pull the arrow SHAFT forward from the source square center (gap at origin). Board-units. Default: 0. */
  startOffset?: number;
  /** Arrowhead length along the arrow direction (marker units; scales with lineWidth). Default: 3.2. */
  headLength?: number;
  /** Arrowhead width perpendicular to arrow direction (marker units). Default: 3.5. */
  headWidth?: number;

  // ── Line style ──
  /** Stroke cap for the shaft ends. Default: 'round'. */
  lineCap?: 'round' | 'butt' | 'square';
  /** Stroke join for the arrowhead corners. Default: 'miter'. */
  lineJoin?: 'round' | 'miter' | 'bevel';
  /** SVG dash pattern for the shaft, e.g. '0.22 0.16'. Default: undefined (solid). */
  dashArray?: string;
  /** SVG dash offset, advances the dash pattern start. Default: 0. */
  dashOffset?: number;
  /** @deprecated alias for dashArray. */
  dash?: string;

  // ── Head style ──
  /** Arrowhead shape. Default: 'classic'. */
  headShape?: ArrowHeadShape;
  /**
   * Morphs the arrowhead from a sharp triangle (0) toward a fully rounded bullet/circle shape (1).
   * The two slanted edges transition from straight lines into quarter-ellipse arcs; the base edge
   * where the shaft meets stays perfectly straight and untouched. Default: 0 (sharp).
   */
  headCornerRadius?: number;

  // ── Outline (optional, rendered only when outlineWidth > 0) ──
  /** Outline color painted behind the shaft and around the arrowhead. Default: rgba(0,0,0,0.45). */
  outlineColor?: string;
  /** Outline thickness in board-units. 0 disables outline rendering. Default: 0. */
  outlineWidth?: number;

  // ── Deprecated legacy marker knobs (still honored) ──
  /** @deprecated Use headLength. */
  markerWidth?: number;
  /** @deprecated Use headWidth. */
  markerHeight?: number;
  /** @deprecated Computed from shape. */
  markerRefX?: number;
  /** @deprecated Computed from headWidth. */
  markerRefY?: number;
}

export interface NotationVisuals {
  fontFamily?: string;
  fontSize?: string | number;
  fontWeight?: number | string;
  /** Single color for all notation (margin mode). Overrides per-square colors in on-board mode. */
  color?: string;
  /** Color for notation rendered on light squares (on-board mode only). Defaults to theme.darkSquare. */
  onLightSquareColor?: string;
  /** Color for notation rendered on dark squares (on-board mode only). Defaults to theme.lightSquare. */
  onDarkSquareColor?: string;
  opacity?: number;
  onBoardFontSize?: string | number;
  onBoardLeftOffset?: string | number;
  onBoardBottomOffset?: string | number;
}

export interface PromotionVisuals {
  backdropColor?: string;
  panelColor?: string;
  panelBorderColor?: string;
  panelShadow?: string;
  panelRadius?: string;
  titleColor?: string;
  optionBackground?: string;
  optionBorderColor?: string;
  optionTextColor?: string;
  optionRadius?: string;
  cancelTextColor?: string;
}

export interface OverlayVisuals {
  background?: string;
  color?: string;
  borderRadius?: string;
  fontSize?: string;
  fontWeight?: number | string;
  padding?: string;
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
  marginRadius?: string | number;
  boardRadius?: string | number;
  showNotation?: boolean;
  highlightedSquares?: Record<string, string>; // square → color
  squareVisuals?: Partial<SquareVisuals>;
  arrowVisuals?: Partial<ArrowVisuals>;
  notationVisuals?: Partial<NotationVisuals>;
  promotionVisuals?: Partial<PromotionVisuals>;
  overlayVisuals?: Partial<OverlayVisuals>;
  check?: string | null; // square of the king in check (e.g. 'e1')
  moveQualityBadge?: MoveQualityBadge | null;

  // Behavior
  allowDragging?: boolean;
  allowDrawingArrows?: boolean;
  animationDurationMs?: number;
  showAnimations?: boolean;
  blockTouchScroll?: boolean; // prevent scrolling when touching the board (default: false)
  selectedPieceScale?: number; // scale factor for the selected piece (e.g. 1.1 for 10% larger)
  /** Scale factor applied to the piece while dragging with a mouse. Default: 1. */
  dragScale?: number;
  /** Scale factor applied to the piece while dragging via touch (chessground-style lift). Default: 1.9. */
  touchDragScale?: number;
  /** Vertical offset (in squares) applied to the piece while dragging with a mouse. Default: 0. */
  dragLiftSquares?: number;
  /** Vertical offset (in squares) applied to the piece while dragging via touch so it floats above the finger. Default: 0.6. */
  touchDragLiftSquares?: number;

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
