// Piece-motion model shared by the web board and the React Native port.
//
// Everything here is pure math: no DOM, no React, no timers. A move is
// described as a list of keyframes in BOARD space (x = column, y = row, both
// 0..7 in screen orientation, fractional while in flight). Renderers turn the
// keyframes into whatever their platform animates cheaply — Web Animations
// on the web (compositor thread), Reanimated `interpolate` on native (UI
// thread). Easing is baked into the samples, so any JS easing function —
// springs, bounces, your own curve — plays on the compositor/UI thread with
// linear interpolation between samples.

// ── Easing ─────────────────────────────────────────────────────────

export type EasingFunction = (t: number) => number;

export type EasingName =
  | 'linear'
  | 'ease'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'snappy'
  | 'smooth'
  | 'backOut'
  | 'spring'
  | 'bounce'
  | 'elastic'
  | 'anticipate';

/**
 * Build an easing function from CSS cubic-bezier control points
 * (Newton–Raphson with a bisection fallback, like browsers do).
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFunction {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  const solveT = (x: number): number => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-6) return t;
      const d = sampleDX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 30; i++) {
      const v = sampleX(t);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };

  return (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : sampleY(solveT(x)));
}

function bounceOut(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

// Critically-under-damped spring normalised so it lands exactly on 1.
const SPRING_END = 1 - Math.exp(-6.5) * Math.cos(11);
function springOut(t: number): number {
  if (t >= 1) return 1;
  return (1 - Math.exp(-6.5 * t) * Math.cos(11 * t)) / SPRING_END;
}

export const EASINGS: Readonly<Record<EasingName, EasingFunction>> = {
  linear: (t) => t,
  ease: cubicBezier(0.25, 0.1, 0.25, 1),
  easeIn: (t) => t * t * t,
  easeOut: (t) => 1 - (1 - t) ** 3,
  // The board's historical curve — kept bit-for-bit for the 'classic' preset.
  easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
  snappy: (t) => 1 - (1 - t) ** 5,
  smooth: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  backOut: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
  spring: springOut,
  // Winds back a touch, then overshoots and settles: the cartoon
  // anticipation/follow-through pair.
  anticipate: cubicBezier(0.6, -0.28, 0.35, 1.3),
  bounce: bounceOut,
  elastic: (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
};

export function resolveEasing(easing: EasingName | EasingFunction | undefined, fallback: EasingFunction): EasingFunction {
  if (typeof easing === 'function') return easing;
  if (easing && EASINGS[easing]) return EASINGS[easing];
  return fallback;
}

// ── Configuration ──────────────────────────────────────────────────

/** How a captured piece leaves the board. */
export type CaptureAnimation = 'fade' | 'shrink' | 'poof' | 'knockout' | 'sink' | 'none';
/** Flourish played when a moving piece arrives. */
export type LandingAnimation = 'none' | 'squash' | 'bounce' | 'settle';
/** How a piece with no origin (setup, new game, promotion) enters. */
export type AppearAnimation = 'none' | 'fade' | 'pop' | 'drop' | 'rise';
/** What happens to the pieces when `orientation` changes. */
export type FlipAnimation = 'none' | 'rotate' | 'fade';

export type MoveAnimationPreset =
  | 'classic'
  | 'snappy'
  | 'smooth'
  | 'playful'
  | 'arcade'
  | 'elegant'
  | 'minimal'
  | 'none';

