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
} from '../types';
import { PieceGlyph } from './PieceGlyph';
import { canAnimate, prefersReducedMotion, waitForAnimation } from '../cinematics/motion';

export interface CinematicLayerRef {
  cinematicMove: (from: Square, to: Square, options?: CinematicMoveOptions) => Promise<void>;
  squareBurst: (square: Square, options?: SquareBurstOptions) => Promise<void>;
  popBadge: (square: Square, options: PopBadgeOptions) => Promise<void>;
  clearCinematics: () => void;
}

interface CinematicLayerProps {
  orientation: Orientation;
  pieces: Pieces;
  pieceSet?: PieceSet;
  customPieces?: PieceRenderer;
  flipPieces?: boolean;
  getPieceElement: (square: string) => HTMLDivElement | null;
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
  squash: number;
  liftEnd: number;
  landStart: number;
  slam: boolean;
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

const BRILLIANT_TEAL = '#26c2a3';
const DEFAULT_BURST_COLOR = '#ffd65a';
const DEFAULT_BURST_DURATION_MS = 650;
const SHOCKWAVE_DURATION_MS = 500;
const DEFAULT_BADGE_DURATION_MS = 1600;
const MOVE_BADGE_DURATION_MS = 1400;
const FLIGHT_SAMPLES = 24;
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
  squash: number;
  liftEnd: number;
  landStart: number;
  slam: boolean;
}

const STYLE_PRESETS: Record<CinematicStyle, StylePreset> = {
  brilliant: {
    durationMs: 2000, spins: 1.5, arcHeight: 1.6, liftScale: 1.35,
    glowColor: BRILLIANT_TEAL, glowMaxPx: 18, sparkles: true, shockwave: true,
    slowMoLanding: true, squash: 0.15, liftEnd: 0.15, landStart: 0.7, slam: false,
  },
  great: {
    durationMs: 1400, spins: 1, arcHeight: 0.9, liftScale: 1.26,
    glowColor: '#5ea2d9', glowMaxPx: 10, sparkles: true, shockwave: false,
    slowMoLanding: false, squash: 0.12, liftEnd: 0.15, landStart: 0.72, slam: false,
  },
  smooth: {
    durationMs: 900, spins: 0, arcHeight: 0.35, liftScale: 1.12,
    glowColor: 'rgba(0, 0, 0, 0)', glowMaxPx: 0, sparkles: false, shockwave: false,
    slowMoLanding: false, squash: 0.04, liftEnd: 0.15, landStart: 0.85, slam: false,
  },
  slam: {
    durationMs: 1100, spins: 0, arcHeight: 0, liftScale: 1.6,
    glowColor: DEFAULT_BURST_COLOR, glowMaxPx: 12, sparkles: false, shockwave: true,
    slowMoLanding: false, squash: 0.3, liftEnd: 0.25, landStart: 0.7, slam: true,
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

function resolveMoveOptions(options: CinematicMoveOptions | undefined, reduced: boolean): ResolvedMoveOpts {
  const preset = STYLE_PRESETS[options?.style ?? 'brilliant'];
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
    squash: preset.squash,
    liftEnd: preset.liftEnd,
    landStart: preset.landStart,
    slam: preset.slam,
  };
  if (!reduced) return base;
  // Reduced motion: plain teaching-style glide — no spins, arc, glow or
  // landing effects.
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
    squash: 0,
    liftEnd: 0.15,
    landStart: 0.85,
    slam: false,
  };
}

