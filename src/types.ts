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
  current?: [string, string] | null;  // controlled premove [from, to]; null/undefined clears when present
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

  // ── Knight moves ──
  /**
   * How to draw an arrow whose start/end form a knight's move (a 1×2 / 2×1 leap).
   * 'l-shaped' bends the shaft into an L — the 2-square leg first, then a right-angle
   * turn into the 1-square leg toward the target, like lichess. 'straight' draws a
   * direct line. Default: 'l-shaped'.
   */
  knightArrowShape?: 'l-shaped' | 'straight';

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

// ── Teaching helpers ───────────────────────────────────────────────

/**
 * A translucent hint piece rendered on a square without touching the real
 * position. Useful for lessons: "your knight belongs here".
 */
export interface GhostPiece {
  square: string;
  /** Piece key like 'wN', 'bQ'. */
  piece: string;
  /** Opacity of the ghost. Default: 0.45. */
  opacity?: number;
  /** Scale of the ghost piece within its square. Default: 1. */
  scale?: number;
}

export interface AnimateMoveOptions {
  /** Total demonstration duration in ms. Default: 900 (slow, teaching pace). */
  durationMs?: number;
  /**
   * Animate a translucent copy and leave the real position untouched
   * (the copy fades out at the destination). Default: false.
   */
  ghost?: boolean;
  /**
   * Hide the real piece on the origin square while the demo piece glides
   * (only when not a ghost). Default: true.
   */
  hideOriginal?: boolean;
  /** Scale applied while the piece is "picked up". Default: 1.18. */
  liftScale?: number;
  /** Piece key like 'wQ' to animate when the origin square is empty. */
  piece?: string;
}

export interface PulseSquareOptions {
  /** Ring color. Default: 'rgba(255, 188, 66, 0.95)'. */
  color?: string;
  /** Duration of one pulse in ms. Default: 700. */
  durationMs?: number;
  /** Number of pulses. Default: 2. */
  times?: number;
}

/**
 * A small text badge rendered on a square (attacker counts, move numbers,
 * "!" / "?" annotations, candidate-move letters, ...).
 */
export interface SquareLabel {
  text: string;
  color?: string;
  background?: string;
  fontSize?: string | number;
  /** Where inside the square to place the badge. Default: 'topRight'. */
  corner?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center';
}

// ── Cinematic effects ──────────────────────────────────────────────

/** Preset choreography for `cinematicMove`. */
export type CinematicStyle = 'brilliant' | 'great' | 'smooth' | 'slam' | 'meteor';

export interface CinematicMoveOptions {
  /** Choreography preset. Default: 'brilliant'. */
  style?: CinematicStyle;
  /** Total duration in ms. Default depends on style (brilliant: 2000). */
  durationMs?: number;
  /** Full rotateY turns during flight. Default depends on style. */
  spins?: number;
  /** Vertical arc peak in squares. Default depends on style. */
  arcHeight?: number;
  /** Scale applied while the piece is airborne. Default depends on style. */
  liftScale?: number;
  /** Glow color for the in-flight drop-shadow. Default depends on style. */
  glowColor?: string;
  /** Sparkle burst on landing. Default depends on style. */
  sparkles?: boolean;
  /** Expanding shockwave ring on landing. Default depends on style. */
  shockwave?: boolean;
  /** Badge text popped at the destination on landing (e.g. '!!'). */
  badge?: string;
  /** Badge background color. Default: '#26c2a3'. */
  badgeColor?: string;
  /** Compress the end of the flight so the final approach plays in slow motion. */
  slowMoLanding?: boolean;
  /**
   * Ghost afterimages trailing the flying piece. true uses the style default
   * count; a number sets the copy count (0 disables). Default depends on
   * style (brilliant/meteor: 4, others: off).
   */
  trail?: boolean | number;
  /** Radial light flash across the board at the impact moment. Default depends on style. */
  flash?: boolean;
  /**
   * When the destination square holds a piece, blast it away at the impact
   * moment (capture explosion). Default: true for brilliant/slam/meteor.
   */
  victimBlast?: boolean;
  /**
   * Camera shake fired exactly at impact. true uses style defaults; pass
   * numbers to tune. Default: true for slam/meteor, false otherwise.
   */
  impactShake?: boolean | { intensity?: number; durationMs?: number };
  /**
   * Called at the exact impact moment (piece contacts the square) — wire
   * sound effects or haptics here.
   */
  onImpact?: () => void;
  /** Piece key like 'wQ' to animate when the origin square is empty. */
  piece?: string;
  /** Play the full choreography even when the user prefers reduced motion. */
  force?: boolean;
}

