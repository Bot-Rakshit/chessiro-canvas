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
    /** Inset border width in px for capture-move rings. Default: 7 */
    legalCaptureRingWidth?: number;
    /** Color overlay for the square the piece is hovering over during drag. Default: selectedPiece color at 0.3 opacity */
    dragOverHighlight?: string;
}
interface ArrowVisuals {
    lineWidth?: number;
    opacity?: number;
    margin?: number;
    markerWidth?: number;
    markerHeight?: number;
    markerRefX?: number;
    markerRefY?: number;
}
interface NotationVisuals {
    fontFamily?: string;
    fontSize?: string | number;
    fontWeight?: number | string;
    color?: string;
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

export { type AnimationEvent, type Arrow, type ArrowBrush, type ArrowBrushes, type ArrowVisuals, type BoardTheme, ChessiroCanvas, type ChessiroCanvasProps, type ChessiroCanvasRef, DEFAULT_ARROW_BRUSHES, type Dests, INITIAL_FEN, INITIAL_GAME_FEN, type MoveQualityBadge, type NotationVisuals, type Orientation, type OverlayVisuals, type Piece, type PieceColor, type PieceRenderer, type PieceRole, type PieceSet, type PremoveConfig, type PromotionContext, type PromotionPiece, type PromotionVisuals, type Square, type SquareVisuals, type TextOverlay, preloadPieceSet, premoveDests, readFen, writeFen };
