import {
  memo,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type {
  Orientation, Pieces, PieceSet, PieceRenderer, Square,
  CinematicMoveOptions, CinematicStyle, SquareBurstOptions, PopBadgeOptions,
  CelebrateOptions, PopBannerOptions,
} from '../types';
import { PieceGlyph } from './PieceGlyph';
import { canAnimate, prefersReducedMotion, waitForAnimation } from '../cinematics/motion';

export interface CinematicLayerRef {
  cinematicMove: (from: Square, to: Square, options?: CinematicMoveOptions) => Promise<void>;
  squareBurst: (square: Square, options?: SquareBurstOptions) => Promise<void>;
  popBadge: (square: Square, options: PopBadgeOptions) => Promise<void>;
  celebrate: (options?: CelebrateOptions) => Promise<void>;
  popBanner: (options: PopBannerOptions) => Promise<void>;
  clearCinematics: () => void;
}

interface CinematicLayerProps {
  orientation: Orientation;
  pieces: Pieces;
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
const TRAIL_GAP_MS = 55;
const FLIGHT_SAMPLES = 24;
const CELEBRATE_COLORS = [BRILLIANT_TEAL, '#ffd65a', '#ff6b6b', '#5ea2d9', '#b78bff', '#7ee081'];
// p(u) = 1 - (1-u)^k with k chosen so the last 20% of the flight distance
// takes the final 40% of the flight time (slow-motion landing).
const SLOWMO_EXPONENT = Math.log(0.2) / Math.log(0.4);

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
    slowMoLanding: true, plunge: false, squash: 0.15, liftEnd: 0.15, landStart: 0.7, slam: false,
    trailCount: 4, flash: true, victimBlast: true, impactShake: { intensity: 3, durationMs: 300 },
  },
  great: {
    durationMs: 1400, spins: 1, arcHeight: 0.9, liftScale: 1.26,
    glowColor: '#5ea2d9', glowMaxPx: 10, sparkles: true, shockwave: false,
    slowMoLanding: false, plunge: false, squash: 0.12, liftEnd: 0.15, landStart: 0.72, slam: false,
    trailCount: 0, flash: false, victimBlast: false, impactShake: null,
  },
  smooth: {
    durationMs: 900, spins: 0, arcHeight: 0.35, liftScale: 1.12,
    glowColor: 'rgba(0, 0, 0, 0)', glowMaxPx: 0, sparkles: false, shockwave: false,
    slowMoLanding: false, plunge: false, squash: 0.04, liftEnd: 0.15, landStart: 0.85, slam: false,
    trailCount: 0, flash: false, victimBlast: false, impactShake: null,
  },
  slam: {
    durationMs: 1100, spins: 0, arcHeight: 0, liftScale: 1.6,
    glowColor: DEFAULT_BURST_COLOR, glowMaxPx: 12, sparkles: false, shockwave: true,
    slowMoLanding: false, plunge: false, squash: 0.3, liftEnd: 0.25, landStart: 0.7, slam: true,
    trailCount: 0, flash: true, victimBlast: true, impactShake: { intensity: 7, durationMs: 380 },
  },
  meteor: {
    durationMs: 2000, spins: 2, arcHeight: 2.6, liftScale: 1.5,
    glowColor: '#ff7a3d', glowMaxPx: 26, sparkles: true, shockwave: true,
    slowMoLanding: false, plunge: true, squash: 0.28, liftEnd: 0.12, landStart: 0.72, slam: false,
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
  const frames: Keyframe[] = [att(0, {}, c)];
  if (o.slam) {
    frames.push(att(liftFrac, { sx: lift, sy: lift, shadow: 22, glow: g * 0.5 }, c));
    // Hang above the destination, then accelerate hard into the drop; the
    // drop ends at the last frame = the impact moment.
    frames.push(att(0.78, { sx: lift, sy: lift, shadow: 22, glow: g }, c, 'cubic-bezier(0.7, 0, 1, 0.6)'));
    frames.push(att(1, { sx: 1.04, sy: 0.96, shadow: 3, glow: g }, c));
    return frames;
  }
  const tiltZ = o.spins > 0 ? -6 : 0;
  const wobble = o.spins > 0 ? 14 : 0;
  frames.push(att(liftFrac, { z: tiltZ, sx: lift, sy: lift, shadow: 10, glow: g * 0.35 }, c));
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
    }, c));
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
    return [contact, att(1, { ry: restRy, shadow: 2 }, c)];
  }
  return [
    contact,
    att(o.slam ? 0.22 : 0.28, { ry: restRy, sx: 1 + o.squash, sy: 1 - o.squash, shadow: 2, glow: g * 0.6 }, c),
    att(0.6, { ry: restRy, sx: 1 - o.squash * 0.25, sy: 1 + o.squash * 0.2, shadow: 2, glow: g * 0.3 }, c),
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
  orientation,
  pieces,
  pieceSet,
  customPieces,
  flipPieces = false,
  getPieceElement,
  onImpactShake,
}, ref) {
  const asWhite = orientation === 'white';

  const [moves, setMoves] = useState<MoveEntry[]>([]);
  const [bursts, setBursts] = useState<BurstEntry[]>([]);
  const [badges, setBadges] = useState<BadgeEntry[]>([]);
  const [blasts, setBlasts] = useState<BlastEntry[]>([]);
  const [flashes, setFlashes] = useState<FlashEntry[]>([]);
  const [confetti, setConfetti] = useState<ConfettiEntry[]>([]);
  const [banners, setBanners] = useState<BannerEntry[]>([]);
  const movesRef = useRef<MoveEntry[]>(moves);
  movesRef.current = moves;

  const idRef = useRef(0);
  const piecesRef = useRef(pieces);
  piecesRef.current = pieces;
  const asWhiteRef = useRef(asWhite);
  asWhiteRef.current = asWhite;
  const getPieceElementRef = useRef(getPieceElement);
  getPieceElementRef.current = getPieceElement;
  const onImpactShakeRef = useRef(onImpactShake);
  onImpactShakeRef.current = onImpactShake;

  const resolversRef = useRef<Map<number, () => void>>(new Map());
  const animationsRef = useRef<Map<number, Animation[]>>(new Map());
  const timeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const hiddenVictimsRef = useRef<Map<number, string>>(new Map());
  const startedRef = useRef<Set<number>>(new Set());
  const finishedRef = useRef<Set<number>>(new Set());

  const finishMove = useCallback((entry: MoveEntry) => {
    if (finishedRef.current.has(entry.id)) return;
    finishedRef.current.add(entry.id);

    // Resolve first so callers can commit the real move while the cinematic
    // piece (fill: forwards) still covers the destination square; cleanup a
    // couple of frames later avoids a flash of the piece back at origin.
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
      requestAnimationFrame(() => requestAnimationFrame(cleanup));
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

  const finishBurst = useRef(makeFinisher<BurstEntry>(setBursts)).current;
  const finishBadge = useRef(makeFinisher<BadgeEntry>(setBadges)).current;
  const finishBlast = useRef(makeFinisher<BlastEntry>(setBlasts)).current;
  const finishFlash = useRef(makeFinisher<FlashEntry>(setFlashes)).current;
  const finishConfetti = useRef(makeFinisher<ConfettiEntry>(setConfetti)).current;
  const finishBanner = useRef(makeFinisher<BannerEntry>(setBanners)).current;

  const spawnBurst = useCallback((square: Square, options?: SquareBurstOptions): Promise<void> => {
    const [col, row] = squareColRow(square, asWhiteRef.current);
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
    const [col, row] = squareColRow(square, asWhiteRef.current);
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
    const victim = piecesRef.current.get(square);
    if (!victim) return null;
    const el = getPieceElementRef.current(square);
    if (el) {
      el.style.opacity = '0';
      hiddenVictimsRef.current.set(moveId, square);
    }
    const [col, row] = squareColRow(square, asWhiteRef.current);
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
        { transform: 'scale(0)', opacity: 0, offset: 0, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
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
        { transform: 'scale(0.4)', opacity: 0, offset: 0, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
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
    const existing = piecesRef.current.get(from);
    const pieceKey = options?.piece
      ?? (existing ? `${existing.color}${existing.role.toUpperCase()}` : undefined);
    if (!pieceKey) return Promise.resolve();

    const reduced = prefersReducedMotion() && !options?.force;
    const white = asWhiteRef.current;
    const [fromCol, fromRow] = squareColRow(from, white);
    const [toCol, toRow] = squareColRow(to, white);

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
    for (const resolve of resolvers) resolve();
  }, []);

  useImperativeHandle(ref, () => ({
    cinematicMove,
    squareBurst,
    popBadge,
    celebrate,
    popBanner,
    clearCinematics,
  }), [cinematicMove, squareBurst, popBadge, celebrate, popBanner, clearCinematics]);

  useEffect(() => {
    return () => {
      for (const anims of animationsRef.current.values()) {
        for (const anim of anims) anim.cancel();
      }
      animationsRef.current.clear();
      for (const tid of timeoutsRef.current.values()) clearTimeout(tid);
      timeoutsRef.current.clear();
      for (const resolve of resolversRef.current.values()) resolve();
      resolversRef.current.clear();
    };
  }, []);

  if (
    moves.length === 0 && bursts.length === 0 && badges.length === 0
    && blasts.length === 0 && flashes.length === 0 && confetti.length === 0
    && banners.length === 0
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
    </div>
  );
}));
