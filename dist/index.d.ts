import * as react from 'react';
import { CSSProperties, ReactNode } from 'react';

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
    current?: [string, string];
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
    /** Outline color painted behind the shaft and around the arrowhead. Default: rgba(0,0,0,0.45). */
    outlineColor?: string;
    /** Outline thickness in board-units. 0 disables outline rendering. Default: 0. */
    outlineWidth?: number;
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
    allowDragging?: boolean;
    allowDrawingArrows?: boolean;
    animationDurationMs?: number;
    showAnimations?: boolean;
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
interface ChessiroCanvasRef {
    getSquareRect: (square: string) => DOMRect | null;
    getBoardRect: () => DOMRect | null;
}

declare const ChessiroCanvas: react.ForwardRefExoticComponent<ChessiroCanvasProps & react.RefAttributes<ChessiroCanvasRef>>;

declare const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
declare const INITIAL_GAME_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
declare function readFen(fen: string): Pieces;
declare function writeFen(pieces: Pieces): string;

declare function preloadPieceSet(path: string): void;

/**
 * Compute all legal premove destinations for a piece on a given square.
 * Premoves allow any geometrically valid move regardless of check/pin.
 * Pieces cannot premove onto own pieces.
 */
declare function premoveDests(square: Square, pieces: Pieces, color: PieceColor): Square[];

export { type AnimationEvent, type Arrow, type ArrowBrush, type ArrowBrushes, type ArrowHeadShape, type ArrowVisuals, type BoardTheme, ChessiroCanvas, type ChessiroCanvasProps, type ChessiroCanvasRef, DEFAULT_ARROW_BRUSHES, type Dests, INITIAL_FEN, INITIAL_GAME_FEN, type MoveQualityBadge, type NotationVisuals, type Orientation, type OverlayVisuals, type Piece, type PieceColor, type PieceRenderer, type PieceRole, type PieceSet, type PremoveConfig, type PromotionContext, type PromotionPiece, type PromotionVisuals, type Square, type SquareVisuals, type TextOverlay, preloadPieceSet, premoveDests, readFen, writeFen };