// The flight path is a quadratic bezier sampled into WAAPI keyframes.
// Translate percentages are relative to the 12.5% piece box, so one square
// equals 100%.
function buildPositionKeyframes(e: MoveEntry): Keyframe[] {
  const o = e.opts;
  const frames: Keyframe[] = [{ transform: positionTransform(e.fromCol, e.fromRow), offset: 0 }];
  if (o.liftEnd > 0) {
    frames.push({ transform: positionTransform(e.fromCol, e.fromRow), offset: o.liftEnd });
  }
  const cx = (e.fromCol + e.toCol) / 2;
  // Control point placed so the arc peak bulges arcHeight squares above the
  // chord midpoint (peak at t=0.5 is (P0 + 2C + P2) / 4). Clamped so the peak
  // stays inside the clipped layer.
  let cy = (e.fromRow + e.toRow) / 2 - 2 * o.arcHeight;
  cy = Math.max(cy, (-0.6 - e.fromRow - e.toRow) / 2);
  for (let i = 1; i <= FLIGHT_SAMPLES; i++) {
    const u = i / FLIGHT_SAMPLES;
    const p = o.slowMoLanding ? 1 - (1 - u) ** SLOWMO_EXPONENT : easeInOutQuad(u);
    const inv = 1 - p;
    const x = inv * inv * e.fromCol + 2 * inv * p * cx + p * p * e.toCol;
    const y = inv * inv * e.fromRow + 2 * inv * p * cy + p * p * e.toRow;
    frames.push({
      transform: positionTransform(x, y),
      offset: o.liftEnd + (o.landStart - o.liftEnd) * u,
    });
  }
  frames.push({ transform: positionTransform(e.toCol, e.toRow), offset: 1 });
  return frames;
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

function buildAttitudeKeyframes(e: MoveEntry): Keyframe[] {
  const o = e.opts;
  const g = o.glowMaxPx;
  const c = o.glowColor;
  const lift = o.liftScale;
  const land = 1 - o.landStart;
  const squashAt = o.landStart + land * (o.slam ? 0.4 : 0.3);
  const reboundAt = o.landStart + land * 0.65;
  const frames: Keyframe[] = [att(0, {}, c)];
  let restRy = 0;
  if (o.slam) {
    frames.push(att(o.liftEnd, { sx: lift, sy: lift, shadow: 20, glow: g * 0.5 }, c));
    // Hang above the destination, then accelerate hard into the slam.
    frames.push(att(o.landStart, { sx: lift, sy: lift, shadow: 20, glow: g }, c, 'cubic-bezier(0.6, 0, 1, 0.4)'));
    if (o.squash > 0) {
      frames.push(att(squashAt, { sx: 1 + o.squash, sy: 1 - o.squash, shadow: 2, glow: g * 0.6 }, c));
    }
  } else {
    const flightRy = o.spins * 360;
    // Settle on a full turn so the piece art never rests mirrored; any
    // remaining half turn completes during the landing squash.
    restRy = Math.ceil(flightRy / 360 - 0.001) * 360;
    const tiltZ = o.spins > 0 ? -6 : 0;
    const wobble = o.spins > 0 ? 14 : 0;
    frames.push(att(o.liftEnd, { z: tiltZ, sx: lift, sy: lift, shadow: 10, glow: g * 0.35 }, c));
    const flight = o.landStart - o.liftEnd;
    for (const [u, w] of [[0.25, 1], [0.5, 0], [0.75, -1]] as const) {
      frames.push(att(o.liftEnd + flight * u, {
        z: tiltZ * (1 - u),
        ry: flightRy * u,
        rx: wobble * w,
        sx: lift,
        sy: lift,
        shadow: 12,
        glow: g * (0.35 + 0.65 * u),
      }, c));
    }
    frames.push(att(o.landStart, { ry: flightRy, sx: lift, sy: lift, shadow: 12, glow: g }, c));
    if (o.squash > 0) {
      frames.push(att(squashAt, { ry: restRy, sx: 1 + o.squash, sy: 1 - o.squash, shadow: 3, glow: g * 0.6 }, c));
    }
  }
  if (o.squash > 0) {
    frames.push(att(reboundAt, {
      ry: restRy,
      sx: 1 - o.squash * 0.25,
      sy: 1 + o.squash * 0.2,
      shadow: 2,
      glow: g * 0.3,
    }, c));
  }
  frames.push(att(1, { ry: restRy, shadow: 2 }, c));
  return frames;
}

/**
 * Cinematic replay effects layered over the board — the primitives behind a
 * "share game" screen where brilliant moves fly with 3D stunts, sparkles and
 * badges. Renders null when idle: no DOM, no listeners, no rAF loops. All
 * animation runs through WAAPI using only transform/opacity/filter.
 */
export const CinematicLayer = memo(forwardRef<CinematicLayerRef, CinematicLayerProps>(function CinematicLayer({
  orientation,
  pieces,
  pieceSet,
  customPieces,
  flipPieces = false,
  getPieceElement,
}, ref) {
  const asWhite = orientation === 'white';

  const [moves, setMoves] = useState<MoveEntry[]>([]);
  const [bursts, setBursts] = useState<BurstEntry[]>([]);
  const [badges, setBadges] = useState<BadgeEntry[]>([]);
  const movesRef = useRef<MoveEntry[]>(moves);
  movesRef.current = moves;

  const idRef = useRef(0);
  const piecesRef = useRef(pieces);
  piecesRef.current = pieces;
  const asWhiteRef = useRef(asWhite);
  asWhiteRef.current = asWhite;
  const getPieceElementRef = useRef(getPieceElement);
  getPieceElementRef.current = getPieceElement;

  const resolversRef = useRef<Map<number, () => void>>(new Map());
  const landingResolversRef = useRef<Map<number, () => void>>(new Map());
  const animationsRef = useRef<Map<number, Animation[]>>(new Map());
  const timeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
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
    landingResolversRef.current.delete(entry.id);
    resolve?.();

    const cleanup = () => {
      const tid = timeoutsRef.current.get(entry.id);
      if (tid !== undefined) {
        clearTimeout(tid);
        timeoutsRef.current.delete(entry.id);
      }
      animationsRef.current.delete(entry.id);
      startedRef.current.delete(entry.id);
      finishedRef.current.delete(entry.id);
      if (entry.hiddenSquare) {
        const orig = getPieceElementRef.current(entry.hiddenSquare);
        if (orig) orig.style.opacity = '';
      }
      setMoves(prev => prev.filter(m => m.id !== entry.id));
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(cleanup));
    } else {
      cleanup();
    }
  }, []);

  const finishBurst = useCallback((entry: BurstEntry) => {
    const resolve = resolversRef.current.get(entry.id);
    resolversRef.current.delete(entry.id);
    animationsRef.current.delete(entry.id);
    startedRef.current.delete(entry.id);
    setBursts(prev => prev.filter(b => b.id !== entry.id));
    resolve?.();
  }, []);

  const finishBadge = useCallback((entry: BadgeEntry) => {
    const resolve = resolversRef.current.get(entry.id);
    resolversRef.current.delete(entry.id);
    animationsRef.current.delete(entry.id);
    startedRef.current.delete(entry.id);
    setBadges(prev => prev.filter(b => b.id !== entry.id));
    resolve?.();
  }, []);

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

  const startMoveAnimation = useCallback((outer: HTMLDivElement, entry: MoveEntry) => {
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);

    if (!canAnimate(outer)) {
      finishMove(entry);
      return;
    }

    const o = entry.opts;
    const anims: Animation[] = [];
    const waits: Promise<void>[] = [];

    const pos = outer.animate(buildPositionKeyframes(entry), {
      duration: o.durationMs, easing: 'linear', fill: 'forwards',
    });
    anims.push(pos);
    waits.push(waitForAnimation(pos, o.durationMs));

    const attitude = outer.firstElementChild?.firstElementChild;
    if (attitude && canAnimate(attitude)) {
      const spin = attitude.animate(buildAttitudeKeyframes(entry), {
        duration: o.durationMs, easing: 'linear', fill: 'forwards',
      });
      anims.push(spin);
      waits.push(waitForAnimation(spin, o.durationMs));
    }
    animationsRef.current.set(entry.id, anims);

    if (o.sparkles || o.shockwave || o.badge) {
      waits.push(new Promise<void>((resolveLanding) => {
        landingResolversRef.current.set(entry.id, resolveLanding);
        const touchdownMs = Math.round(o.durationMs * (o.landStart + (1 - o.landStart) * (o.slam ? 0.4 : 0.25)));
        const tid = setTimeout(() => {
          timeoutsRef.current.delete(entry.id);
          const fx: Promise<void>[] = [];
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
          Promise.all(fx).then(() => {
            landingResolversRef.current.delete(entry.id);
            resolveLanding();
          });
        }, touchdownMs);
        timeoutsRef.current.set(entry.id, tid);
      }));
    }

    Promise.all(waits).then(() => finishMove(entry));
  }, [finishMove, spawnBurst, spawnBadge]);

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

  /**
   * Choreographed flight of the piece on `from` to `to`. The real piece on
   * `from` is hidden during the flight and restored on cleanup. Resolves
   * after the landing effects finish — commit the position yourself then
   * (same contract as the teaching animateMove).
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
    const landingResolvers = Array.from(landingResolversRef.current.values());
    landingResolversRef.current.clear();
    const resolvers = Array.from(resolversRef.current.values());
    resolversRef.current.clear();
    startedRef.current.clear();
    finishedRef.current.clear();
    setMoves([]);
    setBursts([]);
    setBadges([]);
    for (const resolve of landingResolvers) resolve();
    for (const resolve of resolvers) resolve();
  }, []);

  useImperativeHandle(ref, () => ({
    cinematicMove,
    squareBurst,
    popBadge,
    clearCinematics,
  }), [cinematicMove, squareBurst, popBadge, clearCinematics]);

  useEffect(() => {
    return () => {
      for (const anims of animationsRef.current.values()) {
        for (const anim of anims) anim.cancel();
      }
      animationsRef.current.clear();
      for (const tid of timeoutsRef.current.values()) clearTimeout(tid);
      timeoutsRef.current.clear();
      for (const resolve of landingResolversRef.current.values()) resolve();
      landingResolversRef.current.clear();
      for (const resolve of resolversRef.current.values()) resolve();
      resolversRef.current.clear();
    };
  }, []);

  if (moves.length === 0 && bursts.length === 0 && badges.length === 0) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 10 }}>
      {bursts.map((b) => (
        <div
          key={`burst-${b.id}`}
          ref={(el) => { if (el) startBurstAnimation(el, b); }}
          style={{
            position: 'absolute',
            width: '12.5%',
            height: '12.5%',
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
      {badges.map((bd) => (
        <div
          key={`badge-${bd.id}`}
          style={{
            position: 'absolute',
            width: '12.5%',
            height: '12.5%',
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
          style={{
            position: 'absolute',
            width: '12.5%',
            height: '12.5%',
            transform: positionTransform(m.fromCol, m.fromRow),
            willChange: 'transform',
            pointerEvents: 'none',
            zIndex: 3,
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
      ))}
    </div>
  );
}));
