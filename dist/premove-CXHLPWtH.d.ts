import { CSSProperties, ReactNode } from 'react';

type EasingFunction = (t: number) => number;
type EasingName = 'linear' | 'ease' | 'easeIn' | 'easeOut' | 'easeInOut' | 'snappy' | 'smooth' | 'backOut' | 'spring' | 'bounce' | 'elastic' | 'anticipate';
/**
 * Build an easing function from CSS cubic-bezier control points
 * (Newton–Raphson with a bisection fallback, like browsers do).
 */
declare function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFunction;
declare const EASINGS: Readonly<Record<EasingName, EasingFunction>>;
declare function resolveEasing(easing: EasingName | EasingFunction | undefined, fallback: EasingFunction): EasingFunction;
/** How a captured piece leaves the board. */
type CaptureAnimation = 'fade' | 'shrink' | 'poof' | 'knockout' | 'sink' | 'none';
/** Flourish played when a moving piece arrives. */
type LandingAnimation = 'none' | 'squash' | 'bounce' | 'settle';
/** How a piece with no origin (setup, new game, promotion) enters. */
type AppearAnimation = 'none' | 'fade' | 'pop' | 'drop' | 'rise';
/** What happens to the pieces when `orientation` changes. */
type FlipAnimation = 'none' | 'rotate' | 'fade';
type MoveAnimationPreset = 'classic' | 'snappy' | 'smooth' | 'playful' | 'arcade' | 'elegant' | 'minimal' | 'none';
interface MoveAnimationOptions {
    /**
     * Start from a named preset and override individual knobs below.
     * Default: 'classic' (the board's original slide).
     */
    preset?: MoveAnimationPreset;
    /** Base travel time in ms for a ~2 square move. Default: `animationDurationMs` (200). */
    durationMs?: number;
    /**
     * 0 = every move takes `durationMs`. 1 = long moves take noticeably longer
     * than short ones (duration grows with the square root of the distance,
     * clamped to 0.65x–1.6x). Values in between blend. Default: preset.
     */
    distanceScaling?: number;
    /** Travel easing: a named curve or any `(t) => number` function. Default: preset. */
    easing?: EasingName | EasingFunction;
    /** Height of the travel arc in squares (0 = flat slide). Default: preset. */
    arc?: number;
    /** Arc height for knight jumps — a knight "hops" over pieces. Default: preset. */
    knightArc?: number;
    /** Scale reached mid-flight, as if the piece were picked up. 1 = none. Default: preset. */
    liftScale?: number;
    /** How captured pieces leave. Default: preset. */
    capture?: CaptureAnimation;
    /** Flourish when a piece lands. Default: preset. */
    landing?: LandingAnimation;
    /** Entrance for pieces that appear from nowhere. Default: preset. */
    appear?: AppearAnimation;
    /**
     * Board flip: 'rotate' spins the pieces a half-turn around the board centre
     * like a turntable (they stay upright); 'fade' cross-fades. Default: preset.
     */
    flip?: FlipAnimation;
    /**
     * Delay in ms between successive pieces when many move at once (new game,
     * position jumps). Reads as a cascade. Default: preset.
     */
    stagger?: number;
    /** Animate a rejected drag-drop back to its square instead of teleporting. Default: true. */
    snapBack?: boolean;
    /**
     * Honour the OS "reduce motion" setting by falling back to the 'minimal'
     * preset (a short, flat slide). Default: true.
     */
    respectReducedMotion?: boolean;
}
/** Fully-resolved motion settings — every knob concrete. */
interface ResolvedMoveAnimation {
    enabled: boolean;
    durationMs: number;
    distanceScaling: number;
    easing: EasingFunction;
    /** True when the easing leaves [0, 1] (spring, back, elastic) — needs more samples. */
    overshoots: boolean;
    arc: number;
    knightArc: number;
    liftScale: number;
    capture: CaptureAnimation;
    landing: LandingAnimation;
    appear: AppearAnimation;
    flip: FlipAnimation;
    stagger: number;
    snapBack: boolean;
}
type PresetValues = Omit<ResolvedMoveAnimation, 'enabled' | 'durationMs' | 'easing' | 'overshoots' | 'snapBack'> & {
    easing: EasingName;
    /** Multiplier on the caller's base duration. */
    durationScale: number;
};
declare const MOVE_ANIMATION_PRESETS: Readonly<Record<Exclude<MoveAnimationPreset, 'none'>, Readonly<PresetValues>>>;
interface ResolveMoveAnimationContext {
    /** Base duration when `options.durationMs` is unset (the `animationDurationMs` prop). */
    baseDurationMs?: number;
    /** Master switch (the `showAnimations` prop). */
    enabled?: boolean;
    /** Current OS reduce-motion preference. */
    reducedMotion?: boolean;
}
/** Merge a preset, user overrides and environment into concrete settings. */
declare function resolveMoveAnimation(options: MoveAnimationOptions | MoveAnimationPreset | undefined, ctx?: ResolveMoveAnimationContext): ResolvedMoveAnimation;
/**
 * One sampled pose. `x`/`y` are the piece's top-left in squares (column,
 * row in screen orientation); scale/rotate apply about the piece centre.
 */