export interface CelebrateOptions {
  /** What to spawn. Default: 'both'. */
  kind?: 'confetti' | 'fireworks' | 'both';
  /** Overall duration in ms. Default: 2200. */
  durationMs?: number;
  /** Confetti / firework colors. Default: a festive palette. */
  colors?: string[];
  /** Play even when the user prefers reduced motion. */
  force?: boolean;
}

export interface PopBannerOptions {
  /** Banner text, e.g. 'BRILLIANT!!' or 'CHECKMATE'. */
  text: string;
  /** Text color. Default: '#ffffff'. */
  color?: string;
  /** Pill background. Default: none (glowing text only). */
  background?: string;
  /** Glow color behind the text. Default: '#26c2a3'. */
  glowColor?: string;
  /** Total duration in ms. Default: 1800. */
  durationMs?: number;
  /** Play even when the user prefers reduced motion. */
  force?: boolean;
}

export interface SquareBurstOptions {
  /** What to spawn. Default: 'both'. */
  kind?: 'sparkles' | 'shockwave' | 'both';
  /** Particle / ring color. Default: '#ffd65a'. */
  color?: string;
  /** Number of sparkle particles (clamped to 4..24). Default: 12. */
  particleCount?: number;
  /** Sparkle flight duration in ms. Default: 650. */
  durationMs?: number;
  /** Play even when the user prefers reduced motion. */
  force?: boolean;
}

export interface PopBadgeOptions {
  /** Badge text, e.g. '!!'. */
  text: string;
  /** Text color. Default: '#ffffff'. */
  color?: string;
  /** Badge background. Default: '#26c2a3'. */
  background?: string;
  /** Total lifetime (pop + hold + fade) in ms. Default: 1600. */
  durationMs?: number;
  /** Placement inside the square. Default: 'topRight'. */
  corner?: 'topRight' | 'center';
  /** Play even when the user prefers reduced motion. */
  force?: boolean;
}

export interface CameraZoomOptions {
  /** Zoom scale. Default: 1.6. */
  scale?: number;
  /** Duration in ms. Default: 600. */
  durationMs?: number;
  /** CSS easing. Default: a gentle ease-out. */
  easing?: string;
  /** Animate even when the user prefers reduced motion. */
  force?: boolean;
}

export interface CameraTiltOptions {
  /** 3D tilt around the X axis in degrees. Default: 18. */
  rotateX?: number;
  /** 3D tilt around the Y axis in degrees. Default: 0. */
  rotateY?: number;
  /** Duration in ms. Default: 600. */
  durationMs?: number;
  /** CSS easing. Default: a gentle ease-out. */
  easing?: string;
  /** Animate even when the user prefers reduced motion. */
  force?: boolean;
}

export interface CameraShakeOptions {
  /** Peak jitter in px. Default: 6. */
  intensity?: number;
  /** Duration in ms. Default: 400. */
  durationMs?: number;
  /** Animate even when the user prefers reduced motion. */
  force?: boolean;
}

export interface CameraDriftOptions {
  /** Peak Ken Burns scale. Default: 1.06. */
  scale?: number;
  /** One drift half-cycle in ms. Default: 6000. */
  durationMs?: number;
  /** Animate even when the user prefers reduced motion. */
  force?: boolean;
}

/**
 * WAAPI-driven "camera" that transforms the board root element.
 *
 * IMPORTANT: camera transforms change getBoundingClientRect, so
 * pointer-to-square math is wrong while zoomed/tilted — cinematics are meant
 * for non-interactive replay boards (`interactive={false}`). `reset()`
 * restores correctness. Board METRICS (square sizes, piece positions) are
 * unaffected because the board measures itself via offsetWidth/offsetHeight.
 */
export interface CameraController {
  /** Zoom toward a square (transform-origin at its center). */
  zoomTo: (square: Square, options?: CameraZoomOptions) => Promise<void>;
  /** Zoom back to identity scale. */
  zoomOut: (options?: CameraZoomOptions) => Promise<void>;
  /** Tilt the board in 3D (perspective + rotateX/rotateY). */
  tilt: (options?: CameraTiltOptions) => Promise<void>;
  /** Impact shake: decaying translate jitter. */
  shake: (options?: CameraShakeOptions) => Promise<void>;
  /** Slow Ken Burns wander. Runs until stopped. */
  drift: (options?: CameraDriftOptions) => { stop: () => void };
  /** Cancel all camera animations and clear transforms. */
  reset: () => void;
}

/** One step of a `playCinematic` script. */
export type CinematicStep =
  | { type: 'move'; from: Square; to: Square; options?: CinematicMoveOptions }
  | {
      type: 'camera';
      action: 'zoomTo' | 'zoomOut' | 'tilt' | 'shake' | 'reset';
      square?: Square;
      options?: Record<string, number | string>;
    }
  | { type: 'burst'; square: Square; options?: SquareBurstOptions }
  | { type: 'badge'; square: Square; options: PopBadgeOptions }
  | { type: 'celebrate'; options?: CelebrateOptions }
  | { type: 'banner'; options: PopBannerOptions }
  | { type: 'wait'; ms: number }
  /** Run children concurrently and await them all. */
  | { type: 'parallel'; steps: CinematicStep[] }
  /** App hook, e.g. commit the position after a 'move' step. */
  | { type: 'call'; fn: () => void | Promise<void> };

