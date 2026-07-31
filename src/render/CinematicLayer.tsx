import {
  memo,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { RefObject } from 'react';
import type {
  Pieces, PieceSet, PieceRenderer, Square,
  CinematicMoveOptions, CinematicStyle, SquareBurstOptions, PopBadgeOptions,
  CelebrateOptions, PopBannerOptions, PromotionBeamOptions, ImplodeOptions,
  CheckmateOptions, AnnotationOptions, AnnotationHandle, SquareCorner,
  CastleSwapOptions, SpotlightOptions, SpotlightHandle, LaserOptions, DrawArrowOptions,
} from '../types';
import { PieceGlyph } from './PieceGlyph';
import { canAnimate, prefersReducedMotion, waitForAnimation } from '../cinematics/motion';

export interface CinematicLayerRef {
  cinematicMove: (from: Square, to: Square, options?: CinematicMoveOptions) => Promise<void>;
  squareBurst: (square: Square, options?: SquareBurstOptions) => Promise<void>;
  popBadge: (square: Square, options: PopBadgeOptions) => Promise<void>;
  celebrate: (options?: CelebrateOptions) => Promise<void>;
  popBanner: (options: PopBannerOptions) => Promise<void>;
  promotionBeam: (square: Square, options?: PromotionBeamOptions) => Promise<void>;
  implode: (square: Square, options?: ImplodeOptions) => Promise<void>;
  checkmate: (square: Square, options?: CheckmateOptions) => Promise<void>;
  annotate: (square: Square, text: string, options?: AnnotationOptions) => AnnotationHandle;
  castleSwap: (kingFrom: Square, kingTo: Square, rookFrom: Square, rookTo: Square, options?: CastleSwapOptions) => Promise<void>;
  spotlight: (squares: Square[], options?: SpotlightOptions) => SpotlightHandle;
  drawLaser: (from: Square, to: Square, options?: LaserOptions) => Promise<void>;
  drawArrow: (from: Square, to: Square, options?: DrawArrowOptions) => Promise<void>;
  clearCinematics: () => void;
}

interface CinematicLayerProps {
  /** Squares to hold invisible while a clone covers them. See finishMove. */
  suppressedSquaresRef?: React.RefObject<Set<string>>;
  boardStateRef: RefObject<{ pieces: Pieces; asWhite: boolean }>;
  pieceSet?: PieceSet;
  customPieces?: PieceRenderer;
  flipPieces?: boolean;
  getPieceElement: (square: string) => HTMLDivElement | null;
  /** Fired at the exact impact moment when a move requests a camera shake. */
  onImpactShake?: (options: { intensity?: number; durationMs?: number }) => void;
}

interface ShakeSpec {
  intensity: number;
  durationMs: number;
}

interface ResolvedMoveOpts {
  durationMs: number;
  spins: number;
  arcHeight: number;
  liftScale: number;
  glowColor: string;
  glowMaxPx: number;
  sparkles: boolean;
  shockwave: boolean;
  badge?: string;
  badgeColor?: string;
  slowMoLanding: boolean;
  plunge: boolean;
  squash: number;
  liftEnd: number;
  landStart: number;
  slam: boolean;
  trailCount: number;
  flash: boolean;
  victimBlast: boolean;
  impactShake: ShakeSpec | null;
  onImpact?: () => void;
  reduced: boolean;
}

interface MoveEntry {
  id: number;
  pieceKey: string;
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
  toSquare: Square;
  hiddenSquare: string | null;
  opts: ResolvedMoveOpts;
}

interface Particle {
  dx: number;
  dy: number;
  size: number;
  delayMs: number;
  rotateDeg: number;
}

interface BurstEntry {
  id: number;
  col: number;
  row: number;
  kind: 'sparkles' | 'shockwave' | 'both';
  color: string;
  durationMs: number;
  particles: Particle[];
}

interface BadgeEntry {
  id: number;
  col: number;
  row: number;
  text: string;
  color: string;
  background: string;
  durationMs: number;
  corner: 'topRight' | 'center';
}

interface BlastEntry {
  id: number;
  pieceKey: string;
  col: number;
  row: number;
  dxPct: number;
  risePct: number;
  rotateDeg: number;
  durationMs: number;
}

interface FlashEntry {
  id: number;
  cxPct: number;
  cyPct: number;
  color: string;
  durationMs: number;
}

interface Flake {
  leftPct: number;
  delayMs: number;
  fallMs: number;
  color: string;
  wPct: number;
  hPct: number;
  swayPct: number;
  rotateDeg: number;
  round: boolean;
}

interface ConfettiEntry {
  id: number;
  flakes: Flake[];
}

interface BannerEntry {
  id: number;
  text: string;
  color: string;
  background?: string;
  glowColor: string;
  durationMs: number;
}

interface PromoEntry {
  id: number;
  col: number;
  row: number;
  color: string;
  durationMs: number;
  fromPieceKey?: string;
  toPieceKey?: string;
}

interface ImplodeEntry {
  id: number;
  col: number;
  row: number;
  color: string;
  durationMs: number;
  pieceKey?: string;
}

interface CheckmateEntry {
  id: number;
  col: number;
  row: number;
  /** +1 topples to the right, -1 to the left. */
  dir: 1 | -1;
  color: string;
  durationMs: number;
  dim: boolean;
  pieceKey?: string;
}

interface AnnotationEntry {
  id: number;
  col: number;
  row: number;
  text: string;
  color: string;
  background: string;
  corner: SquareCorner;
  fontSize?: string;
  enter: 'pop' | 'fade' | 'rise';
  reduced: boolean;
}

interface SpotHole {
  cx: number;
  cy: number;
  r: number;
}

interface SpotlightEntry {
  id: number;
  holes: SpotHole[];
  color: string;
  durationMs: number;
}

interface LaserEntry {
  id: number;
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  dist: number;
  angle: number;
  color: string;
  glowColor: string;
  widthPx: number;
  durationMs: number;
  persist: boolean;
  holdMs: number;
}

interface DrawnArrowEntry {
  id: number;
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  color: string;
  glowColor: string;
  widthPx: number;
  headLengthPx: number;
  headWidthPx: number;
  durationMs: number;
  persist: boolean;
  holdMs: number;
}

const BRILLIANT_TEAL = '#26c2a3';
const DEFAULT_BURST_COLOR = '#ffd65a';
const DEFAULT_BURST_DURATION_MS = 650;
const SHOCKWAVE_DURATION_MS = 500;
const DEFAULT_BADGE_DURATION_MS = 1600;
const MOVE_BADGE_DURATION_MS = 1400;
const VICTIM_BLAST_DURATION_MS = 700;
const FLASH_DURATION_MS = 380;
const DEFAULT_CELEBRATE_DURATION_MS = 2200;
const DEFAULT_BANNER_DURATION_MS = 1800;
const DEFAULT_PROMOTION_BEAM_DURATION_MS = 1500;
const DEFAULT_PROMOTION_BEAM_COLOR = '#ffe27a';
const ANNOTATION_POSITIONS: Record<SquareCorner, { align: string; justify: string }> = {
  topLeft: { align: 'flex-start', justify: 'flex-start' },
  topRight: { align: 'flex-start', justify: 'flex-end' },
  bottomLeft: { align: 'flex-end', justify: 'flex-start' },
  bottomRight: { align: 'flex-end', justify: 'flex-end' },
  center: { align: 'center', justify: 'center' },
};
const DEFAULT_CHECKMATE_DURATION_MS = 1600;
const DEFAULT_CHECKMATE_COLOR = '#c0392b';
const DEFAULT_ANNOTATION_BG = 'rgba(17, 24, 39, 0.92)';
const ANNOTATION_ENTER_MS = 260;
const ANNOTATION_EXIT_MS = 200;
const DEFAULT_IMPLODE_DURATION_MS = 750;
const DEFAULT_IMPLODE_COLOR = '#b07bff';
const DEFAULT_CASTLE_SWAP_DURATION_MS = 1100;
const DEFAULT_CASTLE_SWAP_GLOW = '#8fd0ff';
const DEFAULT_SPOTLIGHT_DURATION_MS = 420;
const DEFAULT_SPOTLIGHT_COLOR = 'rgba(3, 7, 15, 0.74)';
const DEFAULT_SPOTLIGHT_RADIUS = 0.72;
const DEFAULT_LASER_COLOR = '#ff3b3b';
const DEFAULT_LASER_DURATION_MS = 500;
const DEFAULT_LASER_WIDTH_PX = 4;
const DEFAULT_LASER_HOLD_MS = 400;
const LASER_FADE_MS = 250;
const DEFAULT_DRAW_ARROW_COLOR = '#ff3b3b';
const DEFAULT_DRAW_ARROW_DURATION_MS = 700;
const DEFAULT_DRAW_ARROW_WIDTH_PX = 4;
const DEFAULT_DRAW_ARROW_HEAD_LENGTH_PX = 14;
const DEFAULT_DRAW_ARROW_HEAD_WIDTH_PX = 12;
const DEFAULT_DRAW_ARROW_HOLD_MS = 400;
const DRAW_ARROW_FADE_MS = 250;
const HEX6 = /^#[0-9a-f]{6}$/i;
const TRAIL_GAP_MS = 55;
const FLIGHT_SAMPLES = 32;
const CELEBRATE_COLORS = [BRILLIANT_TEAL, '#ffd65a', '#ff6b6b', '#5ea2d9', '#b78bff', '#7ee081'];
// p(u) = 1 - (1-u)^k with k chosen so the last 20% of the flight distance
// takes the final 40% of the flight time (slow-motion landing).
const SLOWMO_EXPONENT = Math.log(0.2) / Math.log(0.4);

// ── Easing vocabulary ────────────────────────────────────────────────
// The position track is sampled densely (FLIGHT_SAMPLES) with its pacing baked
// into the sample offsets, so it interpolates linearly between samples. The
// attitude and settle tracks have only a handful of keyframes, and linear
// interpolation between them produced a visible velocity break at every
// keyframe — that constant-speed, stop-start quality is what read as robotic.
// These curves give each segment its own acceleration.
/** Lift off the board: quick out of the gate, then float. */
const EASE_LIFT = 'cubic-bezier(0.16, 0.84, 0.34, 1)';
/** Mid-flight attitude: no acceleration break at either end. */
const EASE_FLIGHT = 'cubic-bezier(0.37, 0, 0.63, 1)';
/** Gravity: slow to leave, fast to arrive. */
const EASE_GRAVITY = 'cubic-bezier(0.45, 0, 0.9, 0.55)';
/** Compression on contact — the piece takes the hit fast. */
const EASE_COMPRESS = 'cubic-bezier(0.5, 0, 0.9, 0.5)';
/** Recovery out of the squash — decelerates smoothly, no elastic wobble. */
const EASE_RECOVER = 'cubic-bezier(0.16, 1, 0.3, 1)';

interface StylePreset {
  durationMs: number;
  spins: number;
  arcHeight: number;
  liftScale: number;
  glowColor: string;
  glowMaxPx: number;
  sparkles: boolean;
  shockwave: boolean;
  slowMoLanding: boolean;
  plunge: boolean;
  squash: number;
  liftEnd: number;
  landStart: number;
  slam: boolean;
  trailCount: number;
  flash: boolean;
  victimBlast: boolean;
  impactShake: ShakeSpec | null;
}

const STYLE_PRESETS: Record<CinematicStyle, StylePreset> = {
  brilliant: {
    durationMs: 2000, spins: 1.5, arcHeight: 1.6, liftScale: 1.35,
    glowColor: BRILLIANT_TEAL, glowMaxPx: 18, sparkles: true, shockwave: true,
    slowMoLanding: true, plunge: false, squash: 0.11, liftEnd: 0.15, landStart: 0.7, slam: false,
    trailCount: 4, flash: true, victimBlast: true, impactShake: { intensity: 3, durationMs: 300 },
  },
  great: {
    durationMs: 1400, spins: 1, arcHeight: 0.9, liftScale: 1.26,
    glowColor: '#5ea2d9', glowMaxPx: 10, sparkles: true, shockwave: false,
    slowMoLanding: false, plunge: false, squash: 0.09, liftEnd: 0.15, landStart: 0.72, slam: false,
    trailCount: 0, flash: false, victimBlast: false, impactShake: null,
  },
  smooth: {
    durationMs: 900, spins: 0, arcHeight: 0.35, liftScale: 1.12,
    glowColor: 'rgba(0, 0, 0, 0)', glowMaxPx: 0, sparkles: false, shockwave: false,
    slowMoLanding: false, plunge: false, squash: 0.04, liftEnd: 0.15, landStart: 0.85, slam: false,
    trailCount: 0, flash: false, victimBlast: false, impactShake: null,
  },
  slam: {
    durationMs: 1050, spins: 0, arcHeight: 0, liftScale: 1.48,
    glowColor: DEFAULT_BURST_COLOR, glowMaxPx: 12, sparkles: false, shockwave: true,
    slowMoLanding: false, plunge: false, squash: 0.17, liftEnd: 0.25, landStart: 0.72, slam: true,
    trailCount: 0, flash: true, victimBlast: true, impactShake: { intensity: 7, durationMs: 380 },
  },
  meteor: {
    durationMs: 1800, spins: 1.5, arcHeight: 2.4, liftScale: 1.44,
    glowColor: '#ff7a3d', glowMaxPx: 26, sparkles: true, shockwave: true,
    slowMoLanding: false, plunge: true, squash: 0.18, liftEnd: 0.12, landStart: 0.74, slam: false,
    trailCount: 5, flash: true, victimBlast: true, impactShake: { intensity: 9, durationMs: 450 },
  },
};

function squareColRow(sq: string, asWhite: boolean): [number, number] {
  const f = sq.charCodeAt(0) - 97;
  const r = sq.charCodeAt(1) - 49;
  return [asWhite ? f : 7 - f, asWhite ? 7 - r : r];
}

function isValidSquare(sq: string): sq is Square {
  return typeof sq === 'string' && /^[a-h][1-8]$/.test(sq);
}

function positionTransform(col: number, row: number): string {
  return `translate(${col * 100}%, ${row * 100}%)`;
}

function easeInOutQuad(u: number): number {
  return u < 0.5 ? 2 * u * u : 1 - ((-2 * u + 2) ** 2) / 2;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function resolveShake(
  option: CinematicMoveOptions['impactShake'],
  preset: ShakeSpec | null,
): ShakeSpec | null {
  if (option === false) return null;
  if (option === undefined) return preset;
  const base = preset ?? { intensity: 5, durationMs: 350 };
  if (option === true) return base;
  return {
    intensity: option.intensity ?? base.intensity,
    durationMs: option.durationMs ?? base.durationMs,
  };
}

function resolveMoveOptions(options: CinematicMoveOptions | undefined, reduced: boolean): ResolvedMoveOpts {
  const preset = STYLE_PRESETS[options?.style ?? 'brilliant'];
  const trailOpt = options?.trail;
  const base: ResolvedMoveOpts = {
    durationMs: Math.max(100, options?.durationMs ?? preset.durationMs),
    spins: Math.max(0, options?.spins ?? preset.spins),
    arcHeight: Math.max(0, options?.arcHeight ?? preset.arcHeight),
    liftScale: options?.liftScale ?? preset.liftScale,
    glowColor: options?.glowColor ?? preset.glowColor,
    glowMaxPx: options?.glowColor ? Math.max(preset.glowMaxPx, 12) : preset.glowMaxPx,
    sparkles: options?.sparkles ?? preset.sparkles,
    shockwave: options?.shockwave ?? preset.shockwave,
    badge: options?.badge,
    badgeColor: options?.badgeColor,
    slowMoLanding: options?.slowMoLanding ?? preset.slowMoLanding,
    plunge: preset.plunge && !(options?.slowMoLanding),
    squash: preset.squash,
    liftEnd: preset.liftEnd,
    landStart: preset.landStart,
    slam: preset.slam,
    trailCount: trailOpt === undefined
      ? preset.trailCount
      : trailOpt === false ? 0 : trailOpt === true ? Math.max(preset.trailCount, 4) : clamp(Math.round(trailOpt), 0, 8),
    flash: options?.flash ?? preset.flash,
    victimBlast: options?.victimBlast ?? preset.victimBlast,
    impactShake: resolveShake(options?.impactShake, preset.impactShake),
    onImpact: options?.onImpact,
    reduced: false,
  };
  if (!reduced) return base;
  // Reduced motion: plain teaching-style glide — no spins, arc, glow or
  // impact effects.
  return {
    ...base,
    durationMs: Math.min(base.durationMs, 900),
    spins: 0,
    arcHeight: 0,
    liftScale: 1.18,
    glowMaxPx: 0,
    sparkles: false,
    shockwave: false,
    badge: undefined,
    slowMoLanding: false,
    plunge: false,
    squash: 0,
    slam: false,
    trailCount: 0,
    flash: false,
    victimBlast: false,
    impactShake: null,
    reduced: true,
  };
}

function flightPacing(o: ResolvedMoveOpts, u: number): number {
  if (o.slowMoLanding) return 1 - (1 - u) ** SLOWMO_EXPONENT;
  if (o.plunge) return u ** 2.2;
  return easeInOutQuad(u);
}

// The flight path is a quadratic bezier sampled into WAAPI keyframes,
// covering the approach phase only: the last keyframe is the touchdown pose,
// so the animation's finish IS the impact moment. Translate percentages are
// relative to the 12.5% piece box, so one square equals 100%.
function buildApproachPositionKeyframes(e: MoveEntry): Keyframe[] {
  const o = e.opts;
  const L = o.landStart;
  const liftFrac = o.liftEnd / L;
  // Slam travels early, then hangs over the destination before the drop.
  const arriveFrac = o.slam ? 0.6 : 1;
  const frames: Keyframe[] = [{ transform: positionTransform(e.fromCol, e.fromRow), offset: 0 }];
  if (o.liftEnd > 0) {
    frames.push({ transform: positionTransform(e.fromCol, e.fromRow), offset: liftFrac });
  }
  const cx = (e.fromCol + e.toCol) / 2;
  // Control point placed so the arc peak bulges arcHeight squares above the
  // chord midpoint (peak at t=0.5 is (P0 + 2C + P2) / 4). Clamped so the peak
  // stays inside the clipped layer.
  let cy = (e.fromRow + e.toRow) / 2 - 2 * o.arcHeight;
  cy = Math.max(cy, (-0.6 - e.fromRow - e.toRow) / 2);
  for (let i = 1; i <= FLIGHT_SAMPLES; i++) {
    const u = i / FLIGHT_SAMPLES;
    const p = flightPacing(o, u);
    const inv = 1 - p;
    const x = inv * inv * e.fromCol + 2 * inv * p * cx + p * p * e.toCol;
    const y = inv * inv * e.fromRow + 2 * inv * p * cy + p * p * e.toRow;
    frames.push({
      transform: positionTransform(x, y),
      offset: liftFrac + (arriveFrac - liftFrac) * u,
    });
  }
  if (arriveFrac < 1) {
    frames.push({ transform: positionTransform(e.toCol, e.toRow), offset: 1 });
  }
  return frames;
}

function buildReducedGlideKeyframes(e: MoveEntry): Keyframe[] {
  return [
    { transform: positionTransform(e.fromCol, e.fromRow), offset: 0, easing: 'ease-in-out' },
    { transform: positionTransform(e.toCol, e.toRow), offset: 1 },
  ];
}

interface AttPose {
  z?: number;
  ry?: number;
  rx?: number;
  sx?: number;
  sy?: number;
  shadow?: number;
  glow?: number;
}

// Every keyframe uses the same transform/filter function lists so WAAPI
// interpolates each component directly instead of falling back to matrices.
function att(offset: number, pose: AttPose, glowColor: string, easing?: string): Keyframe {
  const { z = 0, ry = 0, rx = 0, sx = 1, sy = 1, shadow = 2, glow = 0 } = pose;
  const frame: Keyframe = {
    offset,
    transform: `rotateZ(${z}deg) rotateY(${ry}deg) rotateX(${rx}deg) scaleX(${sx}) scaleY(${sy})`,
    filter: `drop-shadow(0 ${shadow}px ${Math.max(2, shadow)}px rgba(0, 0, 0, 0.3)) drop-shadow(0 0 ${glow}px ${glowColor})`,
  };
  if (easing) frame.easing = easing;
  return frame;
}

interface AttitudePlan {
  flightRy: number;
  restRy: number;
}

function attitudePlan(o: ResolvedMoveOpts): AttitudePlan {
  const flightRy = o.slam ? 0 : o.spins * 360;
  // Settle on a full turn so the piece art never rests mirrored; any
  // remaining half turn completes during the landing squash.
  const restRy = Math.ceil(flightRy / 360 - 0.001) * 360;
  return { flightRy, restRy };
}

// Attitude during the approach: lift, spin and glow, ending exactly at the
// touchdown pose. For slam the hard drop happens at the end of this phase so
// the impact lines up with the animation's finish.
function buildApproachAttitudeKeyframes(e: MoveEntry): Keyframe[] {
  const o = e.opts;
  const g = o.glowMaxPx;
  const c = o.glowColor;
  const lift = o.liftScale;
  const L = o.landStart;
  const liftFrac = o.liftEnd / L;
  const { flightRy } = attitudePlan(o);
  // The lift segment eases out so the piece leaves the board with intent
  // instead of ramping up at constant speed.
  const frames: Keyframe[] = [att(0, {}, c, EASE_LIFT)];
  if (o.slam) {
    frames.push(att(liftFrac, { sx: lift, sy: lift, shadow: 22, glow: g * 0.5 }, c, EASE_FLIGHT));
    // Hang above the destination, then accelerate hard into the drop; the
    // drop ends at the last frame = the impact moment.
    frames.push(att(0.78, { sx: lift, sy: lift, shadow: 22, glow: g }, c, EASE_GRAVITY));
    frames.push(att(1, { sx: 1.03, sy: 0.97, shadow: 3, glow: g }, c));
    return frames;
  }
  const tiltZ = o.spins > 0 ? -6 : 0;
  const wobble = o.spins > 0 ? 14 : 0;
  frames.push(att(liftFrac, { z: tiltZ, sx: lift, sy: lift, shadow: 10, glow: g * 0.35 }, c, EASE_FLIGHT));
  const flight = 1 - liftFrac;
  for (const [u, w] of [[0.25, 1], [0.5, 0], [0.75, -1]] as const) {
    frames.push(att(liftFrac + flight * u, {
      z: tiltZ * (1 - u),
      ry: flightRy * u,
      rx: wobble * w,
      sx: lift,
      sy: lift,
      shadow: 12,
      glow: g * (0.35 + 0.65 * u),
    }, c, EASE_FLIGHT));
  }
  frames.push(att(1, { ry: flightRy, sx: lift, sy: lift, shadow: 12, glow: g }, c));
  return frames;
}

// Attitude after impact: the squash begins on the very first frame so the
// piece visibly slams the instant it touches the square, then rebounds.
function buildSettleAttitudeKeyframes(e: MoveEntry): Keyframe[] {
  const o = e.opts;
  const g = o.glowMaxPx;
  const c = o.glowColor;
  const { flightRy, restRy } = attitudePlan(o);
  const contact = o.slam
    ? att(0, { sx: 1.04, sy: 0.96, shadow: 3, glow: g }, c)
    : att(0, { ry: flightRy, sx: o.liftScale, sy: o.liftScale, shadow: 12, glow: g }, c);
  if (o.squash <= 0) {
    return [contact, att(1, { ry: restRy, shadow: 2 }, c, EASE_RECOVER)];
  }
  // Weight comes from an asymmetric rebound: compress fast on contact, then
  // release slowly. A symmetric squash/stretch at constant speed is what makes
  // an impact read as rubber instead of mass, so the counter-stretch is kept
  // to a third of the compression and decays rather than oscillating.
  const compressAt = o.slam ? 0.18 : 0.24;
  return [
    { ...contact, easing: EASE_COMPRESS },
    att(compressAt, { ry: restRy, sx: 1 + o.squash, sy: 1 - o.squash, shadow: 2, glow: g * 0.6 }, c, EASE_RECOVER),
    att(0.58, { ry: restRy, sx: 1 - o.squash * 0.33, sy: 1 + o.squash * 0.28, shadow: 2, glow: g * 0.3 }, c, EASE_RECOVER),
    att(1, { ry: restRy, shadow: 2 }, c),
  ];
}

/**
 * Cinematic replay effects layered over the board — the primitives behind a
 * "share game" screen where brilliant moves fly with 3D stunts, sparkles and
 * badges. Renders null when idle: no DOM, no listeners, no rAF loops. All
 * animation runs through WAAPI using only transform/opacity/filter.
 *
 * Flights run in two phases: an approach animation whose finish IS the
 * touchdown, so impact effects (shockwave, sparkles, flash, victim blast,
 * camera shake, onImpact) fire frame-accurately the instant the piece drops,
 * while a settle animation squashes and rebounds the piece.
 */
export const CinematicLayer = memo(forwardRef<CinematicLayerRef, CinematicLayerProps>(function CinematicLayer({
  boardStateRef,
  suppressedSquaresRef: suppressedSquaresRefProp,
  pieceSet,
  customPieces,
  flipPieces = false,
  getPieceElement,
  onImpactShake,
}, ref) {
  const [moves, setMoves] = useState<MoveEntry[]>([]);
  const [bursts, setBursts] = useState<BurstEntry[]>([]);
  const [badges, setBadges] = useState<BadgeEntry[]>([]);
  const [blasts, setBlasts] = useState<BlastEntry[]>([]);
  const [flashes, setFlashes] = useState<FlashEntry[]>([]);
  const [confetti, setConfetti] = useState<ConfettiEntry[]>([]);
  const [banners, setBanners] = useState<BannerEntry[]>([]);
  const [promos, setPromos] = useState<PromoEntry[]>([]);
  const [implodes, setImplodes] = useState<ImplodeEntry[]>([]);
  const [checkmates, setCheckmates] = useState<CheckmateEntry[]>([]);
  const [annotations, setAnnotations] = useState<AnnotationEntry[]>([]);
  const [spotlights, setSpotlights] = useState<SpotlightEntry[]>([]);
  const [lasers, setLasers] = useState<LaserEntry[]>([]);
  const [drawnArrows, setDrawnArrows] = useState<DrawnArrowEntry[]>([]);
  const movesRef = useRef<MoveEntry[]>(moves);
  movesRef.current = moves;

  const idRef = useRef(0);
  const getPieceElementRef = useRef(getPieceElement);
  getPieceElementRef.current = getPieceElement;
  const onImpactShakeRef = useRef(onImpactShake);
  onImpactShakeRef.current = onImpactShake;

  const resolversRef = useRef<Map<number, () => void>>(new Map());
  const animationsRef = useRef<Map<number, Animation[]>>(new Map());
  const timeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const hiddenVictimsRef = useRef<Map<number, string>>(new Map());
  // The overlay wrapper per in-flight move, so cleanup can hide the clone
  // imperatively in the same frame it un-hides the real piece.
  const moveElsRef = useRef<Map<number, HTMLElement>>(new Map());
  const hiddenSquaresRef = useRef<Map<number, string>>(new Map());
  const spotlightElsRef = useRef<Map<number, HTMLElement>>(new Map());
  // Annotations outlive the call that created them, so their nodes and
  // auto-dismiss timers are tracked separately from the one-shot effects.
  const annotationElsRef = useRef<Map<number, HTMLElement>>(new Map());
  const annotationTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const startedRef = useRef<Set<number>>(new Set());
  const finishedRef = useRef<Set<number>>(new Set());

  const finishMove = useCallback((entry: MoveEntry) => {
    if (finishedRef.current.has(entry.id)) return;
    finishedRef.current.add(entry.id);

    // Claim the destination BEFORE resolving. React commits the caller's move
    // in a task that lands after our rAF but before paint, so hiding the piece
    // afterwards is always one frame late — it gets painted twice. Suppressing
    // up front means PiecesLayer's layout effect hides it in the same commit
    // that creates it.
    const suppressed = suppressedSquaresRefProp?.current;
    suppressed?.add(entry.toSquare);

    // Resolve first so callers can commit the real move while the cinematic
    // piece (fill: forwards) still covers the destination square; cleanup a
    // couple of frames later avoids a flash of the piece back at origin.
    const resolve = resolversRef.current.get(entry.id);
    resolversRef.current.delete(entry.id);
    resolve?.();

    // The caller commits the move inside resolve(), so the real piece pops in at
    // the destination while the cinematic copy is still parked there by
    // fill:forwards. Painting both for even one frame reads as the piece
    // "appearing twice". Hide the freshly committed piece for the handoff
    // frame; the clone is already covering that square, and cleanup below
    // un-hides it in the same commit that unmounts the clone, so the swap is
    // atomic and neither a doubled piece nor a gap is ever painted.
    let handoffHidden: HTMLElement | null = null;
    const hideHandoffPiece = () => {
      if (cleaned || handoffHidden) return;
      const el = getPieceElementRef.current(entry.toSquare);
      // An element already at opacity 0 is a capture victim hidden by the
      // blast path, not a newly committed piece — leave it to its owner.
      if (el && el.style.opacity !== '0') {
        handoffHidden = el;
        el.style.opacity = '0';
      }
    };

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      const anims = animationsRef.current.get(entry.id);
      if (anims) for (const anim of anims) anim.cancel();
      animationsRef.current.delete(entry.id);
      startedRef.current.delete(entry.id);
      finishedRef.current.delete(entry.id);
      // Hide the clone imperatively FIRST. Unmounting it goes through React
      // state, which does not land until the next commit — restoring the real
      // piece here while the clone is still in the DOM is exactly what painted
      // the piece twice for one frame.
      const wrapper = moveElsRef.current.get(entry.id);
      moveElsRef.current.delete(entry.id);
      if (wrapper) wrapper.style.display = 'none';
      // Release the destination in the same synchronous block, so the clone
      // vanishes and the real piece appears within one frame.
      if (suppressed?.delete(entry.toSquare)) {
        const el = getPieceElementRef.current(entry.toSquare);
        if (el) el.style.opacity = '';
      }
      if (handoffHidden) handoffHidden.style.opacity = '';
      if (entry.hiddenSquare) {
        const orig = getPieceElementRef.current(entry.hiddenSquare);
        if (orig) orig.style.opacity = '';
      }
      const victimSquare = hiddenVictimsRef.current.get(entry.id);
      if (victimSquare) {
        hiddenVictimsRef.current.delete(entry.id);
        const el = getPieceElementRef.current(victimSquare);
        if (el) el.style.opacity = '';
      }
      setMoves(prev => prev.filter(m => m.id !== entry.id));
    };
    if (typeof requestAnimationFrame === 'function') {
      // We cannot know which frame the caller's commit lands on: a flushSync
      // caller lands before the next frame, a plain setState may take a few.
      // So retry the hide each frame until the new piece exists, then clean up
      // on the following frame. rAF callbacks run after tasks and before paint,
      // so whichever frame React commits on, the hide still beats the paint.
      let attempts = 4;
      const step = () => {
        if (cleaned) return;
        hideHandoffPiece();
        if (handoffHidden || --attempts <= 0) {
          requestAnimationFrame(cleanup);
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      // rAF freezes in backgrounded tabs and frameless captures; without
      // this fallback the fill-forwards animations and overlay would leak.
      setTimeout(cleanup, 150);
    } else {
      cleanup();
    }
  }, []);

  const makeFinisher = useCallback(<T extends { id: number },>(
    setEntries: (updater: (prev: T[]) => T[]) => void,
  ) => (entry: T) => {
    const resolve = resolversRef.current.get(entry.id);
    resolversRef.current.delete(entry.id);
    animationsRef.current.delete(entry.id);
    startedRef.current.delete(entry.id);
    setEntries(prev => prev.filter(b => b.id !== entry.id));
    resolve?.();
  }, []);

  // Like makeFinisher but for effects that hide a real board piece: resolves
  // first, then restores the hidden piece a couple of frames later (double
  // rAF + timer fallback + cleaned guard) so frameless/backgrounded captures
  // never leak the hidden piece — mirrors finishMove's cleanup.
  const makeHiddenFinisher = useCallback(<T extends { id: number },>(
    setEntries: (updater: (prev: T[]) => T[]) => void,
  ) => (entry: T) => {
    if (finishedRef.current.has(entry.id)) return;
    finishedRef.current.add(entry.id);

    const resolve = resolversRef.current.get(entry.id);
    resolversRef.current.delete(entry.id);
    resolve?.();

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      const anims = animationsRef.current.get(entry.id);
      if (anims) for (const anim of anims) anim.cancel();
      animationsRef.current.delete(entry.id);
      startedRef.current.delete(entry.id);
      finishedRef.current.delete(entry.id);
      const square = hiddenSquaresRef.current.get(entry.id);
      if (square) {
        hiddenSquaresRef.current.delete(entry.id);
        const el = getPieceElementRef.current(square);
        if (el) el.style.opacity = '';
      }
      setEntries(prev => prev.filter(e => e.id !== entry.id));
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(cleanup));
      setTimeout(cleanup, 150);
    } else {
      cleanup();
    }
  }, []);

  const finishBurst = useRef(makeFinisher<BurstEntry>(setBursts)).current;
  const finishBadge = useRef(makeFinisher<BadgeEntry>(setBadges)).current;
  const finishBlast = useRef(makeFinisher<BlastEntry>(setBlasts)).current;
  const finishFlash = useRef(makeFinisher<FlashEntry>(setFlashes)).current;
  const finishConfetti = useRef(makeFinisher<ConfettiEntry>(setConfetti)).current;
  const finishBanner = useRef(makeFinisher<BannerEntry>(setBanners)).current;
  const finishPromo = useRef(makeHiddenFinisher<PromoEntry>(setPromos)).current;
  const finishImplode = useRef(makeHiddenFinisher<ImplodeEntry>(setImplodes)).current;
  const finishCheckmate = useRef(makeHiddenFinisher<CheckmateEntry>(setCheckmates)).current;
  const finishLaser = useRef(makeFinisher<LaserEntry>(setLasers)).current;
  const finishDrawArrow = useRef(makeFinisher<DrawnArrowEntry>(setDrawnArrows)).current;

  const spawnBurst = useCallback((square: Square, options?: SquareBurstOptions): Promise<void> => {
    const { asWhite } = boardStateRef.current;
    const [col, row] = squareColRow(square, asWhite);
    const kind = options?.kind ?? 'both';
    const durationMs = Math.max(100, options?.durationMs ?? DEFAULT_BURST_DURATION_MS);
    const particles: Particle[] = [];
    if (kind !== 'shockwave') {
      const count = clamp(Math.round(options?.particleCount ?? 12), 4, 24);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = (0.4 + Math.random() * 0.7) * 100;
        particles.push({
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          size: 6 + Math.random() * 4,
          delayMs: Math.random() * 80,
          rotateDeg: (Math.random() * 2 - 1) * 180,
        });
      }
    }
    const entry: BurstEntry = {
      id: ++idRef.current,
      col,
      row,
      kind,
      color: options?.color ?? DEFAULT_BURST_COLOR,
      durationMs,
      particles,
    };
    return new Promise<void>((resolve) => {
      resolversRef.current.set(entry.id, resolve);
      setBursts(prev => [...prev, entry]);
    });
  }, []);

  const spawnBadge = useCallback((square: Square, options: PopBadgeOptions): Promise<void> => {
    const { asWhite } = boardStateRef.current;
    const [col, row] = squareColRow(square, asWhite);
    const entry: BadgeEntry = {
      id: ++idRef.current,
      col,
      row,
      text: options.text,
      color: options.color ?? '#ffffff',
      background: options.background ?? BRILLIANT_TEAL,
      durationMs: Math.max(400, options.durationMs ?? DEFAULT_BADGE_DURATION_MS),
      corner: options.corner ?? 'topRight',
    };
    return new Promise<void>((resolve) => {
      resolversRef.current.set(entry.id, resolve);
      setBadges(prev => [...prev, entry]);
    });
  }, []);

  const spawnFlash = useCallback((col: number, row: number, color: string): Promise<void> => {
    const entry: FlashEntry = {
      id: ++idRef.current,
      cxPct: (col + 0.5) * 12.5,
      cyPct: (row + 0.5) * 12.5,
      color,
      durationMs: FLASH_DURATION_MS,
    };
    return new Promise<void>((resolve) => {
      resolversRef.current.set(entry.id, resolve);
      setFlashes(prev => [...prev, entry]);
    });
  }, []);

  const spawnVictimBlast = useCallback((moveId: number, square: Square): Promise<void> | null => {
    const { pieces, asWhite } = boardStateRef.current;
    const victim = pieces.get(square);
    if (!victim) return null;
    const el = getPieceElementRef.current(square);
    if (el) {
      el.style.opacity = '0';
      hiddenVictimsRef.current.set(moveId, square);
    }
    const [col, row] = squareColRow(square, asWhite);
    const dir = col < 4 ? -1 : 1;
    const entry: BlastEntry = {
      id: ++idRef.current,
      pieceKey: `${victim.color}${victim.role.toUpperCase()}`,
      col,
      row,
      dxPct: dir * (120 + Math.random() * 100),
      risePct: -(90 + Math.random() * 60),
      rotateDeg: dir * (360 + Math.random() * 360),
      durationMs: VICTIM_BLAST_DURATION_MS,
    };
    return new Promise<void>((resolve) => {
      resolversRef.current.set(entry.id, resolve);
      setBlasts(prev => [...prev, entry]);
    });
  }, []);

  // Fired the instant the approach animation finishes — the piece is
  // touching the square on this exact frame.
  const runImpact = useCallback((entry: MoveEntry): Promise<void>[] => {
    const o = entry.opts;
    const fx: Promise<void>[] = [];
    o.onImpact?.();
    if (o.impactShake) {
      onImpactShakeRef.current?.({ intensity: o.impactShake.intensity, durationMs: o.impactShake.durationMs });
    }
    if (o.victimBlast) {
      const blast = spawnVictimBlast(entry.id, entry.toSquare);
      if (blast) fx.push(blast);
    }
    if (o.flash) {
      fx.push(spawnFlash(entry.toCol, entry.toRow, o.glowMaxPx > 0 ? o.glowColor : '#ffffff'));
    }
    if (o.sparkles || o.shockwave) {
      fx.push(spawnBurst(entry.toSquare, {
        kind: o.sparkles && o.shockwave ? 'both' : o.sparkles ? 'sparkles' : 'shockwave',
        color: o.glowMaxPx > 0 ? o.glowColor : undefined,
      }));
    }
    if (o.badge) {
      fx.push(spawnBadge(entry.toSquare, {
        text: o.badge,
        background: o.badgeColor,
        durationMs: MOVE_BADGE_DURATION_MS,
      }));
    }
    return fx;
  }, [spawnVictimBlast, spawnFlash, spawnBurst, spawnBadge]);

  const startMoveAnimation = useCallback((wrapper: HTMLDivElement, entry: MoveEntry) => {
    moveElsRef.current.set(entry.id, wrapper);
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);

    const hero = wrapper.querySelector<HTMLElement>('[data-cine-hero]');
    if (!hero || !canAnimate(hero)) {
      entry.opts.onImpact?.();
      finishMove(entry);
      return;
    }

    const o = entry.opts;
    const anims: Animation[] = [];

    if (o.reduced) {
      const glide = hero.animate(buildReducedGlideKeyframes(entry), {
        duration: o.durationMs, fill: 'forwards',
      });
      animationsRef.current.set(entry.id, [glide]);
      waitForAnimation(glide, o.durationMs).then(() => finishMove(entry));
      return;
    }

    const approachMs = Math.max(50, Math.round(o.durationMs * o.landStart));
    const settleMs = Math.max(50, o.durationMs - approachMs);
    const tailWaits: Promise<void>[] = [];

    const posApproach = hero.animate(buildApproachPositionKeyframes(entry), {
      duration: approachMs, easing: 'linear', fill: 'forwards',
    });
    anims.push(posApproach);

    const attitude = hero.firstElementChild?.firstElementChild;
    if (attitude && canAnimate(attitude)) {
      const attApproach = attitude.animate(buildApproachAttitudeKeyframes(entry), {
        duration: approachMs, easing: 'linear', fill: 'forwards',
      });
      anims.push(attApproach);
      tailWaits.push(waitForAnimation(attApproach, approachMs));
    }

    const ghosts = wrapper.querySelectorAll<HTMLElement>('[data-cine-trail]');
    ghosts.forEach((ghost, i) => {
      if (!canAnimate(ghost)) return;
      const delay = (i + 1) * TRAIL_GAP_MS;
      const peak = 0.32 * (1 - i / (ghosts.length + 1));
      const posGhost = ghost.animate(buildApproachPositionKeyframes(entry), {
        duration: approachMs, delay, easing: 'linear', fill: 'both',
      });
      const fade = ghost.animate(
        [
          { opacity: 0, offset: 0 },
          { opacity: peak, offset: Math.min(0.35, o.liftEnd / o.landStart + 0.12) },
          { opacity: peak * 0.7, offset: 0.85 },
          { opacity: 0, offset: 1 },
        ],
        { duration: approachMs, delay, easing: 'linear', fill: 'both' },
      );
      anims.push(posGhost, fade);
      tailWaits.push(waitForAnimation(posGhost, approachMs + delay));
    });

    animationsRef.current.set(entry.id, anims);

    waitForAnimation(posApproach, approachMs).then(() => {
      // Cleared mid-flight: clearCinematics already resolved the caller.
      if (!animationsRef.current.has(entry.id) || finishedRef.current.has(entry.id)) return;

      const fxWaits = runImpact(entry);

      if (attitude && canAnimate(attitude)) {
        const settle = attitude.animate(buildSettleAttitudeKeyframes(entry), {
          duration: settleMs, easing: 'linear', fill: 'forwards',
        });
        anims.push(settle);
        tailWaits.push(waitForAnimation(settle, settleMs));
      }

      Promise.all([...tailWaits, ...fxWaits]).then(() => finishMove(entry));
    });
  }, [finishMove, runImpact]);

  const startBurstAnimation = useCallback((container: HTMLDivElement, entry: BurstEntry) => {
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);

    const children = Array.from(container.children) as HTMLElement[];
    const anims: Animation[] = [];
    const waits: Promise<void>[] = [];
    let idx = 0;

    if (entry.kind !== 'sparkles') {
      const ring = children[idx++];
      if (ring && canAnimate(ring)) {
        const anim = ring.animate(
          [
            { transform: 'scale(0.3)', opacity: 0.9 },
            { transform: 'scale(2.2)', opacity: 0 },
          ],
          { duration: SHOCKWAVE_DURATION_MS, easing: 'ease-out', fill: 'forwards' },
        );
        anims.push(anim);
        waits.push(waitForAnimation(anim, SHOCKWAVE_DURATION_MS));
      }
    }
    if (entry.kind !== 'shockwave') {
      for (const p of entry.particles) {
        const el = children[idx++];
        if (!el || !canAnimate(el)) continue;
        const anim = el.animate(
          [
            { transform: 'translate(0%, 0%) rotate(0deg) scale(1)', opacity: 1 },
            { transform: `translate(${p.dx}%, ${p.dy}%) rotate(${p.rotateDeg}deg) scale(0)`, opacity: 0 },
          ],
          { duration: entry.durationMs, delay: p.delayMs, easing: 'cubic-bezier(0.12, 0.6, 0.3, 1)', fill: 'both' },
        );
        anims.push(anim);
        waits.push(waitForAnimation(anim, entry.durationMs + p.delayMs));
      }
    }

    if (anims.length === 0) {
      finishBurst(entry);
      return;
    }
    animationsRef.current.set(entry.id, anims);
    Promise.all(waits).then(() => finishBurst(entry));
  }, [finishBurst]);

  const startBadgeAnimation = useCallback((el: HTMLElement, entry: BadgeEntry) => {
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);

    if (!canAnimate(el)) {
      finishBadge(entry);
      return;
    }

    const duration = entry.durationMs;
    const pop = Math.min(0.4, 350 / duration);
    const fadeStart = Math.max(pop, 1 - 300 / duration);
    const anim = el.animate(
      [
        { transform: 'scale(0)', opacity: 0, offset: 0, easing: 'cubic-bezier(0.28, 1.18, 0.5, 1)' },
        { transform: 'scale(1.25)', opacity: 1, offset: pop * 0.6 },
        { transform: 'scale(0.95)', opacity: 1, offset: pop * 0.85 },
        { transform: 'scale(1)', opacity: 1, offset: pop },
        { transform: 'scale(1)', opacity: 1, offset: fadeStart },
        { transform: 'scale(0.85)', opacity: 0, offset: 1 },
      ],
      { duration, easing: 'ease-out', fill: 'forwards' },
    );
    animationsRef.current.set(entry.id, [anim]);
    waitForAnimation(anim, duration).then(() => finishBadge(entry));
  }, [finishBadge]);

  const startBlastAnimation = useCallback((el: HTMLElement, entry: BlastEntry) => {
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);

    if (!canAnimate(el)) {
      finishBlast(entry);
      return;
    }
    const anim = el.animate(
      [
        { transform: 'translate(0%, 0%) rotate(0deg) scale(1)', opacity: 1, offset: 0 },
        {
          transform: `translate(${entry.dxPct * 0.5}%, ${entry.risePct}%) rotate(${entry.rotateDeg * 0.45}deg) scale(0.8)`,
          opacity: 0.95,
          offset: 0.4,
        },
        {
          transform: `translate(${entry.dxPct}%, ${entry.risePct * 0.15}%) rotate(${entry.rotateDeg}deg) scale(0.25)`,
          opacity: 0,
          offset: 1,
        },
      ],
      { duration: entry.durationMs, easing: 'cubic-bezier(0.3, 0.5, 0.5, 1)', fill: 'forwards' },
    );
    animationsRef.current.set(entry.id, [anim]);
    waitForAnimation(anim, entry.durationMs).then(() => finishBlast(entry));
  }, [finishBlast]);

  const startFlashAnimation = useCallback((el: HTMLElement, entry: FlashEntry) => {
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);

    if (!canAnimate(el)) {
      finishFlash(entry);
      return;
    }
    const anim = el.animate(
      [
        { opacity: 0, offset: 0 },
        { opacity: 0.55, offset: 0.18 },
        { opacity: 0, offset: 1 },
      ],
      { duration: entry.durationMs, easing: 'ease-out', fill: 'forwards' },
    );
    animationsRef.current.set(entry.id, [anim]);
    waitForAnimation(anim, entry.durationMs).then(() => finishFlash(entry));
  }, [finishFlash]);

  const startConfettiAnimation = useCallback((container: HTMLDivElement, entry: ConfettiEntry) => {
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);

    const children = Array.from(container.children) as HTMLElement[];
    const anims: Animation[] = [];
    const waits: Promise<void>[] = [];
    entry.flakes.forEach((f, i) => {
      const el = children[i];
      if (!el || !canAnimate(el)) return;
      const fall = (110 / f.hPct) * 100;
      const sway = (f.swayPct / f.wPct) * 100;
      const anim = el.animate(
        [
          { transform: 'translate(0%, 0%) rotate(0deg)', opacity: 1, offset: 0 },
          { transform: `translate(${sway}%, ${fall * 0.28}%) rotate(${f.rotateDeg * 0.3}deg)`, opacity: 1, offset: 0.28 },
          { transform: `translate(${-sway * 0.7}%, ${fall * 0.58}%) rotate(${f.rotateDeg * 0.62}deg)`, opacity: 1, offset: 0.58 },
          { transform: `translate(${sway * 0.4}%, ${fall * 0.85}%) rotate(${f.rotateDeg * 0.86}deg)`, opacity: 0.9, offset: 0.85 },
          { transform: `translate(0%, ${fall}%) rotate(${f.rotateDeg}deg)`, opacity: 0, offset: 1 },
        ],
        { duration: f.fallMs, delay: f.delayMs, easing: 'linear', fill: 'both' },
      );
      anims.push(anim);
      waits.push(waitForAnimation(anim, f.fallMs + f.delayMs));
    });

    if (anims.length === 0) {
      finishConfetti(entry);
      return;
    }
    animationsRef.current.set(entry.id, anims);
    Promise.all(waits).then(() => finishConfetti(entry));
  }, [finishConfetti]);

  const startBannerAnimation = useCallback((el: HTMLElement, entry: BannerEntry) => {
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);

    if (!canAnimate(el)) {
      finishBanner(entry);
      return;
    }
    const duration = entry.durationMs;
    const popIn = Math.min(0.35, 420 / duration);
    const holdEnd = Math.max(popIn, 1 - Math.min(0.3, 500 / duration));
    const anim = el.animate(
      [
        { transform: 'scale(0.4)', opacity: 0, offset: 0, easing: 'cubic-bezier(0.28, 1.18, 0.5, 1)' },
        { transform: 'scale(1.08)', opacity: 1, offset: popIn * 0.7 },
        { transform: 'scale(1)', opacity: 1, offset: popIn },
        { transform: 'scale(1)', opacity: 1, offset: holdEnd },
        { transform: 'scale(1.15)', opacity: 0, offset: 1 },
      ],
      { duration, easing: 'ease-out', fill: 'forwards' },
    );
    animationsRef.current.set(entry.id, [anim]);
    waitForAnimation(anim, duration).then(() => finishBanner(entry));
  }, [finishBanner]);

  const startPromotionAnimation = useCallback((container: HTMLDivElement, entry: PromoEntry) => {
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);

    const c = entry.color;
    const d = entry.durationMs;
    const anims: Animation[] = [];
    const waits: Promise<void>[] = [];

    const pillar = container.querySelector<HTMLElement>('[data-promo-pillar]');
    if (pillar && canAnimate(pillar)) {
      const anim = pillar.animate(
        [
          { transform: 'scaleX(0.8) scaleY(0)', opacity: 0, offset: 0, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
          { transform: 'scaleX(1.1) scaleY(1)', opacity: 0.95, offset: 0.35, easing: 'ease-out' },
          { transform: 'scaleX(0.9) scaleY(1)', opacity: 0.85, offset: 0.7, easing: 'ease-in' },
          { transform: 'scaleX(0.7) scaleY(1.05)', opacity: 0, offset: 1 },
        ],
        { duration: d, fill: 'forwards' },
      );
      anims.push(anim);
      waits.push(waitForAnimation(anim, d));
    }

    const ring = container.querySelector<HTMLElement>('[data-promo-ring]');
    if (ring && canAnimate(ring)) {
      const ringMs = Math.max(50, Math.round(d * 0.55));
      const anim = ring.animate(
        [
          { transform: 'scale(0.3)', opacity: 0.9 },
          { transform: 'scale(2.2)', opacity: 0 },
        ],
        { duration: ringMs, easing: 'ease-out', fill: 'forwards' },
      );
      anims.push(anim);
      waits.push(waitForAnimation(anim, ringMs));
    }

    const flash = container.querySelector<HTMLElement>('[data-promo-flash]');
    if (flash && canAnimate(flash)) {
      const anim = flash.animate(
        [
          { opacity: 0, offset: 0 },
          { opacity: 0, offset: 0.38 },
          { opacity: 0.6, offset: 0.46 },
          { opacity: 0, offset: 0.6 },
          { opacity: 0, offset: 1 },
        ],
        { duration: d, easing: 'ease-out', fill: 'forwards' },
      );
      anims.push(anim);
      waits.push(waitForAnimation(anim, d));
    }

    const oldPiece = container.querySelector<HTMLElement>('[data-promo-old]');
    if (oldPiece && canAnimate(oldPiece)) {
      const oldMs = Math.max(50, Math.round(d * 0.5));
      const anim = oldPiece.animate(
        [
          { transform: 'scaleX(1) scaleY(1) rotateZ(0deg)', opacity: 1, offset: 0, easing: 'ease-in' },
          { transform: 'scaleX(0.6) scaleY(0.6) rotateZ(90deg)', opacity: 0.6, offset: 0.45, easing: 'ease-in' },
          { transform: 'scaleX(0.15) scaleY(0.15) rotateZ(180deg)', opacity: 0, offset: 1 },
        ],
        { duration: oldMs, fill: 'forwards' },
      );
      anims.push(anim);
      waits.push(waitForAnimation(anim, oldMs));
    }

    const newPiece = container.querySelector<HTMLElement>('[data-promo-new]');
    if (newPiece && canAnimate(newPiece)) {
      const newDelay = Math.round(d * 0.28);
      const newMs = Math.max(50, d - newDelay);
      const anim = newPiece.animate(
        [
          { transform: 'scale(0) rotateY(0deg)', opacity: 0, filter: `drop-shadow(0 0 0px ${c})`, offset: 0, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
          { transform: 'scale(0.3) rotateY(180deg)', opacity: 0.5, filter: `drop-shadow(0 0 8px ${c})`, offset: 0.25, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
          { transform: 'scale(1.15) rotateY(540deg)', opacity: 1, filter: `drop-shadow(0 0 18px ${c})`, offset: 0.6, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
          { transform: 'scale(1) rotateY(720deg)', opacity: 1, filter: `drop-shadow(0 0 6px ${c})`, offset: 1 },
        ],
        { duration: newMs, delay: newDelay, fill: 'both' },
      );
      anims.push(anim);
      waits.push(waitForAnimation(anim, newMs + newDelay));
    }

    if (anims.length === 0) {
      finishPromo(entry);
      return;
    }
    animationsRef.current.set(entry.id, anims);
    Promise.all(waits).then(() => finishPromo(entry));
  }, [finishPromo]);

  /**
   * The king topples. It pivots on its base like a real piece being tipped
   * over: a moment of tension, then gravity takes it, then it thuds flat and
   * kicks up dust. Timing is split 18% tension / 52% fall / 30% settle.
   */
  const startCheckmateAnimation = useCallback((container: HTMLDivElement, entry: CheckmateEntry) => {
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);

    const total = entry.durationMs;
    const waits: Promise<void>[] = [];
    const anims: Animation[] = [];
    const d = entry.dir;

    const piece = container.querySelector<HTMLElement>('[data-mate-piece]');
    if (piece && canAnimate(piece)) {
      // transformOrigin is the base of the piece, so rotateZ reads as tipping
      // rather than spinning about the middle.
      const fall = piece.animate(
        [
          { transform: 'rotateZ(0deg) translateY(0px)', offset: 0, easing: 'cubic-bezier(0.3, 0, 0.7, 0.2)' },
          // Rock back very slightly against the fall — the beat that sells it.
          { transform: `rotateZ(${-d * 4}deg) translateY(0px)`, offset: 0.18, easing: EASE_GRAVITY },
          // Gravity: most of the arc happens in the last third of the fall.
          { transform: `rotateZ(${d * 46}deg) translateY(0px)`, offset: 0.5, easing: 'cubic-bezier(0.6, 0, 0.9, 0.4)' },
          { transform: `rotateZ(${d * 88}deg) translateY(0px)`, offset: 0.7, easing: EASE_RECOVER },
          // Bounce once off the board, small and damped.
          { transform: `rotateZ(${d * 80}deg) translateY(-2%)`, offset: 0.79, easing: 'cubic-bezier(0.4, 0, 0.8, 0.5)' },
          { transform: `rotateZ(${d * 86}deg) translateY(0px)`, offset: 0.88, easing: EASE_RECOVER },
          { transform: `rotateZ(${d * 84}deg) translateY(0px)`, offset: 1 },
        ],
        { duration: total, easing: 'linear', fill: 'forwards' },
      );
      anims.push(fall);
      waits.push(waitForAnimation(fall, total));
    }

    const dust = container.querySelector<HTMLElement>('[data-mate-dust]');
    if (dust && canAnimate(dust)) {
      const dustMs = Math.round(total * 0.34);
      const a = dust.animate(
        [
          { transform: `translateX(${d * 8}%) scale(0.3)`, opacity: 0, offset: 0, easing: 'ease-out' },
          { transform: `translateX(${d * 26}%) scale(0.9)`, opacity: 0.5, offset: 0.35, easing: 'ease-out' },
          { transform: `translateX(${d * 44}%) scale(1.35)`, opacity: 0, offset: 1 },
        ],
        { duration: dustMs, delay: Math.round(total * 0.68), easing: 'linear', fill: 'both' },
      );
      anims.push(a);
      waits.push(waitForAnimation(a, dustMs + total * 0.68));
    }

    const dim = container.querySelector<HTMLElement>('[data-mate-dim]');
    if (dim && canAnimate(dim)) {
      const a = dim.animate(
        [
          { opacity: 0, offset: 0, easing: EASE_FLIGHT },
          { opacity: 1, offset: 0.7 },
          { opacity: 1, offset: 1 },
        ],
        { duration: total, easing: 'linear', fill: 'forwards' },
      );
      anims.push(a);
    }

    animationsRef.current.set(entry.id, anims);
    if (waits.length === 0) {
      finishCheckmate(entry);
      return;
    }
    Promise.all(waits).then(() => finishCheckmate(entry));
  }, [finishCheckmate]);

  /** Annotations animate in once, then persist until cleared. */
  const startAnnotationAnimation = useCallback((container: HTMLDivElement, entry: AnnotationEntry) => {
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);
    if (!canAnimate(container)) return;
    if (entry.reduced) {
      container.style.opacity = '1';
      return;
    }
    const frames: Keyframe[] = entry.enter === 'fade'
      ? [{ opacity: 0 }, { opacity: 1 }]
      : entry.enter === 'rise'
        ? [
            { transform: 'translateY(35%)', opacity: 0, easing: EASE_RECOVER },
            { transform: 'translateY(0)', opacity: 1 },
          ]
        : [
            { transform: 'scale(0.7)', opacity: 0, easing: 'cubic-bezier(0.28, 1.18, 0.5, 1)' },
            { transform: 'scale(1)', opacity: 1 },
          ];
    const anim = container.animate(frames, {
      duration: ANNOTATION_ENTER_MS, easing: 'linear', fill: 'forwards',
    });
    animationsRef.current.set(entry.id, [anim]);
  }, []);

  const startImplodeAnimation = useCallback((container: HTMLDivElement, entry: ImplodeEntry) => {
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);

    const d = entry.durationMs;
    const anims: Animation[] = [];
    const waits: Promise<void>[] = [];

    const rings = container.querySelectorAll<HTMLElement>('[data-implode-ring]');
    rings.forEach((ringEl, i) => {
      if (!canAnimate(ringEl)) return;
      const dir = i % 2 === 0 ? 1 : -1;
      const ringDelay = i * Math.round(d * 0.08);
      const anim = ringEl.animate(
        [
          { transform: `scale(1.6) rotateZ(0deg)`, opacity: 0, offset: 0, easing: 'cubic-bezier(0.42, 0, 0.58, 1)' },
          { transform: `scale(1.3) rotateZ(${dir * 90}deg)`, opacity: 0.7, offset: 0.2, easing: 'cubic-bezier(0.42, 0, 0.58, 1)' },
          { transform: `scale(1) rotateZ(${dir * 200}deg)`, opacity: 0.9, offset: 0.5, easing: 'cubic-bezier(0.55, 0, 0.7, 0.6)' },
          { transform: `scale(0) rotateZ(${dir * 360}deg)`, opacity: 0, offset: 1 },
        ],
        { duration: d - ringDelay, delay: ringDelay, fill: 'forwards' },
      );
      anims.push(anim);
      waits.push(waitForAnimation(anim, d));
    });

    const core = container.querySelector<HTMLElement>('[data-implode-core]');
    if (core && canAnimate(core)) {
      const anim = core.animate(
        [
          { transform: 'scale(0)', opacity: 0, offset: 0, easing: 'cubic-bezier(0.42, 0, 0.58, 1)' },
          { transform: 'scale(0.6)', opacity: 0.7, offset: 0.35, easing: 'cubic-bezier(0.42, 0, 0.58, 1)' },
          { transform: 'scale(1.4)', opacity: 0.95, offset: 0.7, easing: 'ease-in' },
          { transform: 'scale(0)', opacity: 0, offset: 1 },
        ],
        { duration: d, fill: 'forwards' },
      );
      anims.push(anim);
      waits.push(waitForAnimation(anim, d));
    }

    const piece = container.querySelector<HTMLElement>('[data-implode-piece]');
    if (piece && canAnimate(piece)) {
      const anim = piece.animate(
        [
          { transform: 'scaleX(1) scaleY(1) rotateZ(0deg)', opacity: 1, offset: 0, easing: 'cubic-bezier(0.42, 0, 0.58, 1)' },
          { transform: 'scaleX(0.8) scaleY(0.85) rotateZ(150deg)', opacity: 0.95, offset: 0.25, easing: 'cubic-bezier(0.55, 0, 0.7, 0.6)' },
          { transform: 'scaleX(0.4) scaleY(0.5) rotateZ(420deg)', opacity: 0.7, offset: 0.6, easing: 'cubic-bezier(0.55, 0, 0.7, 0.6)' },
          { transform: 'scaleX(0.05) scaleY(0.2) rotateZ(720deg)', opacity: 0, offset: 1 },
        ],
        { duration: d, fill: 'forwards' },
      );
      anims.push(anim);
      waits.push(waitForAnimation(anim, d));
    }

    const flash = container.querySelector<HTMLElement>('[data-implode-flash]');
    if (flash && canAnimate(flash)) {
      const anim = flash.animate(
        [
          { opacity: 0, offset: 0 },
          { opacity: 0, offset: 0.8 },
          { opacity: 0.5, offset: 0.9 },
          { opacity: 0, offset: 1 },
        ],
        { duration: d, easing: 'ease-out', fill: 'forwards' },
      );
      anims.push(anim);
      waits.push(waitForAnimation(anim, d));
    }

    if (anims.length === 0) {
      finishImplode(entry);
      return;
    }
    animationsRef.current.set(entry.id, anims);
    Promise.all(waits).then(() => finishImplode(entry));
  }, [finishImplode]);

  const startSpotlightAnimation = useCallback((el: HTMLDivElement, entry: SpotlightEntry) => {
    spotlightElsRef.current.set(entry.id, el);
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);

    if (!canAnimate(el)) return;
    const anim = el.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: entry.durationMs, easing: 'ease-out', fill: 'forwards' },
    );
    animationsRef.current.set(entry.id, [anim]);
  }, []);

  const startLaserAnimation = useCallback((container: HTMLDivElement, entry: LaserEntry) => {
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);

    const beam = container.querySelector<HTMLElement>('[data-laser-beam]');
    const tip = container.querySelector<HTMLElement>('[data-laser-tip]');
    if (!beam || !canAnimate(beam)) {
      finishLaser(entry);
      return;
    }
    const drawMs = entry.durationMs;
    const anims: Animation[] = [];
    const beamDraw = beam.animate(
      [
        { transform: `rotate(${entry.angle}deg) scaleX(0)`, opacity: 0, offset: 0 },
        { transform: `rotate(${entry.angle}deg) scaleX(0)`, opacity: 1, offset: 0.08, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' },
        { transform: `rotate(${entry.angle}deg) scaleX(1)`, opacity: 1, offset: 1 },
      ],
      { duration: drawMs, fill: 'forwards' },
    );
    anims.push(beamDraw);
    if (tip && canAnimate(tip)) {
      const dxPx = (entry.sx - entry.ex) / 100 * container.clientWidth;
      const dyPx = (entry.sy - entry.ey) / 100 * container.clientHeight;
      const tipAnim = tip.animate(
        [
          { transform: `translate(${dxPx}px, ${dyPx}px)`, opacity: 0, offset: 0, easing: 'linear' },
          { transform: `translate(${dxPx}px, ${dyPx}px)`, opacity: 1, offset: 0.08, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' },
          { transform: 'translate(0px, 0px)', opacity: 1, offset: 0.95, easing: 'ease-out' },
          { transform: 'translate(0px, 0px)', opacity: 0.85, offset: 1 },
        ],
        { duration: drawMs, fill: 'forwards' },
      );
      anims.push(tipAnim);
    }
    animationsRef.current.set(entry.id, anims);

    waitForAnimation(beamDraw, drawMs).then(() => {
      // Cleared mid-draw: clearCinematics already resolved the caller.
      if (!animationsRef.current.has(entry.id) || finishedRef.current.has(entry.id)) return;
      if (entry.persist) {
        // Resolve now but leave the beam on the board until clearCinematics.
        const resolve = resolversRef.current.get(entry.id);
        resolversRef.current.delete(entry.id);
        resolve?.();
        return;
      }
      const fadeBeam = beam.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: LASER_FADE_MS, delay: entry.holdMs, easing: 'ease-out', fill: 'forwards' },
      );
      const current = animationsRef.current.get(entry.id) ?? [];
      current.push(fadeBeam);
      if (tip && canAnimate(tip)) {
        const fadeTip = tip.animate(
          [{ opacity: 0.85 }, { opacity: 0 }],
          { duration: LASER_FADE_MS, delay: entry.holdMs, easing: 'ease-out', fill: 'forwards' },
        );
        current.push(fadeTip);
      }
      animationsRef.current.set(entry.id, current);
      waitForAnimation(fadeBeam, LASER_FADE_MS + entry.holdMs).then(() => finishLaser(entry));
    });
  }, [finishLaser]);

  const startDrawArrowAnimation = useCallback((svg: SVGSVGElement, entry: DrawnArrowEntry) => {
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);

    const shaft = svg.querySelector<SVGPathElement>('[data-draw-arrow-shaft]');
    const head = svg.querySelector<SVGPathElement>('[data-draw-arrow-head]');
    if (!shaft || !head) {
      finishDrawArrow(entry);
      return;
    }

    const rect = svg.getBoundingClientRect();
    const scale = 8 / Math.max(rect.width, 1);
    const sx = -4 + (entry.sx * 8) / 100;
    const sy = -4 + (entry.sy * 8) / 100;
    const ex = -4 + (entry.ex * 8) / 100;
    const ey = -4 + (entry.ey * 8) / 100;
    const hl = entry.headLengthPx * scale;
    const hw = entry.headWidthPx * scale;
    const angle = Math.atan2(ey - sy, ex - sx);

    const shaftEndX = ex - Math.cos(angle) * hl;
    const shaftEndY = ey - Math.sin(angle) * hl;
    const base1X = shaftEndX - Math.sin(angle) * (hw / 2);
    const base1Y = shaftEndY + Math.cos(angle) * (hw / 2);
    const base2X = shaftEndX + Math.sin(angle) * (hw / 2);
    const base2Y = shaftEndY - Math.cos(angle) * (hw / 2);

    shaft.setAttribute('d', `M${sx.toFixed(4)},${sy.toFixed(4)} L${shaftEndX.toFixed(4)},${shaftEndY.toFixed(4)}`);
    head.setAttribute('d', `M${base1X.toFixed(4)},${base1Y.toFixed(4)} L${ex.toFixed(4)},${ey.toFixed(4)} L${base2X.toFixed(4)},${base2Y.toFixed(4)} Z`);

    const pathLength = shaft.getTotalLength();
    if (!Number.isFinite(pathLength) || pathLength <= 0) {
      finishDrawArrow(entry);
      return;
    }

    shaft.style.strokeDasharray = `${pathLength}`;
    shaft.style.strokeDashoffset = `${pathLength}`;

    const anims: Animation[] = [];
    const drawMs = entry.durationMs;

    const shaftDraw = shaft.animate(
      [{ strokeDashoffset: pathLength }, { strokeDashoffset: 0 }],
      { duration: drawMs, easing: 'ease-out', fill: 'forwards' },
    );
    anims.push(shaftDraw);

    if (canAnimate(head)) {
      const headFadeMs = Math.max(100, drawMs * 0.3);
      const headDelay = Math.max(0, drawMs - headFadeMs);
      const headAppear = head.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: headFadeMs, delay: headDelay, fill: 'forwards', easing: 'ease-out' },
      );
      anims.push(headAppear);
    }

    animationsRef.current.set(entry.id, anims);

    waitForAnimation(shaftDraw, drawMs).then(() => {
      if (!animationsRef.current.has(entry.id) || finishedRef.current.has(entry.id)) return;
      if (entry.persist) {
        const resolve = resolversRef.current.get(entry.id);
        resolversRef.current.delete(entry.id);
        resolve?.();
        return;
      }
      const fadeShaft = shaft.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: DRAW_ARROW_FADE_MS, delay: entry.holdMs, easing: 'ease-out', fill: 'forwards' },
      );
      const fadeHead = head.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: DRAW_ARROW_FADE_MS, delay: entry.holdMs, easing: 'ease-out', fill: 'forwards' },
      );
      const current = animationsRef.current.get(entry.id) ?? [];
      current.push(fadeShaft, fadeHead);
      animationsRef.current.set(entry.id, current);
      waitForAnimation(fadeShaft, DRAW_ARROW_FADE_MS + entry.holdMs).then(() => finishDrawArrow(entry));
    });
  }, [finishDrawArrow]);

  /**
   * Choreographed flight of the piece on `from` to `to`. The real piece on
   * `from` is hidden during the flight and restored on cleanup. Resolves
   * after the landing effects finish — commit the real move then (same
   * contract as the teaching animateMove).
   */
  const cinematicMove = useCallback((from: Square, to: Square, options?: CinematicMoveOptions): Promise<void> => {
    if (!isValidSquare(from) || !isValidSquare(to) || from === to) {
      return Promise.resolve();
    }
    const { pieces, asWhite } = boardStateRef.current;
    const existing = pieces.get(from);
    const pieceKey = options?.piece
      ?? (existing ? `${existing.color}${existing.role.toUpperCase()}` : undefined);
    if (!pieceKey) return Promise.resolve();

    const reduced = prefersReducedMotion() && !options?.force;
    const [fromCol, fromRow] = squareColRow(from, asWhite);
    const [toCol, toRow] = squareColRow(to, asWhite);

    const entry: MoveEntry = {
      id: ++idRef.current,
      pieceKey,
      fromCol,
      fromRow,
      toCol,
      toRow,
      toSquare: to,
      hiddenSquare: existing ? from : null,
      opts: resolveMoveOptions(options, reduced),
    };

    if (entry.hiddenSquare) {
      const orig = getPieceElementRef.current(entry.hiddenSquare);
      if (orig) orig.style.opacity = '0';
    }

    return new Promise<void>((resolve) => {
      resolversRef.current.set(entry.id, resolve);
      setMoves(prev => [...prev, entry]);
    });
  }, []);

  const squareBurst = useCallback((square: Square, options?: SquareBurstOptions): Promise<void> => {
    if (!isValidSquare(square)) return Promise.resolve();
    if (prefersReducedMotion() && !options?.force) return Promise.resolve();
    return spawnBurst(square, options);
  }, [spawnBurst]);

  const popBadge = useCallback((square: Square, options: PopBadgeOptions): Promise<void> => {
    if (!isValidSquare(square) || !options?.text) return Promise.resolve();
    if (prefersReducedMotion() && !options?.force) return Promise.resolve();
    return spawnBadge(square, options);
  }, [spawnBadge]);

  const celebrate = useCallback((options?: CelebrateOptions): Promise<void> => {
    if (prefersReducedMotion() && !options?.force) return Promise.resolve();
    const kind = options?.kind ?? 'both';
    const durationMs = Math.max(400, options?.durationMs ?? DEFAULT_CELEBRATE_DURATION_MS);
    const colors = options?.colors && options.colors.length > 0 ? options.colors : CELEBRATE_COLORS;
    const scale = durationMs / DEFAULT_CELEBRATE_DURATION_MS;
    const parts: Promise<void>[] = [];

    if (kind !== 'fireworks') {
      const flakes: Flake[] = [];
      for (let i = 0; i < 42; i++) {
        const wPct = 0.9 + Math.random() * 0.7;
        flakes.push({
          leftPct: Math.random() * 98,
          delayMs: Math.random() * 450 * scale,
          fallMs: (1300 + Math.random() * 800) * scale,
          color: colors[i % colors.length],
          wPct,
          hPct: 0.5 + Math.random() * 0.6,
          swayPct: (2 + Math.random() * 5) * (Math.random() < 0.5 ? -1 : 1),
          rotateDeg: (Math.random() * 2 - 1) * 900,
          round: Math.random() < 0.35,
        });
      }
      const entry: ConfettiEntry = { id: ++idRef.current, flakes };
      parts.push(new Promise<void>((resolve) => {
        resolversRef.current.set(entry.id, resolve);
        setConfetti(prev => [...prev, entry]);
      }));
    }

    if (kind !== 'confetti') {
      const files = 'abcdefgh';
      const burstCount = 5;
      for (let i = 0; i < burstCount; i++) {
        const square = `${files[1 + Math.floor(Math.random() * 6)]}${2 + Math.floor(Math.random() * 6)}` as Square;
        const color = colors[i % colors.length];
        parts.push(new Promise<void>((resolve) => {
          const fwId = ++idRef.current;
          resolversRef.current.set(fwId, resolve);
          const tid = setTimeout(() => {
            timeoutsRef.current.delete(fwId);
            // Cleared while pending: the sweep already resolved us.
            if (!resolversRef.current.has(fwId)) return;
            spawnBurst(square, { kind: 'both', color, particleCount: 16 }).then(() => {
              resolversRef.current.delete(fwId);
              resolve();
            });
          }, i * 170 * scale);
          timeoutsRef.current.set(fwId, tid);
        }));
      }
    }

    if (parts.length === 0) return Promise.resolve();
    return Promise.all(parts).then(() => undefined);
  }, [spawnBurst]);

  const popBanner = useCallback((options: PopBannerOptions): Promise<void> => {
    if (!options?.text) return Promise.resolve();
    if (prefersReducedMotion() && !options.force) return Promise.resolve();
    const entry: BannerEntry = {
      id: ++idRef.current,
      text: options.text,
      color: options.color ?? '#ffffff',
      background: options.background,
      glowColor: options.glowColor ?? BRILLIANT_TEAL,
      durationMs: Math.max(500, options.durationMs ?? DEFAULT_BANNER_DURATION_MS),
    };
    return new Promise<void>((resolve) => {
      resolversRef.current.set(entry.id, resolve);
      setBanners(prev => [...prev, entry]);
    });
  }, []);

  /**
   * "Evolution" pillar of light that morphs the piece on `square` into a new
   * one. The real piece is hidden and restored on cleanup; the promise
   * resolves while the revealed piece (fill: forwards) still covers the
   * square — commit the real promotion then (same contract as cinematicMove).
   */
  const promotionBeam = useCallback((square: Square, options?: PromotionBeamOptions): Promise<void> => {
    if (!isValidSquare(square)) return Promise.resolve();
    if (prefersReducedMotion() && !options?.force) return Promise.resolve();

    const { pieces, asWhite } = boardStateRef.current;
    const existing = pieces.get(square);
    const fromPieceKey = options?.fromPiece
      ?? (existing ? `${existing.color}${existing.role.toUpperCase()}` : undefined);
    const toPieceKey = options?.piece;

    const [col, row] = squareColRow(square, asWhite);
    const entry: PromoEntry = {
      id: ++idRef.current,
      col,
      row,
      color: options?.color ?? DEFAULT_PROMOTION_BEAM_COLOR,
      durationMs: Math.max(100, options?.durationMs ?? DEFAULT_PROMOTION_BEAM_DURATION_MS),
      fromPieceKey,
      toPieceKey,
    };

    if (existing) {
      const orig = getPieceElementRef.current(square);
      if (orig) {
        orig.style.opacity = '0';
        hiddenSquaresRef.current.set(entry.id, square);
      }
    }

    return new Promise<void>((resolve) => {
      resolversRef.current.set(entry.id, resolve);
      setPromos(prev => [...prev, entry]);
    });
  }, []);

  /**
   * Collapse the piece on `square` into a swirling black-hole vortex. The real
   * piece is hidden and restored on cleanup; commit the capture/removal when
   * the promise resolves.
   */
  const implode = useCallback((square: Square, options?: ImplodeOptions): Promise<void> => {
    if (!isValidSquare(square)) return Promise.resolve();
    if (prefersReducedMotion() && !options?.force) return Promise.resolve();

    const { pieces, asWhite } = boardStateRef.current;
    const existing = pieces.get(square);
    const pieceKey = options?.piece
      ?? (existing ? `${existing.color}${existing.role.toUpperCase()}` : undefined);

    const [col, row] = squareColRow(square, asWhite);
    const entry: ImplodeEntry = {
      id: ++idRef.current,
      col,
      row,
      color: options?.color ?? DEFAULT_IMPLODE_COLOR,
      durationMs: Math.max(100, options?.durationMs ?? DEFAULT_IMPLODE_DURATION_MS),
      pieceKey,
    };

    if (existing) {
      const orig = getPieceElementRef.current(square);
      if (orig) {
        orig.style.opacity = '0';
        hiddenSquaresRef.current.set(entry.id, square);
      }
    }

    return new Promise<void>((resolve) => {
      resolversRef.current.set(entry.id, resolve);
      setImplodes(prev => [...prev, entry]);
    });
  }, []);

  /**
   * Topple the king on `square`. Does not change the position — the game is
   * already over; this is the closing beat.
   */
  const checkmate = useCallback((square: Square, options?: CheckmateOptions): Promise<void> => {
    if (!isValidSquare(square)) return Promise.resolve();
    const reduced = prefersReducedMotion() && !options?.force;

    const { pieces, asWhite } = boardStateRef.current;
    const existing = pieces.get(square);
    const pieceKey = options?.piece
      ?? (existing ? `${existing.color}${existing.role.toUpperCase()}` : undefined);
    const color = options?.color ?? DEFAULT_CHECKMATE_COLOR;
    const bannerText = options?.banner === undefined ? 'CHECKMATE' : options.banner;

    // Reduced motion: skip the fall, keep the announcement.
    if (reduced) {
      return bannerText ? popBanner({ text: bannerText, glowColor: color }) : Promise.resolve();
    }

    const [col, row] = squareColRow(square, asWhite);
    // 'auto' tips the king away from the middle of the board, so it falls into
    // open space instead of over its own defenders.
    const dir: 1 | -1 = options?.direction === 'left'
      ? -1
      : options?.direction === 'right'
        ? 1
        : col <= 3 ? -1 : 1;

    const entry: CheckmateEntry = {
      id: ++idRef.current,
      col,
      row,
      dir,
      color,
      durationMs: Math.max(200, options?.durationMs ?? DEFAULT_CHECKMATE_DURATION_MS),
      dim: options?.dim ?? true,
      pieceKey,
    };

    if (existing) {
      const orig = getPieceElementRef.current(square);
      if (orig) {
        orig.style.opacity = '0';
        hiddenSquaresRef.current.set(entry.id, square);
      }
    }

    const toppled = new Promise<void>((resolve) => {
      resolversRef.current.set(entry.id, resolve);
      setCheckmates(prev => [...prev, entry]);
    });

    if (!bannerText) return toppled;
    // The banner lands with the king rather than after it.
    return toppled.then(() => popBanner({ text: bannerText, glowColor: color }));
  }, [popBanner]);

  /**
   * Pin animated text over a square. Returns a handle: `setText` swaps the
   * text without replaying the entry animation, `clear` fades it out.
   */
  const annotate = useCallback((
    square: Square, text: string, options?: AnnotationOptions,
  ): AnnotationHandle => {
    const noop: AnnotationHandle = { setText: () => {}, clear: () => Promise.resolve() };
    if (!isValidSquare(square)) return noop;

    const { asWhite } = boardStateRef.current;
    const [col, row] = squareColRow(square, asWhite);
    const id = ++idRef.current;
    const size = options?.fontSize;
    const entry: AnnotationEntry = {
      id,
      col,
      row,
      text,
      color: options?.color ?? '#ffffff',
      background: options?.background ?? DEFAULT_ANNOTATION_BG,
      corner: options?.corner ?? 'center',
      fontSize: typeof size === 'number' ? `${size}px` : size,
      enter: options?.enter ?? 'pop',
      reduced: prefersReducedMotion() && !options?.force,
    };
    setAnnotations(prev => [...prev, entry]);

    let cleared = false;
    const remove = () => {
      annotationTimersRef.current.delete(id);
      setAnnotations(prev => prev.filter(a => a.id !== id));
      startedRef.current.delete(id);
      animationsRef.current.delete(id);
    };

    if (options?.durationMs !== undefined) {
      const tid = setTimeout(() => { void handle.clear(); }, Math.max(0, options.durationMs));
      annotationTimersRef.current.set(id, tid);
    }

    const handle: AnnotationHandle = {
      setText: (next: string) => {
        if (cleared) return;
        setAnnotations(prev => prev.map(a => (a.id === id ? { ...a, text: next } : a)));
      },
      clear: (durationMs?: number) => {
        if (cleared) return Promise.resolve();
        cleared = true;
        const tid = annotationTimersRef.current.get(id);
        if (tid !== undefined) clearTimeout(tid);
        annotationTimersRef.current.delete(id);
        const el = annotationElsRef.current.get(id);
        const ms = Math.max(0, durationMs ?? ANNOTATION_EXIT_MS);
        if (!el || !canAnimate(el) || ms === 0) {
          remove();
          return Promise.resolve();
        }
        const out = el.animate(
          [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.85)' }],
          { duration: ms, easing: EASE_FLIGHT, fill: 'forwards' },
        );
        return waitForAnimation(out, ms).then(remove);
      },
    };
    return handle;
  }, []);

  /**
   * 3D teleport-swap of a castle: king and rook fly simultaneously (the rook
   * arcs lower so they pass without colliding). A thin wrapper over two
   * concurrent cinematicMove flights. Commit the real castle when it resolves.
   */
  const castleSwap = useCallback((
    kingFrom: Square, kingTo: Square, rookFrom: Square, rookTo: Square, options?: CastleSwapOptions,
  ): Promise<void> => {
    if (![kingFrom, kingTo, rookFrom, rookTo].every(isValidSquare)) return Promise.resolve();
    if (prefersReducedMotion() && !options?.force) return Promise.resolve();

    const arc = options?.arcHeight ?? 0.9;
    const common: CinematicMoveOptions = {
      style: 'great',
      durationMs: options?.durationMs ?? DEFAULT_CASTLE_SWAP_DURATION_MS,
      spins: options?.spins ?? 1,
      glowColor: options?.glowColor ?? DEFAULT_CASTLE_SWAP_GLOW,
      sparkles: false,
      shockwave: false,
      flash: false,
      victimBlast: false,
      impactShake: false,
      trail: false,
      force: options?.force,
    };
    const king = cinematicMove(kingFrom, kingTo, { ...common, arcHeight: arc });
    const rook = cinematicMove(rookFrom, rookTo, { ...common, arcHeight: arc * 0.4 });
    return Promise.all([king, rook]).then(() => undefined);
  }, [cinematicMove]);

  /**
   * Dim the whole board except spotlight holes over `squares`. Persists until
   * the returned handle's `clear()` runs (or clearCinematics). Returns a no-op
   * handle when reduced motion is preferred (unless force).
   */
  const spotlight = useCallback((squares: Square[], options?: SpotlightOptions): SpotlightHandle => {
    if (prefersReducedMotion() && !options?.force) return { clear: () => Promise.resolve() };
    const valid = squares.filter(isValidSquare);
    if (valid.length === 0) return { clear: () => Promise.resolve() };

    const { asWhite } = boardStateRef.current;
    const rPct = (options?.radius ?? DEFAULT_SPOTLIGHT_RADIUS) * 12.5;
    const holes: SpotHole[] = valid.map((sq) => {
      const [col, row] = squareColRow(sq, asWhite);
      return { cx: (col + 0.5) * 12.5, cy: (row + 0.5) * 12.5, r: rPct };
    });
    const entry: SpotlightEntry = {
      id: ++idRef.current,
      holes,
      color: options?.color ?? DEFAULT_SPOTLIGHT_COLOR,
      durationMs: Math.max(50, options?.durationMs ?? DEFAULT_SPOTLIGHT_DURATION_MS),
    };
    setSpotlights(prev => [...prev, entry]);

    let cleared = false;
    const clear = (durationMs?: number): Promise<void> => {
      if (cleared) return Promise.resolve();
      cleared = true;
      return new Promise<void>((resolve) => {
        const fadeMs = Math.max(1, durationMs ?? entry.durationMs);
        const existing = animationsRef.current.get(entry.id) ?? [];
        const el = spotlightElsRef.current.get(entry.id);
        const remove = () => {
          for (const a of (animationsRef.current.get(entry.id) ?? [])) a.cancel();
          animationsRef.current.delete(entry.id);
          startedRef.current.delete(entry.id);
          spotlightElsRef.current.delete(entry.id);
          setSpotlights(prev => prev.filter(s => s.id !== entry.id));
          resolve();
        };
        if (el && canAnimate(el)) {
          const from = (typeof getComputedStyle === 'function' && getComputedStyle(el).opacity) || '1';
          const fade = el.animate(
            [{ opacity: from }, { opacity: 0 }],
            { duration: fadeMs, easing: 'ease-out', fill: 'forwards' },
          );
          animationsRef.current.set(entry.id, [...existing, fade]);
          waitForAnimation(fade, fadeMs).then(remove);
        } else {
          remove();
        }
      });
    };
    return { clear };
  }, []);

  /** Animated glowing threat beam from `from` to `to` (HTML, no SVG). */
  const drawLaser = useCallback((from: Square, to: Square, options?: LaserOptions): Promise<void> => {
    if (!isValidSquare(from) || !isValidSquare(to)) return Promise.resolve();
    if (prefersReducedMotion() && !options?.force) return Promise.resolve();

    const { asWhite } = boardStateRef.current;
    const [fc, fr] = squareColRow(from, asWhite);
    const [tc, tr] = squareColRow(to, asWhite);
    const sx = (fc + 0.5) * 12.5;
    const sy = (fr + 0.5) * 12.5;
    const ex = (tc + 0.5) * 12.5;
    const ey = (tr + 0.5) * 12.5;
    const dxp = ex - sx;
    const dyp = ey - sy;
    const color = options?.color ?? DEFAULT_LASER_COLOR;
    const entry: LaserEntry = {
      id: ++idRef.current,
      sx,
      sy,
      ex,
      ey,
      dist: Math.hypot(dxp, dyp),
      angle: Math.atan2(dyp, dxp) * 180 / Math.PI,
      color,
      glowColor: options?.glowColor ?? color,
      widthPx: Math.max(1, options?.widthPx ?? DEFAULT_LASER_WIDTH_PX),
      durationMs: Math.max(50, options?.durationMs ?? DEFAULT_LASER_DURATION_MS),
      persist: options?.persist ?? false,
      holdMs: Math.max(0, options?.holdMs ?? DEFAULT_LASER_HOLD_MS),
    };

    return new Promise<void>((resolve) => {
      resolversRef.current.set(entry.id, resolve);
      setLasers(prev => [...prev, entry]);
    });
  }, []);

  /** Draw an arrow slowly from `from` to `to` (SVG, shaft draws then head fades in). */
  const drawArrow = useCallback((from: Square, to: Square, options?: DrawArrowOptions): Promise<void> => {
    if (!isValidSquare(from) || !isValidSquare(to)) return Promise.resolve();
    if (prefersReducedMotion() && !options?.force) return Promise.resolve();

    const { asWhite } = boardStateRef.current;
    const [fc, fr] = squareColRow(from, asWhite);
    const [tc, tr] = squareColRow(to, asWhite);
    const color = options?.color ?? DEFAULT_DRAW_ARROW_COLOR;
    const entry: DrawnArrowEntry = {
      id: ++idRef.current,
      sx: (fc + 0.5) * 12.5,
      sy: (fr + 0.5) * 12.5,
      ex: (tc + 0.5) * 12.5,
      ey: (tr + 0.5) * 12.5,
      color,
      glowColor: options?.glowColor ?? color,
      widthPx: Math.max(1, options?.widthPx ?? DEFAULT_DRAW_ARROW_WIDTH_PX),
      headLengthPx: Math.max(4, options?.headLengthPx ?? DEFAULT_DRAW_ARROW_HEAD_LENGTH_PX),
      headWidthPx: Math.max(4, options?.headWidthPx ?? DEFAULT_DRAW_ARROW_HEAD_WIDTH_PX),
      durationMs: Math.max(50, options?.durationMs ?? DEFAULT_DRAW_ARROW_DURATION_MS),
      persist: options?.persist ?? false,
      holdMs: Math.max(0, options?.holdMs ?? DEFAULT_DRAW_ARROW_HOLD_MS),
    };

    return new Promise<void>((resolve) => {
      resolversRef.current.set(entry.id, resolve);
      setDrawnArrows(prev => [...prev, entry]);
    });
  }, []);

  const clearCinematics = useCallback(() => {
    for (const anims of Array.from(animationsRef.current.values())) {
      for (const anim of anims) anim.cancel();
    }
    animationsRef.current.clear();
    for (const tid of timeoutsRef.current.values()) clearTimeout(tid);
    timeoutsRef.current.clear();
    for (const entry of movesRef.current) {
      if (entry.hiddenSquare) {
        const orig = getPieceElementRef.current(entry.hiddenSquare);
        if (orig) orig.style.opacity = '';
      }
    }
    for (const square of hiddenVictimsRef.current.values()) {
      const el = getPieceElementRef.current(square);
      if (el) el.style.opacity = '';
    }
    hiddenVictimsRef.current.clear();
    for (const square of hiddenSquaresRef.current.values()) {
      const el = getPieceElementRef.current(square);
      if (el) el.style.opacity = '';
    }
    hiddenSquaresRef.current.clear();
    spotlightElsRef.current.clear();
    moveElsRef.current.clear();
    for (const tid of annotationTimersRef.current.values()) clearTimeout(tid);
    annotationTimersRef.current.clear();
    annotationElsRef.current.clear();
    const resolvers = Array.from(resolversRef.current.values());
    resolversRef.current.clear();
    startedRef.current.clear();
    finishedRef.current.clear();
    setMoves([]);
    setBursts([]);
    setBadges([]);
    setBlasts([]);
    setFlashes([]);
    setConfetti([]);
    setBanners([]);
    setPromos([]);
    setImplodes([]);
    setCheckmates([]);
    setAnnotations([]);
    setSpotlights([]);
    setLasers([]);
    setDrawnArrows([]);
    for (const resolve of resolvers) resolve();
  }, []);

  useImperativeHandle(ref, () => ({
    cinematicMove,
    squareBurst,
    popBadge,
    celebrate,
    popBanner,
    promotionBeam,
    implode,
    checkmate,
    annotate,
    castleSwap,
    spotlight,
    drawLaser,
    drawArrow,
    clearCinematics,
  }), [cinematicMove, squareBurst, popBadge, celebrate, popBanner, promotionBeam, implode, checkmate, annotate, castleSwap, spotlight, drawLaser, drawArrow, clearCinematics]);

  useEffect(() => {
    return () => {
      for (const anims of animationsRef.current.values()) {
        for (const anim of anims) anim.cancel();
      }
      animationsRef.current.clear();
      for (const tid of timeoutsRef.current.values()) clearTimeout(tid);
      timeoutsRef.current.clear();
      for (const tid of annotationTimersRef.current.values()) clearTimeout(tid);
      annotationTimersRef.current.clear();
      annotationElsRef.current.clear();
      for (const square of hiddenSquaresRef.current.values()) {
        const el = getPieceElementRef.current(square);
        if (el) el.style.opacity = '';
      }
      hiddenSquaresRef.current.clear();
      for (const resolve of resolversRef.current.values()) resolve();
      resolversRef.current.clear();
    };
  }, []);

  if (
    moves.length === 0 && bursts.length === 0 && badges.length === 0
    && blasts.length === 0 && flashes.length === 0 && confetti.length === 0
    && banners.length === 0 && promos.length === 0 && implodes.length === 0
    && checkmates.length === 0 && annotations.length === 0
    && spotlights.length === 0 && lasers.length === 0 && drawnArrows.length === 0
  ) return null;

  const pieceBox = { width: '12.5%', height: '12.5%' } as const;

  return (
    <div data-cine-overlay style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 10 }}>
      {flashes.map((f) => (
        <div
          key={`flash-${f.id}`}
          ref={(el) => { if (el) startFlashAnimation(el, f); }}
          style={{
            position: 'absolute',
            inset: 0,
            background: [
              `radial-gradient(circle at ${f.cxPct}% ${f.cyPct}%, #ffffff 0%, transparent 28%)`,
              `radial-gradient(circle at ${f.cxPct}% ${f.cyPct}%, ${f.color} 0%, transparent 62%)`,
            ].join(', '),
            opacity: 0,
            willChange: 'opacity',
            zIndex: 2,
          }}
        />
      ))}
      {bursts.map((b) => (
        <div
          key={`burst-${b.id}`}
          ref={(el) => { if (el) startBurstAnimation(el, b); }}
          style={{
            position: 'absolute',
            ...pieceBox,
            transform: positionTransform(b.col, b.row),
            pointerEvents: 'none',
            zIndex: 4,
          }}
        >
          {b.kind !== 'sparkles' && (
            <div
              style={{
                position: 'absolute',
                inset: '8%',
                borderRadius: '50%',
                border: `3px solid ${b.color}`,
                boxShadow: `0 0 10px ${b.color}`,
                opacity: 0,
                willChange: 'transform, opacity',
              }}
            />
          )}
          {b.kind !== 'shockwave' && b.particles.map((p, i) => (
            <div
              key={i}
              style={{ position: 'absolute', inset: 0, opacity: 0, willChange: 'transform, opacity' }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: `${p.size}%`,
                  height: `${p.size}%`,
                  marginLeft: `${-p.size / 2}%`,
                  marginTop: `${-p.size / 2}%`,
                  borderRadius: '50%',
                  background: b.color,
                  boxShadow: `0 0 6px ${b.color}`,
                }}
              />
            </div>
          ))}
        </div>
      ))}
      {blasts.map((bl) => (
        <div
          key={`blast-${bl.id}`}
          style={{
            position: 'absolute',
            ...pieceBox,
            transform: positionTransform(bl.col, bl.row),
            pointerEvents: 'none',
            zIndex: 4,
          }}
        >
          <div
            ref={(el) => { if (el) startBlastAnimation(el, bl); }}
            style={{ width: '100%', height: '100%', willChange: 'transform, opacity' }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                transform: flipPieces ? 'rotate(180deg)' : undefined,
                transformOrigin: 'center center',
              }}
            >
              <PieceGlyph pieceKey={bl.pieceKey} pieceSet={pieceSet} customPieces={customPieces} />
            </div>
          </div>
        </div>
      ))}
      {badges.map((bd) => (
        <div
          key={`badge-${bd.id}`}
          style={{
            position: 'absolute',
            ...pieceBox,
            transform: positionTransform(bd.col, bd.row),
            pointerEvents: 'none',
            zIndex: 5,
          }}
        >
          <span
            style={{
              position: 'absolute',
              ...(bd.corner === 'center'
                ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
                : { top: '-6%', right: '-6%' }),
            }}
          >
            <span
              ref={(el) => { if (el) startBadgeAnimation(el, bd); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '1.6em',
                height: '1.6em',
                padding: '0 0.3em',
                borderRadius: '999px',
                background: bd.background,
                color: bd.color,
                fontSize: 'clamp(10px, 2.4vmin, 20px)',
                fontWeight: 800,
                fontFamily: 'system-ui, sans-serif',
                lineHeight: 1,
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.35)',
                opacity: 0,
                willChange: 'transform, opacity',
              }}
            >
              {bd.text}
            </span>
          </span>
        </div>
      ))}
      {moves.map((m) => (
        <div
          key={`cine-${m.id}`}
          ref={(el) => { if (el) startMoveAnimation(el, m); }}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}
        >
          {Array.from({ length: m.opts.trailCount }, (_, i) => (
            <div
              key={`trail-${i}`}
              data-cine-trail
              style={{
                position: 'absolute',
                ...pieceBox,
                transform: positionTransform(m.fromCol, m.fromRow),
                opacity: 0,
                willChange: 'transform, opacity',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  transform: `${flipPieces ? 'rotate(180deg) ' : ''}scale(${0.92 - i * 0.05})`,
                  transformOrigin: 'center center',
                  filter: 'blur(1px)',
                }}
              >
                <PieceGlyph pieceKey={m.pieceKey} pieceSet={pieceSet} customPieces={customPieces} />
              </div>
            </div>
          ))}
          <div
            data-cine-hero
            style={{
              position: 'absolute',
              ...pieceBox,
              transform: positionTransform(m.fromCol, m.fromRow),
              willChange: 'transform',
            }}
          >
            <div style={{ width: '100%', height: '100%', perspective: 800 }}>
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  transformOrigin: 'center center',
                  transformStyle: 'preserve-3d',
                  willChange: 'transform, filter',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    transform: flipPieces ? 'rotate(180deg)' : undefined,
                    transformOrigin: 'center center',
                  }}
                >
                  <PieceGlyph pieceKey={m.pieceKey} pieceSet={pieceSet} customPieces={customPieces} />
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
      {confetti.map((c) => (
        <div
          key={`confetti-${c.id}`}
          ref={(el) => { if (el) startConfettiAnimation(el, c); }}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6 }}
        >
          {c.flakes.map((f, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: `${-f.hPct - 3}%`,
                left: `${f.leftPct}%`,
                width: `${f.wPct}%`,
                height: `${f.hPct}%`,
                background: f.color,
                borderRadius: f.round ? '50%' : '18%',
                opacity: 0,
                willChange: 'transform, opacity',
              }}
            />
          ))}
        </div>
      ))}
      {banners.map((bn) => (
        <div
          key={`banner-${bn.id}`}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 7,
          }}
        >
          <span
            ref={(el) => { if (el) startBannerAnimation(el, bn); }}
            style={{
              maxWidth: '92%',
              padding: bn.background ? '0.25em 0.9em' : undefined,
              borderRadius: bn.background ? '999px' : undefined,
              background: bn.background,
              color: bn.color,
              fontSize: 'clamp(20px, 7.5vmin, 60px)',
              fontWeight: 900,
              fontFamily: 'system-ui, sans-serif',
              letterSpacing: '0.06em',
              textAlign: 'center',
              lineHeight: 1.1,
              textShadow: `0 0 18px ${bn.glowColor}, 0 0 42px ${bn.glowColor}, 0 2px 4px rgba(0, 0, 0, 0.45)`,
              opacity: 0,
              willChange: 'transform, opacity',
            }}
          >
            {bn.text}
          </span>
        </div>
      ))}
      {spotlights.map((s) => {
        const mask = s.holes
          .map(h => `radial-gradient(circle at ${h.cx}% ${h.cy}%, transparent 0, transparent ${h.r * 0.7}%, black ${h.r}%)`)
          .join(', ');
        return (
          <div
            key={`spotlight-${s.id}`}
            ref={(el) => { if (el) startSpotlightAnimation(el, s); }}
            style={{
              position: 'absolute',
              inset: 0,
              background: s.color,
              opacity: 0,
              pointerEvents: 'none',
              willChange: 'opacity',
              zIndex: 1,
              maskImage: mask,
              WebkitMaskImage: mask,
              maskComposite: 'intersect',
              WebkitMaskComposite: 'source-in',
            }}
          />
        );
      })}
      {promos.map((p) => (
        <div
          key={`promo-${p.id}`}
          ref={(el) => { if (el) startPromotionAnimation(el, p); }}
          style={{
            position: 'absolute',
            ...pieceBox,
            transform: positionTransform(p.col, p.row),
            pointerEvents: 'none',
            perspective: 800,
            zIndex: 4,
          }}
        >
          <div
            data-promo-pillar
            style={{
              position: 'absolute',
              left: '50%',
              bottom: '50%',
              width: '50%',
              height: '320%',
              marginLeft: '-25%',
              background: `linear-gradient(to top, ${p.color} 0%, transparent 85%)`,
              filter: 'blur(1px)',
              transformOrigin: 'bottom center',
              opacity: 0,
              willChange: 'transform, opacity',
            }}
          />
          <div
            data-promo-ring
            style={{
              position: 'absolute',
              inset: '8%',
              borderRadius: '50%',
              border: `3px solid ${p.color}`,
              boxShadow: `0 0 10px ${p.color}`,
              opacity: 0,
              willChange: 'transform, opacity',
            }}
          />
          {p.fromPieceKey && (
            <div
              data-promo-old
              style={{ position: 'absolute', inset: 0, opacity: 1, transformOrigin: 'center center', willChange: 'transform, opacity' }}
            >
              <div style={{ width: '100%', height: '100%', transform: flipPieces ? 'rotate(180deg)' : undefined, transformOrigin: 'center center' }}>
                <PieceGlyph pieceKey={p.fromPieceKey} pieceSet={pieceSet} customPieces={customPieces} />
              </div>
            </div>
          )}
          {p.toPieceKey && (
            <div
              data-promo-new
              style={{ position: 'absolute', inset: 0, opacity: 0, transformStyle: 'preserve-3d', transformOrigin: 'center center', willChange: 'transform, opacity, filter' }}
            >
              <div style={{ width: '100%', height: '100%', transform: flipPieces ? 'rotate(180deg)' : undefined, transformOrigin: 'center center' }}>
                <PieceGlyph pieceKey={p.toPieceKey} pieceSet={pieceSet} customPieces={customPieces} />
              </div>
            </div>
          )}
          <div
            data-promo-flash
            style={{
              position: 'absolute',
              inset: '-40%',
              borderRadius: '50%',
              background: `radial-gradient(circle, #ffffff 0%, ${p.color} 35%, transparent 70%)`,
              opacity: 0,
              willChange: 'opacity',
            }}
          />
        </div>
      ))}
      {implodes.map((im) => (
        <div
          key={`implode-${im.id}`}
          ref={(el) => { if (el) startImplodeAnimation(el, im); }}
          style={{
            position: 'absolute',
            ...pieceBox,
            transform: positionTransform(im.col, im.row),
            pointerEvents: 'none',
            zIndex: 4,
          }}
        >
          <div
            data-implode-ring
            style={{ position: 'absolute', inset: '-12%', borderRadius: '50%', border: `2px solid ${im.color}`, boxShadow: `0 0 10px ${im.color}`, opacity: 0, willChange: 'transform, opacity' }}
          />
          <div
            data-implode-ring
            style={{ position: 'absolute', inset: '12%', borderRadius: '50%', border: `2px solid ${im.color}`, boxShadow: `0 0 10px ${im.color}`, opacity: 0, willChange: 'transform, opacity' }}
          />
          <div
            data-implode-core
            style={{ position: 'absolute', inset: '28%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0, 0, 0, 0.9), transparent 70%)', opacity: 0, willChange: 'transform, opacity' }}
          />
          {im.pieceKey && (
            <div
              data-implode-piece
              style={{ position: 'absolute', inset: 0, opacity: 1, transformOrigin: 'center center', willChange: 'transform, opacity' }}
            >
              <div style={{ width: '100%', height: '100%', transform: flipPieces ? 'rotate(180deg)' : undefined, transformOrigin: 'center center' }}>
                <PieceGlyph pieceKey={im.pieceKey} pieceSet={pieceSet} customPieces={customPieces} />
              </div>
            </div>
          )}
          <div
            data-implode-flash
            style={{ position: 'absolute', inset: '-30%', borderRadius: '50%', background: `radial-gradient(circle, #ffffff 0%, ${im.color} 40%, transparent 70%)`, opacity: 0, willChange: 'opacity' }}
          />
        </div>
      ))}
      {checkmates.map((cm) => (
        <div key={`mate-${cm.id}`} ref={(el) => { if (el) startCheckmateAnimation(el, cm); }}>
          {cm.dim && (
            <div
              data-mate-dim
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(3, 7, 15, 0.55)',
                opacity: 0,
                pointerEvents: 'none',
                zIndex: 3,
                willChange: 'opacity',
              }}
            />
          )}
          <div
            style={{
              position: 'absolute',
              ...pieceBox,
              transform: positionTransform(cm.col, cm.row),
              pointerEvents: 'none',
              zIndex: 5,
            }}
          >
            <div
              data-mate-dust
              style={{
                position: 'absolute',
                left: '10%',
                bottom: '-4%',
                width: '55%',
                height: '26%',
                borderRadius: '50%',
                background: `radial-gradient(ellipse at center, ${cm.color}55 0%, transparent 70%)`,
                opacity: 0,
                willChange: 'transform, opacity',
              }}
            />
            {cm.pieceKey && (
              <div
                data-mate-piece
                style={{
                  position: 'absolute',
                  inset: 0,
                  // Pivot on the base of the piece so it tips rather than spins.
                  transformOrigin: '50% 92%',
                  willChange: 'transform',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    transform: flipPieces ? 'rotate(180deg)' : undefined,
                    transformOrigin: 'center center',
                  }}
                >
                  <PieceGlyph pieceKey={cm.pieceKey} pieceSet={pieceSet} customPieces={customPieces} />
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
      {annotations.map((an) => {
        const pos = ANNOTATION_POSITIONS[an.corner];
        return (
          <div
            key={`annot-${an.id}`}
            ref={(el) => {
              if (!el) { annotationElsRef.current.delete(an.id); return; }
              annotationElsRef.current.set(an.id, el);
              startAnnotationAnimation(el, an);
            }}
            style={{
              position: 'absolute',
              ...pieceBox,
              transform: positionTransform(an.col, an.row),
              pointerEvents: 'none',
              zIndex: 9,
              opacity: 0,
              display: 'flex',
              alignItems: pos.align,
              justifyContent: pos.justify,
              padding: an.corner === 'center' ? 0 : '6%',
              willChange: 'transform, opacity',
            }}
          >
            <span
              style={{
                background: an.background,
                color: an.color,
                fontSize: an.fontSize ?? 'clamp(9px, 2.1cqw, 15px)',
                fontWeight: 700,
                lineHeight: 1.15,
                padding: '0.18em 0.42em',
                borderRadius: '0.25em',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.35)',
              }}
            >
              {an.text}
            </span>
          </div>
        );
      })}
      {lasers.map((l) => {
        const gradient = HEX6.test(l.color)
          ? `linear-gradient(90deg, ${l.color}00 0%, ${l.color} 60%, #ffffff 100%)`
          : `linear-gradient(90deg, transparent, ${l.color} 60%, #ffffff)`;
        return (
          <div
            key={`laser-${l.id}`}
            ref={(el) => { if (el) startLaserAnimation(el, l); }}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 8 }}
          >
            <div
              data-laser-beam
              style={{
                position: 'absolute',
                left: `${l.sx}%`,
                top: `${l.sy}%`,
                width: `${l.dist}%`,
                height: `${l.widthPx}px`,
                marginTop: `${-l.widthPx / 2}px`,
                transformOrigin: '0 50%',
                transform: `rotate(${l.angle}deg)`,
                background: gradient,
                borderRadius: `${l.widthPx}px`,
                boxShadow: `0 0 ${l.widthPx * 2}px ${l.glowColor}, 0 0 ${l.widthPx * 4}px ${l.glowColor}`,
                opacity: 0,
                willChange: 'transform, opacity',
              }}
            />
            <div
              data-laser-tip
              style={{
                position: 'absolute',
                left: `${l.ex}%`,
                top: `${l.ey}%`,
                width: `${l.widthPx * 3}px`,
                height: `${l.widthPx * 3}px`,
                marginLeft: `${-l.widthPx * 1.5}px`,
                marginTop: `${-l.widthPx * 1.5}px`,
                borderRadius: '50%',
                background: `radial-gradient(circle, #ffffff 0%, ${l.glowColor} 40%, transparent 70%)`,
                opacity: 0,
                willChange: 'opacity',
              }}
            />
          </div>
        );
      })}
      {drawnArrows.map((a) => (
        <svg
          key={`draw-arrow-${a.id}`}
          ref={(el) => { if (el) startDrawArrowAnimation(el, a); }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            overflow: 'visible',
            zIndex: 8,
          }}
          viewBox="-4 -4 8 8"
          preserveAspectRatio="xMidYMid slice"
        >
          <path
            data-draw-arrow-shaft
            fill="none"
            stroke={a.color}
            strokeWidth={a.widthPx}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            style={{
              filter: `drop-shadow(0 0 ${a.widthPx * 2}px ${a.glowColor})`,
              opacity: 1,
            }}
          />
          <path
            data-draw-arrow-head
            fill={a.color}
            stroke="none"
            style={{
              filter: `drop-shadow(0 0 ${a.widthPx * 1.5}px ${a.glowColor})`,
              opacity: 0,
            }}
          />
        </svg>
      ))}
    </div>
  );
}));