export interface MoveAnimationOptions {
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
export interface ResolvedMoveAnimation {
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

export const MOVE_ANIMATION_PRESETS: Readonly<Record<Exclude<MoveAnimationPreset, 'none'>, Readonly<PresetValues>>> = {
  classic: {
    easing: 'easeInOut', durationScale: 1, distanceScaling: 0,
    arc: 0, knightArc: 0, liftScale: 1,
    capture: 'fade', landing: 'none', appear: 'none', flip: 'none', stagger: 0,
  },
  snappy: {
    easing: 'snappy', durationScale: 0.85, distanceScaling: 0.5,
    arc: 0, knightArc: 0, liftScale: 1,
    capture: 'fade', landing: 'none', appear: 'fade', flip: 'rotate', stagger: 0,
  },
  smooth: {
    easing: 'smooth', durationScale: 1.4, distanceScaling: 0.6,
    arc: 0, knightArc: 0.12, liftScale: 1.04,
    capture: 'shrink', landing: 'settle', appear: 'fade', flip: 'rotate', stagger: 12,
  },
  playful: {
    easing: 'anticipate', durationScale: 1.6, distanceScaling: 0.7,
    arc: 0.1, knightArc: 0.45, liftScale: 1.12,
    capture: 'knockout', landing: 'squash', appear: 'pop', flip: 'rotate', stagger: 18,
  },
  arcade: {
    easing: 'spring', durationScale: 1.9, distanceScaling: 0.8,
    arc: 0.28, knightArc: 0.6, liftScale: 1.2,
    capture: 'poof', landing: 'bounce', appear: 'drop', flip: 'rotate', stagger: 26,
  },
  elegant: {
    easing: 'ease', durationScale: 1.9, distanceScaling: 1,
    arc: 0.06, knightArc: 0.18, liftScale: 1.05,
    capture: 'sink', landing: 'settle', appear: 'rise', flip: 'fade', stagger: 22,
  },
  minimal: {
    easing: 'easeOut', durationScale: 0.6, distanceScaling: 0,
    arc: 0, knightArc: 0, liftScale: 1,
    capture: 'fade', landing: 'none', appear: 'none', flip: 'none', stagger: 0,
  },
};

const OVERSHOOTING: ReadonlySet<EasingName> = new Set<EasingName>(['backOut', 'spring', 'elastic', 'anticipate']);

export interface ResolveMoveAnimationContext {
  /** Base duration when `options.durationMs` is unset (the `animationDurationMs` prop). */
  baseDurationMs?: number;
  /** Master switch (the `showAnimations` prop). */
  enabled?: boolean;
  /** Current OS reduce-motion preference. */
  reducedMotion?: boolean;
}

/** Merge a preset, user overrides and environment into concrete settings. */
export function resolveMoveAnimation(
  options: MoveAnimationOptions | MoveAnimationPreset | undefined,
  ctx: ResolveMoveAnimationContext = {},
): ResolvedMoveAnimation {
  const opts: MoveAnimationOptions = typeof options === 'string' ? { preset: options } : options ?? {};
  const base = ctx.baseDurationMs ?? 200;
  const wantsNone = opts.preset === 'none';
  const reduce = !!ctx.reducedMotion && opts.respectReducedMotion !== false;
  const presetName: Exclude<MoveAnimationPreset, 'none'> =
    reduce ? 'minimal' : (opts.preset === undefined || opts.preset === 'none' ? 'classic' : opts.preset);
  const p = MOVE_ANIMATION_PRESETS[presetName] ?? MOVE_ANIMATION_PRESETS.classic;
  // Under reduced motion the preset wins over flourish overrides: only timing
  // survives, so a caller's "arcade" config degrades to a short flat slide.
  const pick = <K extends keyof MoveAnimationOptions>(key: K, fallback: NonNullable<MoveAnimationOptions[K]>) =>
    (reduce ? fallback : (opts[key] ?? fallback)) as NonNullable<MoveAnimationOptions[K]>;

  const durationMs = Math.max(0, opts.durationMs ?? base * p.durationScale);
  const easingOpt = reduce ? p.easing : opts.easing ?? p.easing;
  return {
    enabled: ctx.enabled !== false && !wantsNone && durationMs >= 16,
    durationMs,
    distanceScaling: clamp(pick('distanceScaling', p.distanceScaling), 0, 1),
    easing: resolveEasing(easingOpt, EASINGS.easeInOut),
    overshoots: typeof easingOpt === 'function' ? true : OVERSHOOTING.has(easingOpt),
    arc: Math.max(0, pick('arc', p.arc)),
    knightArc: Math.max(0, pick('knightArc', p.knightArc)),
    liftScale: Math.max(0.5, pick('liftScale', p.liftScale)),
    capture: pick('capture', p.capture),
    landing: pick('landing', p.landing),
    appear: pick('appear', p.appear),
    flip: pick('flip', p.flip),
    stagger: Math.max(0, pick('stagger', p.stagger)),
    snapBack: opts.snapBack ?? true,
  };
}

// ── Keyframes ──────────────────────────────────────────────────────

/**
 * One sampled pose. `x`/`y` are the piece's top-left in squares (column,
 * row in screen orientation); scale/rotate apply about the piece centre.
 */
export interface MotionKeyframe {
  offset: number;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  /** Degrees. */
  rotate: number;
  opacity: number;
}

export interface MotionTrack {
  /** Wait before the track starts, in ms. */
  delayMs: number;
  /** Track length excluding delay, in ms. */
  durationMs: number;
  /** Sampled poses; interpolate linearly between them. */
  frames: MotionKeyframe[];
}

export type BoardPoint = readonly [x: number, y: number];

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function frame(offset: number, x: number, y: number, sx = 1, sy = 1, rotate = 0, opacity = 1): MotionKeyframe {
  return { offset, x, y, scaleX: sx, scaleY: sy, rotate, opacity };
}

/** Travel time for a move of `distance` squares under the given settings. */
export function moveDurationMs(distance: number, m: Pick<ResolvedMoveAnimation, 'durationMs' | 'distanceScaling'>): number {
  if (m.distanceScaling <= 0) return m.durationMs;
  // sqrt(2.2) ≈ a typical 2-square move plays at exactly `durationMs`.
  const factor = clamp(Math.sqrt(Math.max(distance, 0.5) / 2.2), 0.65, 1.6);
  return m.durationMs * (1 + (factor - 1) * m.distanceScaling);
}

function isKnightJump(dx: number, dy: number): boolean {
  const ax = Math.abs(Math.round(dx));
  const ay = Math.abs(Math.round(dy));
  return (ax === 1 && ay === 2) || (ax === 2 && ay === 1);
}

const LANDING_MS: Record<LandingAnimation, number> = { none: 0, squash: 170, bounce: 240, settle: 140 };

// Landing poses over a 0..1 timeline, squashed about the centre and nudged
// down so the piece's base stays planted on the square.
function landingFrames(at: BoardPoint, landing: LandingAnimation): MotionKeyframe[] {
  const [x, y] = at;
  const planted = (t: number, sx: number, sy: number, lift = 0) => frame(t, x, y + (1 - sy) * 0.42 - lift, sx, sy);
  switch (landing) {
    case 'squash':
      return [planted(0.3, 1.14, 0.84), planted(0.62, 0.95, 1.06), planted(1, 1, 1)];
    case 'bounce':
      return [
        planted(0.16, 1.08, 0.9),
        planted(0.42, 0.97, 1.04, 0.14),
        planted(0.7, 1.03, 0.97),
        planted(0.84, 1, 1, 0.03),
        planted(1, 1, 1),
      ];
    case 'settle':
      return [planted(0.45, 1.04, 0.96), planted(1, 1, 1)];
    case 'none':
      return [];
  }
}

/**
 * Just the landing flourish at `at` — for a piece that arrived by other
 * means (a drag-and-drop) but should still land with character.
 */
export function planLandingTrack(at: BoardPoint, m: ResolvedMoveAnimation): MotionTrack | null {
  if (m.landing === 'none') return null;
  return { delayMs: 0, durationMs: LANDING_MS[m.landing], frames: [frame(0, at[0], at[1]), ...landingFrames(at, m.landing)] };
}

/**
 * Sample a piece's journey from `from` to `to` (board points, squares).
 * Includes the lift, arc and landing flourish.
 */
export function planMoveTrack(
  from: BoardPoint,
  to: BoardPoint,
  m: ResolvedMoveAnimation,
  opts: { delayMs?: number; /** Force a knight hop even if the geometry isn't one. */ knight?: boolean } = {},
): MotionTrack {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const distance = Math.hypot(dx, dy);
  const travelMs = moveDurationMs(distance, m);
  const knight = opts.knight ?? isKnightJump(dx, dy);
  const arcBase = knight ? Math.max(m.knightArc, m.arc) : m.arc;
  // Short hops get lower arcs so a one-square step doesn't loop the loop.
  const arcHeight = arcBase * clamp(0.55 + distance * 0.18, 0.6, 1.6);
  const landingMs = m.landing === 'none' ? 0 : LANDING_MS[m.landing];
  const totalMs = travelMs + landingMs;
  const travelShare = totalMs > 0 ? travelMs / totalMs : 1;

  const samples = m.overshoots || arcHeight > 0 || m.liftScale !== 1 ? 28 : 14;
  const frames: MotionKeyframe[] = [];
  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    const p = i === samples ? 1 : m.easing(u);
    // The hop is a parabola in TIME, not in eased distance: with front-loaded
    // curves (spring, back) the piece covers the ground early and still has
    // air time left, which reads as a jump followed by a landing.
    const bump = 4 * u * (1 - u);
    const lift = 1 + (m.liftScale - 1) * Math.sin(Math.PI * u);
    frames.push(frame(
      u * travelShare,
      from[0] + dx * p,
      from[1] + dy * p - arcHeight * bump,
      lift,
      lift,
    ));
  }

