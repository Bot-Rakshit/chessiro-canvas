import * as react from 'react';
import { C as ChessiroCanvasProps, a as ChessiroCanvasRef } from './premove-BAOmyKHw.js';
export { A as AnimateMoveOptions, b as AnimationEvent, c as AppearAnimation, d as Arrow, e as ArrowBrush, f as ArrowBrushes, g as ArrowHeadShape, h as ArrowVisuals, B as BoardSvgOptions, i as BoardTheme, j as CameraController, k as CameraDriftOptions, l as CameraShakeOptions, m as CameraTiltOptions, n as CameraZoomOptions, o as CaptureAnimation, p as CastleSwapOptions, q as CelebrateOptions, r as CinematicMoveOptions, s as CinematicPlayback, t as CinematicStep, u as CinematicStyle, D as DEFAULT_ARROW_BRUSHES, v as DEFAULT_BOARD_THEME, w as Dests, x as DrawArrowOptions, E as EASINGS, y as EasingFunction, z as EasingName, F as ExpectedMove, G as FlipAnimation, H as GhostPiece, I as INITIAL_FEN, J as INITIAL_GAME_FEN, K as ImplodeOptions, L as LandingAnimation, M as LaserOptions, N as MOVE_ANIMATION_PRESETS, O as MoveAnimationOptions, P as MoveAnimationPreset, Q as MoveQualityBadge, R as NotationVisuals, S as Orientation, T as OverlayVisuals, U as Piece, V as PieceCode, W as PieceColor, X as PieceRenderer, Y as PieceRole, Z as PieceSet, _ as PieceTiltOptions, $ as PlayCinematicOptions, a0 as PopBadgeOptions, a1 as PopBannerOptions, a2 as PremoveConfig, a3 as PromotionBeamOptions, a4 as PromotionContext, a5 as PromotionPiece, a6 as PromotionVisuals, a7 as PulseSquareOptions, a8 as RasterOptions, a9 as ResolvedMoveAnimation, aa as SpotlightHandle, ab as SpotlightOptions, ac as Square, ad as SquareBurstOptions, ae as SquareLabel, af as SquareVisuals, ag as TextOverlay, ah as cubicBezier, ai as premoveDests, aj as readFen, ak as renderBoardSvg, al as resolveMoveAnimation, am as svgToImageBlob, an as writeFen } from './premove-BAOmyKHw.js';

declare const ChessiroCanvas: react.ForwardRefExoticComponent<ChessiroCanvasProps & react.RefAttributes<ChessiroCanvasRef>>;

declare function preloadPieceSet(path: string): void;

declare function resolvePieceImageSrc(pieceKey: string, piecePath?: string): string;

export { ChessiroCanvas, ChessiroCanvasProps, ChessiroCanvasRef, preloadPieceSet, resolvePieceImageSrc };