export interface PlayCinematicOptions {
  /** Play the full script even when the user prefers reduced motion. */
  force?: boolean;
}

export interface CinematicPlayback {
  /** Resolves when the script completes or is cancelled. */
  finished: Promise<void>;
  /** Stop mid-sequence: clears all cinematic effects and resets the camera. */
  cancel: () => void;
}

/** A move the student is expected to play in guided (drill) mode. */
export interface ExpectedMove {
  from: string;
  to: string;
  /** When set, only this promotion piece is accepted. */
  promotion?: PromotionPiece;
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
  /** Skip the promotion dialog and always promote to this piece (e.g. 'q'). */
  autoPromoteTo?: PromotionPiece;

  // Guided mode (drills / lessons)
  /**
   * When set, only the given move(s) are accepted; any other attempted move is
   * rejected, triggers `wrongMoveFeedback` and fires `onWrongMove`. Set to
   * null/undefined to disable.
   */
  expectedMove?: ExpectedMove | ExpectedMove[] | null;
  /** Called when the user attempts a move that doesn't match `expectedMove`. */
  onWrongMove?: (from: string, to: string) => void;
  /** Feedback when a wrong move is attempted in guided mode. Default: 'shake'. */
  wrongMoveFeedback?: 'shake' | 'none';

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
  /** Rotate piece artwork 180deg without changing board coordinates. Useful for pass-and-play. Default: false. */
  flipPieces?: boolean;
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
  /** Translucent hint pieces rendered under the real pieces (teaching aid). */
  ghostPieces?: GhostPiece[];
  /** Text badges on squares (attacker counts, annotations, move numbers). */
  squareLabels?: Record<string, string | SquareLabel>;

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
  /**
   * Board square under a viewport point (clientX/clientY), or null when the
   * point is outside the board. Enables external piece palettes: track your
   * own drag and resolve the drop square with this.
   */
  getSquareAtPoint: (clientX: number, clientY: number) => Square | null;
  /**
   * Demonstrate a move: slowly pick up the piece on `from`, glide it to `to`
   * and set it down. Resolves when the demonstration completes. Does not call
   * onMove — commit the move (update `position`) yourself when it resolves,
   * or pass `ghost: true` to animate a fading copy instead.
   */
  animateMove: (from: string, to: string, options?: AnimateMoveOptions) => Promise<void>;
  /** Draw attention to a square with a pulsing ring. */
  pulseSquare: (square: string, options?: PulseSquareOptions) => Promise<void>;
  /** Shake the piece on a square ("wrong move" feedback). */
  shakePiece: (square: string) => Promise<void>;
  /** Cancel all in-flight teaching effects (demos and pulses). */
  clearTeachingEffects: () => void;
  /**
   * Choreographed cinematic flight of the piece on `from` to `to` (spins,
   * arcs, glow, landing effects). Resolves after the landing effects finish.
   * Like `animateMove`, it does not call onMove — commit the move (update
   * `position`) yourself when it resolves. Meant for non-interactive replay
   * boards ("share game" screens).
   */
  cinematicMove: (from: Square, to: Square, options?: CinematicMoveOptions) => Promise<void>;
  /** Sparkle burst and/or shockwave ring centered on a square. */
  squareBurst: (square: Square, options?: SquareBurstOptions) => Promise<void>;
  /** Pop an annotation badge ('!!', '?', ...) on a square. */
  popBadge: (square: Square, options: PopBadgeOptions) => Promise<void>;
  /** Board-wide celebration: confetti rain and/or firework bursts. */
  celebrate: (options?: CelebrateOptions) => Promise<void>;
  /** Big glowing text banner across the board ('BRILLIANT!!', 'CHECKMATE'). */
  popBanner: (options: PopBannerOptions) => Promise<void>;
  /**
   * Cancel the running cinematic script and every cinematic effect: WAAPI
   * animations are cancelled, hidden pieces restored, overlay nodes
   * unmounted and the camera reset.
   */
  clearCinematics: () => void;
  /**
   * Run a cinematic script (moves, camera work, bursts, badges, waits).
   * Starting a new script cancels the previous one.
   */
  playCinematic: (steps: CinematicStep[], options?: PlayCinematicOptions) => CinematicPlayback;
  /** Cinematic camera: zoom, tilt, shake and drift the whole board. */
  camera: CameraController;
}