  if (landingMs > 0) {
    for (const f of landingFrames(to, m.landing)) {
      frames.push({ ...f, offset: travelShare + (1 - travelShare) * f.offset });
    }
  }

  return { delayMs: opts.delayMs ?? 0, durationMs: totalMs, frames };
}

/**
 * Sample the exit of a captured piece standing on `at`. `push` is the
 * attacker's travel direction (squares) — 'knockout' flings the victim along it.
 * The capture waits for the attacker to arrive (`arriveMs`).
 */
export function planCaptureTrack(
  at: BoardPoint,
  m: ResolvedMoveAnimation,
  opts: { arriveMs?: number; push?: BoardPoint } = {},
): MotionTrack | null {
  const [x, y] = at;
  const arrive = opts.arriveMs ?? m.durationMs;
  switch (m.capture) {
    case 'none':
      return null;
    case 'fade':
      // The historical behaviour: fade out across the attacker's flight.
      return {
        delayMs: 0,
        durationMs: Math.max(arrive, 140),
        frames: [frame(0, x, y), frame(0.5, x, y, 1, 1, 0, 0.5), frame(1, x, y, 1, 1, 0, 0)],
      };
    case 'shrink':
      return {
        delayMs: arrive * 0.55,
        durationMs: 220,
        frames: [frame(0, x, y), frame(1, x, y, 0.2, 0.2, 0, 0)],
      };
    case 'sink':
      return {
        delayMs: arrive * 0.6,
        durationMs: 320,
        frames: [frame(0, x, y), frame(0.6, x, y + 0.12, 0.92, 0.8, 0, 0.45), frame(1, x, y + 0.22, 0.85, 0.6, 0, 0)],
      };
    case 'poof':
      return {
        delayMs: arrive * 0.8,
        durationMs: 260,
        frames: [
          frame(0, x, y),
          frame(0.35, x, y, 1.28, 1.28, 0, 0.75),
          frame(1, x, y, 1.6, 1.6, 0, 0),
        ],
      };
    case 'knockout': {
      const [px, py] = opts.push ?? [0, -1];
      const len = Math.hypot(px, py) || 1;
      const nx = px / len;
      const ny = py / len;
      const spin = nx >= 0 ? 1 : -1;
      return {
        delayMs: arrive * 0.85,
        durationMs: 420,
        frames: [
          frame(0, x, y),
          frame(0.3, x + nx * 0.35, y + ny * 0.35 - 0.3, 1.05, 1.05, 28 * spin, 0.95),
          frame(1, x + nx * 0.9, y + ny * 0.9 + 0.1, 0.7, 0.7, 110 * spin, 0),
        ],
      };
    }
  }
}

const APPEAR_MS: Record<AppearAnimation, number> = { none: 0, fade: 220, pop: 320, drop: 380, rise: 360 };

/** Sample the entrance of a piece that appears on `at` without an origin. */
export function planAppearTrack(at: BoardPoint, m: ResolvedMoveAnimation, delayMs = 0): MotionTrack | null {
  const [x, y] = at;
  const durationMs = APPEAR_MS[m.appear];
  switch (m.appear) {
    case 'none':
      return null;
    case 'fade':
      return { delayMs, durationMs, frames: [frame(0, x, y, 1, 1, 0, 0), frame(1, x, y)] };
    case 'pop':
      return {
        delayMs,
        durationMs,
        frames: [
          frame(0, x, y, 0.3, 0.3, 0, 0),
          frame(0.55, x, y, 1.14, 1.14, 0, 1),
          frame(0.8, x, y, 0.96, 0.96),
          frame(1, x, y),
        ],
      };
    case 'drop':
      return {
        delayMs,
        durationMs,
        frames: [
          frame(0, x, y - 0.9, 1, 1, 0, 0),
          frame(0.55, x, y, 1, 1, 0, 1),
          frame(0.7, x, y + 0.07, 1.1, 0.86),
          frame(0.86, x, y - 0.04, 0.97, 1.04),
          frame(1, x, y),
        ],
      };
    case 'rise':
      return {
        delayMs,
        durationMs,
        frames: [frame(0, x, y + 0.25, 0.94, 0.94, 0, 0), frame(0.7, x, y - 0.02, 1, 1, 0, 1), frame(1, x, y)],
      };
  }
}

/**
 * Sample a rejected drop gliding back home. `from` is where the piece was
 * released (squares, fractional).
 */
export function planSnapBackTrack(from: BoardPoint, home: BoardPoint): MotionTrack {
  const distance = Math.hypot(home[0] - from[0], home[1] - from[1]);
  const durationMs = clamp(120 + distance * 35, 140, 320);
  const ease = EASINGS.snappy;
  const frames: MotionKeyframe[] = [];
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    const p = ease(u);
    frames.push(frame(u, from[0] + (home[0] - from[0]) * p, from[1] + (home[1] - from[1]) * p));
  }
  return { delayMs: 0, durationMs, frames };
}