interface MotionKeyframe {
    offset: number;
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    /** Degrees. */
    rotate: number;
    opacity: number;
}
interface MotionTrack {
    /** Wait before the track starts, in ms. */
    delayMs: number;
    /** Track length excluding delay, in ms. */
    durationMs: number;
    /** Sampled poses; interpolate linearly between them. */
    frames: MotionKeyframe[];
}
type BoardPoint = readonly [x: number, y: number];
/** Travel time for a move of `distance` squares under the given settings. */
declare function moveDurationMs(distance: number, m: Pick<ResolvedMoveAnimation, 'durationMs' | 'distanceScaling'>): number;
/**
 * Just the landing flourish at `at` — for a piece that arrived by other
 * means (a drag-and-drop) but should still land with character.
 */
declare function planLandingTrack(at: BoardPoint, m: ResolvedMoveAnimation): MotionTrack | null;
/**
 * Sample a piece's journey from `from` to `to` (board points, squares).
 * Includes the lift, arc and landing flourish.
 */
declare function planMoveTrack(from: BoardPoint, to: BoardPoint, m: ResolvedMoveAnimation, opts?: {
    delayMs?: number; /** Force a knight hop even if the geometry isn't one. */
    knight?: boolean;
}): MotionTrack;
/**
 * Sample the exit of a captured piece standing on `at`. `push` is the
 * attacker's travel direction (squares) — 'knockout' flings the victim along it.
 * The capture waits for the attacker to arrive (`arriveMs`).
 */
declare function planCaptureTrack(at: BoardPoint, m: ResolvedMoveAnimation, opts?: {
    arriveMs?: number;
    push?: BoardPoint;
}): MotionTrack | null;
/** Sample the entrance of a piece that appears on `at` without an origin. */
declare function planAppearTrack(at: BoardPoint, m: ResolvedMoveAnimation, delayMs?: number): MotionTrack | null;
/**
 * Sample a rejected drop gliding back home. `from` is where the piece was
 * released (squares, fractional).
 */
declare function planSnapBackTrack(from: BoardPoint, home: BoardPoint): MotionTrack;
/** A whole-board fade used by the 'fade' flip: out, swap, in. */
declare function planFlipFadeTrack(at: BoardPoint, durationMs: number): MotionTrack;
/** Pose of a track at elapsed time `ms` (after its delay). Used to retarget interrupted flights. */
declare function sampleTrack(track: MotionTrack, ms: number): MotionKeyframe;
/** Order in which a cascade plays: nearest the viewer's side first, left to right. */
declare function staggerRank(x: number, y: number): number;

type PieceCode = 'wp' | 'wn' | 'wb' | 'wr' | 'wq' | 'wk' | 'bp' | 'bn' | 'bb' | 'br' | 'bq' | 'bk';
declare const DEFAULT_BOARD_THEME: BoardTheme;
interface BoardSvgOptions {
    /** FEN (only the placement field is read). Default: the initial position. */
    position?: string;
    orientation?: Orientation;
    /** Rendered width/height in px. Default: 512. */
    size?: number;
    theme?: Partial<BoardTheme>;
    /** Draw the frame around the board. Default: true. */
    showMargin?: boolean;
    /** Frame thickness as a fraction of one square. Default: 0.375 (24px on a 512px board). */
    marginSquares?: number;
    /** Frame corner radius in px. Default: 4. */
    marginRadius?: number;
    /** File/rank labels: on the frame when shown, otherwise inside the edge squares. Default: true. */
    showCoordinates?: boolean;
    /** Coordinate font. Default: a system sans-serif stack. */
    fontFamily?: string;
    lastMove?: {
        from: string;
        to: string;
    } | null;
    /** Opacity of the last-move highlight. Default: 0.5. */
    lastMoveOpacity?: number;
    /** King square in check — painted with a red radial glow. */
    check?: string | null;
    /** Square → CSS color fills (painted under the pieces). */
    highlightedSquares?: Record<string, string>;
    /** Right-click style marks (translucent red fill). */
    markedSquares?: string[];
    arrows?: Arrow[];
    arrowBrushes?: Partial<ArrowBrushes>;
    /** Arrow opacity. Default: 0.85. */
    arrowOpacity?: number;
    /** Draw knight arrows as an L like the live board. Default: true. */
    knightArrowsLShaped?: boolean;
    /**
     * Raw SVG markup per piece (e.g. `{ wk: '<svg …>…</svg>' }`). Missing codes
     * fall back to the built-in set. Inlined, so the output is self-contained.
     */
    pieceSvgs?: Partial<Record<PieceCode, string>>;
    /**
     * Image URL per piece. Used by reference (`<image href>`), so the SVG is not
     * self-contained — prefer `pieceSvgs` when rasterising.
     */
    pieceUrls?: Partial<Record<PieceCode, string>>;
    /** Rotate piece artwork 180° (pass-and-play). Default: false. */
    flipPieces?: boolean;
    /** Prefix for internal ids, to keep several inline SVGs on one page apart. Default: 'cc'. */
    idPrefix?: string;
    /** Accessible title. Default: a description of the side to view. */
    title?: string;
    /** Background behind a rounded frame (e.g. a card color). Default: transparent. */
    background?: string;
}
/**
 * Render a board position to a standalone SVG string.
 *
 * ```ts
 * import { renderBoardSvg } from 'chessiro-canvas/core';
 * const svg = renderBoardSvg({ position: fen, lastMove: { from: 'e2', to: 'e4' }, size: 1200 });
 * ```
 */
