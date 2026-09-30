import * as react from 'react';
import { ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';

type EasingFunction = (t: number) => number;
type EasingName = 'linear' | 'ease' | 'easeIn' | 'easeOut' | 'easeInOut' | 'snappy' | 'smooth' | 'backOut' | 'spring' | 'bounce' | 'elastic' | 'anticipate';
declare const EASINGS: Readonly<Record<EasingName, EasingFunction>>;
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
type BoardPoint = readonly [x: number, y: number];

type PieceCode$1 = 'wp' | 'wn' | 'wb' | 'wr' | 'wq' | 'wk' | 'bp' | 'bn' | 'bb' | 'br' | 'bq' | 'bk';
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
    pieceSvgs?: Partial<Record<PieceCode$1, string>>;
    /**
     * Image URL per piece. Used by reference (`<image href>`), so the SVG is not
     * self-contained — prefer `pieceSvgs` when rasterising.
     */
    pieceUrls?: Partial<Record<PieceCode$1, string>>;
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
type PromotionPiece = 'q' | 'r' | 'b' | 'n';

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

interface PlannedMove {
    from: Square;
    to: Square;
    piece: Piece;
}
interface PlannedPiece {
    square: Square;
    piece: Piece;
}
/** What changed between two positions, expressed as motion. */
interface AnimationPlan {
    /** Pieces that travel: matched by type to the nearest vacated square. */
    moves: PlannedMove[];
    /** Pieces that left without a matching arrival (captures, removals). */
    captures: PlannedPiece[];
    /** Pieces that arrived without a matching departure (setup, promotion). */
    appears: PlannedPiece[];
}
/**
 * Diff two positions into moves, captures and appearances. Each arrival is
 * paired with the nearest vacated square holding the same piece type, which
 * is exact for normal moves and castling and a good guess for position jumps.
 * Runs in O(64 + n·m) with n, m the (tiny) per-type arrival/departure counts.
 */
declare function computeAnimPlan(prevPieces: Pieces, nextPieces: Pieces): AnimationPlan;

declare const PIECE_CODES: readonly ["bb", "bk", "bn", "bp", "bq", "br", "wb", "wk", "wn", "wp", "wq", "wr"];
type PieceCode = (typeof PIECE_CODES)[number];
declare const DEFAULT_PIECE_SVGS: Record<PieceCode, string>;

/** Screen-space column/row (0..7) of a square for the given orientation. */
declare function squareToPoint(square: Square | string, orientation?: Orientation): BoardPoint;
/** Inverse of `squareToPoint`; floors fractional points. Null when off the board. */
declare function pointToSquare(x: number, y: number, orientation?: Orientation): Square | null;

/** Controlled premoves: the board queues one move while it is not your turn. */
interface NativePremoveConfig {
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
interface NativeSquareVisuals {
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
interface ExpectedMove {
    from: string;
    to: string;
    /** When set, only this promotion piece is accepted. */
    promotion?: PromotionPiece;
}
/**
 * Custom piece artwork, e.g. `(code, size) => <Image source={pngs[code]} style={{ width: size, height: size }} />`.
 * Called once per piece per size change — never per frame.
 */
type PieceRenderFn = (code: PieceCode$1, size: number) => ReactNode;
interface ChessiroBoardProps {
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
    /** Legal destinations per square. When omitted every move is offered to `onMove`. */
    dests?: Dests;
    /** Return true to accept the move (then update `position`), false to snap the piece back. */
    onMove?: (from: string, to: string, promotion?: PromotionPiece) => boolean;
    lastMove?: {
        from: string;
        to: string;
    } | null;
    /** King square in check. */
    check?: string | null;
    /** Skip the promotion chooser and always promote to this piece. */
    autoPromoteTo?: PromotionPiece;
    premovable?: NativePremoveConfig;
    /** Only these move(s) are accepted; anything else snaps back, shakes and fires `onWrongMove`. */
    expectedMove?: ExpectedMove | ExpectedMove[] | null;
    onWrongMove?: (from: string, to: string) => void;
    /** Feedback for a wrong move in guided mode. Default: 'shake'. */
    wrongMoveFeedback?: 'shake' | 'none';
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
interface PulseSquareOptions {
    /** Default: 'rgba(255, 215, 0, 0.55)'. */
    color?: string;
    /** Length of one pulse in ms. Default: 600. */
    durationMs?: number;
    /** Number of pulses. Default: 2. */
    times?: number;
}
interface NativeAnimateMoveOptions {
    /** Travel time in ms. Default: 3.5× `animationDurationMs` (a slow, readable demo). */
    durationMs?: number;
}
interface ChessiroBoardRef {
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

/**
 * Chessboard for React Native. Controlled like the web `ChessiroCanvas`:
 * pass a FEN `position`, answer `onMove`, and update `position` yourself.
 * Drag, snap-back and every move animation run on the UI thread.
 */
declare const ChessiroBoard: react.ForwardRefExoticComponent<ChessiroBoardProps & react.RefAttributes<ChessiroBoardRef>>;
/** Alias matching the web package's component name. */
declare const ChessiroCanvas: react.ForwardRefExoticComponent<ChessiroBoardProps & react.RefAttributes<ChessiroBoardRef>>;

interface PieceArtProps {
    code: PieceCode$1;
    size: number;
    renderPiece?: PieceRenderFn;
}
/**
 * Artwork for one piece. Memoised on (code, size, renderer), so the SVG XML is
 * parsed when a piece mounts or the board resizes — never while it moves:
 * motion is applied to the wrapping Animated.View on the UI thread.
 */
declare const PieceArt: react.NamedExoticComponent<PieceArtProps>;

export { type AppearAnimation, type Arrow, type ArrowBrush, type ArrowBrushes, type BoardTheme, type CaptureAnimation, ChessiroBoard, type ChessiroBoardProps, type ChessiroBoardRef, ChessiroCanvas, type ChessiroBoardProps as ChessiroCanvasProps, type ChessiroBoardRef as ChessiroCanvasRef, DEFAULT_ARROW_BRUSHES, DEFAULT_BOARD_THEME, DEFAULT_PIECE_SVGS, type Dests, EASINGS, type EasingFunction, type EasingName, type ExpectedMove, type FlipAnimation, INITIAL_FEN, INITIAL_GAME_FEN, type LandingAnimation, MOVE_ANIMATION_PRESETS, type MoveAnimationOptions, type MoveAnimationPreset, type NativeAnimateMoveOptions, type NativePremoveConfig, type NativeSquareVisuals, type Orientation, type Piece, PieceArt, type PieceCode$1 as PieceCode, type PieceColor, type PieceRenderFn, type PieceRole, type Pieces, type PromotionPiece, type PulseSquareOptions, type Square, computeAnimPlan, pointToSquare, premoveDests, readFen, renderBoardSvg, resolveMoveAnimation, squareToPoint, writeFen };