/** A whole-board fade used by the 'fade' flip: out, swap, in. */
export function planFlipFadeTrack(at: BoardPoint, durationMs: number): MotionTrack {
  const [x, y] = at;
  return {
    delayMs: 0,
    durationMs,
    frames: [frame(0, x, y, 0.9, 0.9, 0, 0), frame(1, x, y)],
  };
}

/** Pose of a track at elapsed time `ms` (after its delay). Used to retarget interrupted flights. */
export function sampleTrack(track: MotionTrack, ms: number): MotionKeyframe {
  const frames = track.frames;
  const t = track.durationMs > 0 ? clamp((ms - track.delayMs) / track.durationMs, 0, 1) : 1;
  if (t <= frames[0].offset) return frames[0];
  for (let i = 1; i < frames.length; i++) {
    const b = frames[i];
    if (t <= b.offset) {
      const a = frames[i - 1];
      const span = b.offset - a.offset;
      const k = span > 0 ? (t - a.offset) / span : 1;
      return {
        offset: t,
        x: a.x + (b.x - a.x) * k,
        y: a.y + (b.y - a.y) * k,
        scaleX: a.scaleX + (b.scaleX - a.scaleX) * k,
        scaleY: a.scaleY + (b.scaleY - a.scaleY) * k,
        rotate: a.rotate + (b.rotate - a.rotate) * k,
        opacity: a.opacity + (b.opacity - a.opacity) * k,
      };
    }
  }
  return frames[frames.length - 1];
}

/** Order in which a cascade plays: nearest the viewer's side first, left to right. */
export function staggerRank(x: number, y: number): number {
  return (7 - y) * 8 + x;
}
