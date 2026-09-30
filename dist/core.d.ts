import { ac as Square, U as Piece, ao as Pieces, S as Orientation, ap as BoardPoint } from './premove-BAOmyKHw.js';
export { c as AppearAnimation, d as Arrow, e as ArrowBrush, f as ArrowBrushes, B as BoardSvgOptions, i as BoardTheme, o as CaptureAnimation, D as DEFAULT_ARROW_BRUSHES, v as DEFAULT_BOARD_THEME, w as Dests, E as EASINGS, y as EasingFunction, z as EasingName, aq as FILES, G as FlipAnimation, I as INITIAL_FEN, J as INITIAL_GAME_FEN, L as LandingAnimation, N as MOVE_ANIMATION_PRESETS, ar as MotionKeyframe, as as MotionTrack, O as MoveAnimationOptions, P as MoveAnimationPreset, V as PieceCode, W as PieceColor, Y as PieceRole, a5 as PromotionPiece, at as RANKS, au as ResolveMoveAnimationContext, a9 as ResolvedMoveAnimation, ah as cubicBezier, av as moveDurationMs, aw as planAppearTrack, ax as planCaptureTrack, ay as planFlipFadeTrack, az as planLandingTrack, aA as planMoveTrack, aB as planSnapBackTrack, ai as premoveDests, aj as readFen, ak as renderBoardSvg, aC as resolveEasing, al as resolveMoveAnimation, aD as sampleTrack, aE as staggerRank, an as writeFen } from './premove-BAOmyKHw.js';
import 'react';

declare const ALL_SQUARES: readonly Square[];
declare function isLightSquare(sq: Square): boolean;

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

export { ALL_SQUARES, type AnimationPlan, BoardPoint, DEFAULT_PIECE_SVGS, Orientation, Piece, Pieces, type PlannedMove, type PlannedPiece, Square, computeAnimPlan, isLightSquare, pointToSquare, squareToPoint };