declare function renderBoardSvg(options?: BoardSvgOptions): string;

type File = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';
type Rank = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
type Square = `${File}${Rank}`;
declare const FILES: readonly File[];
declare const RANKS: readonly Rank[];
type PieceColor = 'w' | 'b';
type PieceRole = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
interface Piece {
    color: PieceColor;
    role: PieceRole;
}
type Pieces = Map<Square, Piece>;
type Orientation = 'white' | 'black';
type ArrowBrush = 'green' | 'red' | 'blue' | 'yellow';
interface Arrow {
    startSquare: string;
    endSquare: string;
    color: string;
    brush?: ArrowBrush;
    /**
     * Optional stable identity used for enter/exit fade tracking.
     * Defaults to `${startSquare}-${endSquare}-${color}`.
     * Prefer setting this when the same geometric arrow can reappear
     * (e.g. staggered checkmate sequences).
     */
    id?: string;
    /**
     * Per-arrow fade-in duration in ms when this arrow is added.
     * Overrides `arrowVisuals.fadeInMs`. `0` = instant appear.
     */
    fadeInMs?: number;
    /**
     * Per-arrow fade-out duration in ms when this arrow is removed
     * from the controlled `arrows` array. Overrides `arrowVisuals.fadeOutMs`.
     * `0` = instant remove.
     */
    fadeOutMs?: number;
}
interface ArrowBrushes {
    green: string;
    red: string;
    blue: string;
    yellow: string;
}
declare const DEFAULT_ARROW_BRUSHES: ArrowBrushes;
interface PremoveConfig {
    enabled: boolean;
    showDests?: boolean;
    current?: [string, string] | null;
    events?: {
        set?: (from: string, to: string) => void;
        unset?: () => void;
    };
}
type Dests = Map<Square, Square[]>;
interface BoardTheme {
    id: string;
    name: string;
    darkSquare: string;
    lightSquare: string;
    margin?: string;
    lastMoveHighlight?: string;
    selectedPiece?: string;
}
interface SquareVisuals {
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
    /** How to highlight the selected piece square: background color only, border only, or both. Default: 'fill' */
    selectedStyle?: 'fill' | 'border' | 'both';
    /** Border width in px when selectedStyle includes a border. Default: 4 */
    selectedBorderWidth?: number;
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
    /** Color overlay for the square the piece is hovering over during drag. Default: selectedPiece color at 0.3 opacity */
    dragOverHighlight?: string;
}
type ArrowHeadShape = 'classic' | 'open' | 'concave' | 'diamond';
interface ArrowVisuals {
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
    /** Arrowhead shape. Default: 'classic'. */
    headShape?: ArrowHeadShape;
    /**
     * Morphs the arrowhead from a sharp triangle (0) toward a fully rounded bullet/circle shape (1).
     * The two slanted edges transition from straight lines into quarter-ellipse arcs; the base edge
     * where the shaft meets stays perfectly straight and untouched. Default: 0 (sharp).
     */
    headCornerRadius?: number;
    /**
     * How to draw an arrow whose start/end form a knight's move (a 1×2 / 2×1 leap).
     * 'l-shaped' bends the shaft into an L — the 2-square leg first, then a right-angle
     * turn into the 1-square leg toward the target, like lichess. 'straight' draws a
     * direct line. Default: 'l-shaped'.
     */
    knightArrowShape?: 'l-shaped' | 'straight';
    /** Outline color painted behind the shaft and around the arrowhead. Default: rgba(0,0,0,0.45). */
    outlineColor?: string;
    /** Outline thickness in board-units. 0 disables outline rendering. Default: 0. */
    outlineWidth?: number;
    /**
     * Default fade-in duration (ms) for newly appearing arrows.
     * Overridden by each arrow's `fadeInMs`. Default: `0` (instant).
     */
    fadeInMs?: number;
    /**
     * Default fade-out duration (ms) for arrows removed from the controlled list.
     * Removed arrows stay rendered until the fade finishes.
     * Overridden by each arrow's `fadeOutMs`. Default: `0` (instant).
     */
    fadeOutMs?: number;
    /** @deprecated Use headLength. */
    markerWidth?: number;
    /** @deprecated Use headWidth. */
    markerHeight?: number;
    /** @deprecated Computed from shape. */
    markerRefX?: number;
    /** @deprecated Computed from headWidth. */
    markerRefY?: number;
}
interface NotationVisuals {
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
interface PromotionVisuals {
    backdropColor?: string;
    panelColor?: string;
    panelBorderColor?: string;
    panelShadow?: string;
    panelRadius?: string;
    titleColor?: string;
    optionBackground?: string;
    optionHoverBackground?: string;
    optionBorderColor?: string;
    optionTextColor?: string;
    optionRadius?: string;
    cancelTextColor?: string;
}
interface OverlayVisuals {
    background?: string;
    color?: string;
    borderRadius?: string;
    fontSize?: string;
    fontWeight?: number | string;
    padding?: string;
}
interface PieceSet {
    id: string;
    name: string;
    path: string;
}
interface MoveQualityBadge {
    square: Square;
    icon: string;
    label?: string;
}
interface AnimationEvent {
    type: 'check' | 'checkmate' | 'capture' | 'promotion' | 'castle' | string;
    square?: string;
    pieces?: string[];
}
interface TextOverlay {
    id: string;
    text: string;
    square?: string;
    position?: {
        x: number;
        y: number;
    };
    duration?: number;
    className?: string;
    style?: CSSProperties;
}
/**
 * A translucent hint piece rendered on a square without touching the real
 * position. Useful for lessons: "your knight belongs here".
 */
interface GhostPiece {
    square: string;
    /** Piece key like 'wN', 'bQ'. */
    piece: string;
    /** Opacity of the ghost. Default: 0.45. */
    opacity?: number;
    /** Scale of the ghost piece within its square. Default: 1. */
    scale?: number;
}
interface AnimateMoveOptions {
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
interface PulseSquareOptions {
    /** Ring color. Default: 'rgba(255, 188, 66, 0.95)'. */
    color?: string;
    /** Duration of one pulse in ms. Default: 700. */
    durationMs?: number;
    /** Number of pulses. Default: 2. */
    times?: number;
}
/**
 * Lean a single piece over — the resign/checkmate gesture, but as a plain
 * transform you control (angle, speed, direction) rather than a scripted
 * cinematic. The piece rotates about its own centre, so it leans in place
 * instead of swinging off its bottom edge. See `ref.tiltPiece`.
 */
interface PieceTiltOptions {
    /**
     * Angle in degrees. Positive leans toward `direction`, negative leans the
     * other way. 90 lays the piece on its side. Default: 84 (a toppled king).
     */
    angle?: number;
    /**
     * Which way the piece leans. 'auto' tips it away from the board centre.
     * Default: 'right'.
     */
    direction?: 'left' | 'right' | 'auto';
    /**
     * How long the tilt takes in ms — this is the speed knob, lower is faster.
     * 0 snaps to the angle instantly. Default: 600.
     */
    durationMs?: number;
    /**
     * Keep the angle when the animation ends: the piece stays down until
     * `resetPieceTilt` (or `clearTeachingEffects`). Set false to lean over and
     * spring back upright within `durationMs`. Default: true.
     */
    hold?: boolean;
    /**
     * Stay at the angle for this many ms, then stand back up on its own. The
     * whole gesture takes `durationMs + holdMs + durationMs` (lean, wait, return)
     * and the returned promise resolves when the piece is upright again.
     *
     * Setting this overrides `hold`, since it already says how long the tilt is
     * held. Default: undefined (`hold` decides).
     */
    holdMs?: number;
    /** CSS easing for the tilt. Default: 'cubic-bezier(0.34, 0.02, 0.62, 1)'. */
    easing?: string;
    /**
     * Pivot point as a CSS transform-origin. Default: '50% 50%' — the centre of
     * the piece. Pass '50% 92%' to tip it over on its base instead.
     */
    pivot?: string;
    /** Play even when the user prefers reduced motion (the angle is applied either way). */
    force?: boolean;
}
/**
 * A small text badge rendered on a square (attacker counts, move numbers,
 * "!" / "?" annotations, candidate-move letters, ...).
 */
interface SquareLabel {
    text: string;
    color?: string;
    background?: string;
    fontSize?: string | number;
    /** Where inside the square to place the badge. Default: 'topRight'. */
    corner?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center';
}
/** Preset choreography for `cinematicMove`. */
type CinematicStyle = 'brilliant' | 'great' | 'smooth' | 'slam' | 'meteor';
interface CinematicMoveOptions {
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
    impactShake?: boolean | {
        intensity?: number;
        durationMs?: number;
    };
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
interface PromotionBeamOptions {
    /** Final piece revealed (e.g. 'wQ'). When omitted the square's current piece stays. */
    piece?: string;
    /** Piece shown before the morph. Defaults to the piece currently on the square. */
    fromPiece?: string;
    /** Beam / glow color. Default: '#ffe27a' (gold). */
    color?: string;
    /** Total duration in ms. Default: 1500. */
    durationMs?: number;
    /** Play even when the user prefers reduced motion. */
    force?: boolean;
}
interface ImplodeOptions {
    /** Piece to implode. Defaults to the piece currently on the square. */
    piece?: string;
    /** Vortex / glow color. Default: '#b07bff' (violet). */
    color?: string;
    /** Total duration in ms. Default: 750. */
    durationMs?: number;
    /** Play even when the user prefers reduced motion. */
    force?: boolean;
}
interface CheckmateOptions {
    /** Piece that topples. Defaults to the piece currently on the square. */
    piece?: string;
    /** Which way the king falls. 'auto' tips it away from the board centre. Default: 'auto'. */
    direction?: 'left' | 'right' | 'auto';
    /** Total duration in ms. Default: 1600. */
    durationMs?: number;
    /** Dim the rest of the board while the king falls. Default: true. */
    dim?: boolean;
    /** Banner text shown as the king lands. Pass null to suppress it. Default: 'CHECKMATE'. */
    banner?: string | null;
    /** Accent colour for the banner glow and dust. Default: '#c0392b'. */
    color?: string;
    /** Play even when the user prefers reduced motion. */
    force?: boolean;
}
/** Where inside a square a label or annotation sits. */
type SquareCorner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center';
interface AnnotationOptions {
    /** Text colour. Default: '#ffffff'. */
    color?: string;
    /** Pill background. Default: 'rgba(17, 24, 39, 0.92)'. */
    background?: string;
    /** Placement inside the square. Default: 'center'. */
    corner?: SquareCorner;
    /** Font size, number in px or any CSS length. Default: scales with the square. */
    fontSize?: string | number;
    /** Auto-remove after this many ms. Omit to persist until cleared. */
    durationMs?: number;
    /** Entry animation. Default: 'pop'. */
    enter?: 'pop' | 'fade' | 'rise';
    /** Play the entry animation even when the user prefers reduced motion. */
    force?: boolean;
}
interface AnnotationHandle {
    /** Replace the text in place, without replaying the entry animation. */
    setText: (text: string) => void;
    /** Fade out and remove. Resolves once gone. */
    clear: (durationMs?: number) => Promise<void>;
}
interface CastleSwapOptions {
    /** Total duration in ms. Default: 1100. */
    durationMs?: number;
    /** Full rotateY turns each piece performs mid-swap. Default: 1. */
    spins?: number;
    /** Arc height in squares for the king lift (rook arcs lower). Default: 0.9. */
    arcHeight?: number;
    /** Glow color. Default: '#8fd0ff'. */
    glowColor?: string;
    /** Play even when the user prefers reduced motion. */
    force?: boolean;
}
interface SpotlightOptions {
    /** Dim overlay color. Default: 'rgba(3,7,15,0.74)'. */
    color?: string;
    /** Fade-in duration in ms. Default: 420. */
    durationMs?: number;
    /** Radius of each spotlight hole in squares. Default: 0.72. */
    radius?: number;
    /** Play even when the user prefers reduced motion. */
    force?: boolean;
}
interface SpotlightHandle {
    /** Fade the dim overlay out and remove it. Resolves when gone. */
    clear: (durationMs?: number) => Promise<void>;
}
interface LaserOptions {
    /** Beam color. Default: '#ff3b3b'. */
    color?: string;
    /** Glow color behind the beam. Default: matches color. */
    glowColor?: string;
    /** Draw duration in ms. Default: 500. */
    durationMs?: number;
    /** Beam thickness in px. Default: 4. */
    widthPx?: number;
    /** Keep the beam until clearCinematics instead of auto-fading. Default: false. */
    persist?: boolean;
    /** Hold time before auto-fade when not persisted, in ms. Default: 400. */
    holdMs?: number;
    /** Play even when the user prefers reduced motion. */
    force?: boolean;
}
interface DrawArrowOptions {
    /** Arrow color. Default: '#ff3b3b'. */
    color?: string;
    /** Glow color behind the arrow. Default: matches color. */
    glowColor?: string;
    /** Draw duration in ms. Default: 700. */
    durationMs?: number;
    /** Shaft thickness in px. Default: 4. */
    widthPx?: number;
    /** Arrowhead length in px. Default: 14. */
    headLengthPx?: number;
    /** Arrowhead width in px. Default: 12. */
    headWidthPx?: number;
    /** Keep the arrow until clearCinematics instead of auto-fading. Default: false. */
    persist?: boolean;
    /** Hold time before auto-fade when not persisted, in ms. Default: 400. */
    holdMs?: number;
    /** Play even when the user prefers reduced motion. */
    force?: boolean;
}
interface CelebrateOptions {
    /** What to spawn. Default: 'both'. */
    kind?: 'confetti' | 'fireworks' | 'both';
    /** Overall duration in ms. Default: 2200. */
    durationMs?: number;
    /** Confetti / firework colors. Default: a festive palette. */
    colors?: string[];
    /** Play even when the user prefers reduced motion. */
    force?: boolean;
}
interface PopBannerOptions {
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
interface SquareBurstOptions {
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
interface PopBadgeOptions {
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
interface CameraZoomOptions {
    /** Zoom scale. Default: 1.6. */
    scale?: number;
    /** Duration in ms. Default: 600. */
    durationMs?: number;
    /** CSS easing. Default: a gentle ease-out. */
    easing?: string;
    /** Animate even when the user prefers reduced motion. */
    force?: boolean;
}
interface CameraTiltOptions {
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
interface CameraShakeOptions {
    /** Peak jitter in px. Default: 6. */
    intensity?: number;
    /** Duration in ms. Default: 400. */
    durationMs?: number;
    /** Animate even when the user prefers reduced motion. */
    force?: boolean;
}
interface CameraDriftOptions {
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
interface CameraController {
    /** Zoom toward a square (transform-origin at its center). */
    zoomTo: (square: Square, options?: CameraZoomOptions) => Promise<void>;
    /** Zoom back to identity scale. */
    zoomOut: (options?: CameraZoomOptions) => Promise<void>;
    /** Tilt the board in 3D (perspective + rotateX/rotateY). */
    tilt: (options?: CameraTiltOptions) => Promise<void>;
    /** Impact shake: decaying translate jitter. */
    shake: (options?: CameraShakeOptions) => Promise<void>;
    /** Slow Ken Burns wander. Runs until stopped. */
    drift: (options?: CameraDriftOptions) => {
        stop: () => void;
    };
    /** Cancel all camera animations and clear transforms. */
    reset: () => void;
}
/** One step of a `playCinematic` script. */
type CinematicStep = {
    type: 'move';
    from: Square;
    to: Square;
    options?: CinematicMoveOptions;
} | {
    type: 'camera';
    action: 'zoomTo' | 'zoomOut' | 'tilt' | 'shake' | 'reset';
    square?: Square;
    options?: Record<string, number | string>;
} | {
    type: 'burst';
    square: Square;
    options?: SquareBurstOptions;
} | {
    type: 'badge';
    square: Square;
    options: PopBadgeOptions;
} | {
    type: 'celebrate';
    options?: CelebrateOptions;
} | {
    type: 'banner';
    options: PopBannerOptions;
} | {
    type: 'promotionBeam';
    square: Square;
    options?: PromotionBeamOptions;
} | {
    type: 'implode';
    square: Square;
    options?: ImplodeOptions;
} | {
    type: 'checkmate';
    square: Square;
    options?: CheckmateOptions;
} | {
    type: 'annotate';
    square: Square;
    text: string;
    options?: AnnotationOptions;
} | {
    type: 'castleSwap';
    kingFrom: Square;
    kingTo: Square;
    rookFrom: Square;
    rookTo: Square;
    options?: CastleSwapOptions;
} | {
    type: 'spotlight';
    squares: Square[];
    options?: SpotlightOptions;
} | {
    type: 'clearSpotlight';
} | {
    type: 'laser';
    from: Square;
    to: Square;
    options?: LaserOptions;
} | {
    type: 'drawArrow';
    from: Square;
    to: Square;
    options?: DrawArrowOptions;
} | {
    type: 'wait';
    ms: number;
}
/** Run children concurrently and await them all. */
 | {
    type: 'parallel';
    steps: CinematicStep[];
}
/** App hook, e.g. commit the position after a 'move' step. */
 | {
    type: 'call';
    fn: () => void | Promise<void>;
};
interface PlayCinematicOptions {
    /** Play the full script even when the user prefers reduced motion. */
    force?: boolean;
}
interface CinematicPlayback {
    /** Resolves when the script completes or is cancelled. */
    finished: Promise<void>;
    /** Stop mid-sequence: clears all cinematic effects and resets the camera. */
    cancel: () => void;
}
/** A move the student is expected to play in guided (drill) mode. */
interface ExpectedMove {
    from: string;
    to: string;
    /** When set, only this promotion piece is accepted. */
    promotion?: PromotionPiece;
}
type PromotionPiece = 'q' | 'r' | 'b' | 'n';
interface PromotionContext {
    from: string;
    to: string;
    color: PieceColor;
}
type PieceRenderer = Record<string, () => ReactNode>;
interface ChessiroCanvasProps {
    position?: string;
    orientation?: Orientation;
    interactive?: boolean;
    turnColor?: PieceColor;
    movableColor?: PieceColor | 'both';
    onMove?: (from: string, to: string, promotion?: PromotionPiece) => boolean;
    lastMove?: {
        from: string;
        to: string;
    } | null;
    dests?: Dests;
    /** Skip the promotion dialog and always promote to this piece (e.g. 'q'). */
    autoPromoteTo?: PromotionPiece;
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
    premovable?: PremoveConfig;
    arrows?: Arrow[];
    onArrowsChange?: (arrows: Arrow[]) => void;
    arrowBrushes?: Partial<ArrowBrushes>;
    snapArrowsToValidMoves?: boolean;
    markedSquares?: string[];
    onMarkedSquaresChange?: (squares: string[]) => void;
    plyIndex?: number;
    plyArrows?: Map<number, Arrow[]>;
    onPlyArrowsChange?: (plyIndex: number, arrows: Arrow[]) => void;
    plyMarks?: Map<number, string[]>;
    onPlyMarksChange?: (plyIndex: number, marks: string[]) => void;
    theme?: BoardTheme;
    pieceSet?: PieceSet;
    /** Rotate piece artwork 180deg without changing board coordinates. Useful for pass-and-play. Default: false. */
    flipPieces?: boolean;
    showMargin?: boolean;
    marginThickness?: number;
    marginRadius?: string | number;
    boardRadius?: string | number;
    showNotation?: boolean;
    highlightedSquares?: Record<string, string>;
    squareVisuals?: Partial<SquareVisuals>;
    arrowVisuals?: Partial<ArrowVisuals>;
    notationVisuals?: Partial<NotationVisuals>;
    promotionVisuals?: Partial<PromotionVisuals>;
    overlayVisuals?: Partial<OverlayVisuals>;
    check?: string | null;
    moveQualityBadge?: MoveQualityBadge | null;
    /** Translucent hint pieces rendered under the real pieces (teaching aid). */
    ghostPieces?: GhostPiece[];
    /** Text badges on squares (attacker counts, annotations, move numbers). */
    squareLabels?: Record<string, string | SquareLabel>;
    allowDragging?: boolean;
    allowDrawingArrows?: boolean;
    /** Base move animation time in ms. Default: 200. Presets scale this; `moveAnimation.durationMs` overrides it. */
    animationDurationMs?: number;
    /** Master switch for piece motion. Default: true. */
    showAnimations?: boolean;
    /**
     * How pieces move: a preset name ('classic' | 'snappy' | 'smooth' |
     * 'playful' | 'arcade' | 'elegant' | 'minimal' | 'none') or an options object
     * to tune easing, arcs, knight hops, lift, capture/landing/appear effects,
     * flip glides, cascades and drop snap-back. Motion runs on the compositor
     * via the Web Animations API. Default: 'classic'.
     */
    moveAnimation?: MoveAnimationOptions | MoveAnimationPreset;
    blockTouchScroll?: boolean;
    selectedPieceScale?: number;
    /** Scale factor applied to the piece while dragging with a mouse. Default: 1. */
    dragScale?: number;
    /** Scale factor applied to the piece while dragging via touch (chessground-style lift). Default: 1.9. */
    touchDragScale?: number;
    /** Vertical offset (in squares) applied to the piece while dragging with a mouse. Default: 0. */
    dragLiftSquares?: number;
    /** Vertical offset (in squares) applied to the piece while dragging via touch so it floats above the finger. Default: 0.6. */
    touchDragLiftSquares?: number;
    onPrevious?: () => void;
    onNext?: () => void;
    onFirst?: () => void;
    onLast?: () => void;
    onFlipBoard?: () => void;
    onShowThreat?: () => void;
    onDeselect?: () => void;
    onSquareClick?: (square: string) => void;
    onClearOverlays?: () => void;
    onAnimationEvent?: (event: AnimationEvent) => void;
    overlays?: TextOverlay[];
    overlayRenderer?: (overlay: TextOverlay) => ReactNode;
    pieces?: PieceRenderer;
    className?: string;
    style?: CSSProperties;
}
/** Rasterisation settings for `ref.toImage` / `svgToImageBlob`. */
interface RasterOptions {
    /** Output width/height in CSS px. Default: the SVG's own size. */
    size?: number;
    /** Device-pixel multiplier for crisp output on retina screens. Default: 2. */
    pixelRatio?: number;
    /** Image MIME type. Default: 'image/png'. */
    type?: 'image/png' | 'image/jpeg' | 'image/webp';
    /** Encoder quality for jpeg/webp (0..1). */
    quality?: number;
}
interface ChessiroCanvasRef {
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
    /**
     * Lean the piece on `square` over on its base by `angle` degrees over
     * `durationMs` — the "king falls over on checkmate" beat, with the angle,
     * speed and direction under your control. Holds the angle by default, so
     * repeated calls tilt further from wherever the piece currently leans.
     * Does not change the position; call it after committing the mating move.
     */
    tiltPiece: (square: string, options?: PieceTiltOptions) => Promise<void>;
    /**
     * Animate tilted pieces back upright. Omit `square` to reset every tilted
     * piece (e.g. when starting a new game).
     */
    resetPieceTilt: (square?: string, durationMs?: number) => Promise<void>;
    /**
     * Cancel all in-flight teaching effects (demos and pulses); held tilts snap
     * upright. Use `resetPieceTilt` to un-tilt smoothly instead.
     */
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
     * "Evolution" pillar of light that morphs the piece on `square` into a new
     * one (e.g. a pawn into a queen). Like `cinematicMove`, it does not commit
     * the position — apply the real promotion yourself when it resolves.
     */
    promotionBeam: (square: Square, options?: PromotionBeamOptions) => Promise<void>;
    /**
     * Collapse the piece on `square` into a swirling black-hole vortex. Does not
     * commit the position — remove/capture the real piece when it resolves.
     */
    implode: (square: Square, options?: ImplodeOptions) => Promise<void>;
    /**
     * 3D teleport-swap the king and rook of a castle. Both pieces fly at once
     * (the rook arcs lower so they pass without colliding). Does not commit the
     * position — apply the real castle when it resolves.
     */
    castleSwap: (kingFrom: Square, kingTo: Square, rookFrom: Square, rookTo: Square, options?: CastleSwapOptions) => Promise<void>;
    /**
     * Dim the whole board except for spotlight holes over the given squares.
     * Persists until the returned handle's `clear()` is called (or
     * `clearCinematics`).
     */
    spotlight: (squares: Square[], options?: SpotlightOptions) => SpotlightHandle;
    /**
     * Topple the king on `square` — it tips on its base, falls, and thuds down
     * with a dust puff, optionally dimming the board and popping a banner. The
     * canonical end-of-game beat for a playing or learning app. Does not change
     * the position.
     */
    checkmate: (square: Square, options?: CheckmateOptions) => Promise<void>;
    /**
     * Pin animated text over a square — evaluations, counts, "fork!", lesson
     * callouts. Persists until the returned handle is cleared (or
     * `clearCinematics`), and `setText` updates it in place without replaying
     * the entry animation. For static, always-on labels prefer the
     * `squareLabels` prop.
     */
    annotate: (square: Square, text: string, options?: AnnotationOptions) => AnnotationHandle;
    /** Draw an animated glowing threat beam from one square to another. */
    drawLaser: (from: Square, to: Square, options?: LaserOptions) => Promise<void>;
    /** Draw an arrow slowly from one square to another (shaft draws, then head pops in). */
    drawArrow: (from: Square, to: Square, options?: DrawArrowOptions) => Promise<void>;
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
    /**
     * Snapshot the board as a standalone SVG string: position, orientation,
     * theme, last move, check, highlights, marks and arrows as currently shown.
     * Any option overrides the live value (e.g. `{ size: 1200, arrows: [] }`).
     * Custom React piece renderers can't be serialised — the built-in or
     * `pieceSet` artwork is used instead.
     */
    toSVG: (options?: BoardSvgOptions) => string;
    /**
     * Render the board to an image Blob (PNG by default) — ready for
     * `navigator.share`, a download link or an upload. `pieceSet` artwork is
     * fetched and inlined so the image is self-contained.
     */
    toImage: (options?: BoardSvgOptions & RasterOptions) => Promise<Blob>;
}

declare const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
declare const INITIAL_GAME_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
declare function readFen(fen: string): Pieces;
declare function writeFen(pieces: Pieces): string;

/**
 * Compute all legal premove destinations for a piece on a given square.
 *
 * Premoves allow any geometrically reachable square. They intentionally ignore
 * the current board blockers because by the time the premove fires the
 * opponent may have moved or captured one of those blockers. The eventual
 * move is still validated against the resulting position before it is played.
 */
declare function premoveDests(square: Square, pieces: Pieces, color: PieceColor): Square[];

export { type PieceTiltOptions as $, type AnimateMoveOptions as A, type BoardSvgOptions as B, type ChessiroCanvasProps as C, DEFAULT_ARROW_BRUSHES as D, EASINGS as E, type ExpectedMove as F, type FlipAnimation as G, type GhostPiece as H, INITIAL_FEN as I, INITIAL_GAME_FEN as J, type ImplodeOptions as K, type LandingAnimation as L, type LaserOptions as M, MOVE_ANIMATION_PRESETS as N, type MoveAnimationOptions as O, type MoveAnimationPreset as P, type MoveQualityBadge as Q, type RasterOptions as R, type NotationVisuals as S, type Orientation as T, type OverlayVisuals as U, type Piece as V, type PieceCode as W, type PieceColor as X, type PieceRenderer as Y, type PieceRole as Z, type PieceSet as _, type ChessiroCanvasRef as a, type PlayCinematicOptions as a0, type PopBadgeOptions as a1, type PopBannerOptions as a2, type PremoveConfig as a3, type PromotionBeamOptions as a4, type PromotionContext as a5, type PromotionPiece as a6, type PromotionVisuals as a7, type PulseSquareOptions as a8, type ResolvedMoveAnimation as a9, planSnapBackTrack as aA, resolveEasing as aB, sampleTrack as aC, staggerRank as aD, type SpotlightHandle as aa, type SpotlightOptions as ab, type Square as ac, type SquareBurstOptions as ad, type SquareLabel as ae, type SquareVisuals as af, type TextOverlay as ag, cubicBezier as ah, premoveDests as ai, readFen as aj, renderBoardSvg as ak, resolveMoveAnimation as al, writeFen as am, type Pieces as an, type BoardPoint as ao, FILES as ap, type MotionKeyframe as aq, type MotionTrack as ar, RANKS as as, type ResolveMoveAnimationContext as at, moveDurationMs as au, planAppearTrack as av, planCaptureTrack as aw, planFlipFadeTrack as ax, planLandingTrack as ay, planMoveTrack as az, type AnimationEvent as b, type AppearAnimation as c, type Arrow as d, type ArrowBrush as e, type ArrowBrushes as f, type ArrowHeadShape as g, type ArrowVisuals as h, type BoardTheme as i, type CameraController as j, type CameraDriftOptions as k, type CameraShakeOptions as l, type CameraTiltOptions as m, type CameraZoomOptions as n, type CaptureAnimation as o, type CastleSwapOptions as p, type CelebrateOptions as q, type CinematicMoveOptions as r, type CinematicPlayback as s, type CinematicStep as t, type CinematicStyle as u, DEFAULT_BOARD_THEME as v, type Dests as w, type DrawArrowOptions as x, type EasingFunction as y, type EasingName as z };
