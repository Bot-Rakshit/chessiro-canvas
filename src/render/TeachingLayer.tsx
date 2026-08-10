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
  AnimateMoveOptions, PulseSquareOptions, PieceTiltOptions,
} from '../types';
import { prefersReducedMotion, waitForAnimation } from '../cinematics/motion';
import { PieceGlyph } from './PieceGlyph';

export interface TeachingLayerRef {
  animateMove: (from: string, to: string, options?: AnimateMoveOptions) => Promise<void>;
  pulseSquare: (square: string, options?: PulseSquareOptions) => Promise<void>;
  shakePiece: (square: string) => Promise<void>;
  tiltPiece: (square: string, options?: PieceTiltOptions) => Promise<void>;
  resetPieceTilt: (square?: string, durationMs?: number) => Promise<void>;
  clearEffects: () => void;
}

interface TeachingLayerProps {
  boardStateRef: RefObject<{ pieces: Pieces; asWhite: boolean }>;
  pieceSet?: PieceSet;
  customPieces?: PieceRenderer;
  flipPieces?: boolean;
  getPieceElement: (square: string) => HTMLDivElement | null;
}

interface DemoEntry {
  id: number;
  pieceKey: string;
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
  durationMs: number;
  liftScale: number;
  ghost: boolean;
  ghostOpacity: number;
  hiddenSquare: string | null;
}

interface PulseEntry {
  id: number;
  col: number;
  row: number;
  color: string;
  durationMs: number;
  times: number;
}

/** A piece leaning on its base. Lives on the real piece element, not an overlay. */
interface TiltEntry {
  /**
   * The element the lean is applied to. Tilts are keyed by square, but a square
   * does not keep the same piece forever — the tilted piece can be captured or
   * moved away and a different one can arrive. Holding the element lets a stale
   * entry be recognised and dropped, so the newcomer is never rotated on the
   * strength of an angle it never had.
   */
  el: HTMLElement;
  /** Angle the running animation started from. */
  from: number;
  /** Angle the running animation is heading to. */
  peak: number;
  /** Angle the piece rests at once the animation settles. */
  rest: number;
  pivot: string;
  anim: Animation | null;
  settled: boolean;
}

const DEFAULT_DEMO_DURATION_MS = 900;
const DEFAULT_LIFT_SCALE = 1.18;
const DEFAULT_PULSE_COLOR = 'rgba(255, 188, 66, 0.95)';
const DEFAULT_PULSE_DURATION_MS = 700;
const DEFAULT_PULSE_TIMES = 2;
const DEFAULT_TILT_ANGLE_DEG = 84;
const DEFAULT_TILT_DURATION_MS = 600;
const DEFAULT_TILT_RESET_MS = 300;
const DEFAULT_TILT_EASING = 'cubic-bezier(0.34, 0.02, 0.62, 1)';
/**
 * Centre of the piece: the lean happens about the middle of the artwork so the
 * piece leans in place instead of swinging off its bottom edge. The centre is
 * also invariant under `flipPieces`' rotate(180deg), so flipped boards pivot on
 * the same point without shifting the piece inside its square.
 */
const TILT_PIVOT = '50% 50%';

function squareColRow(sq: string, asWhite: boolean): [number, number] {
  const f = sq.charCodeAt(0) - 97;
  const r = sq.charCodeAt(1) - 49;
  return [asWhite ? f : 7 - f, asWhite ? 7 - r : r];
}

function isValidSquare(sq: string): sq is Square {
  return typeof sq === 'string' && /^[a-h][1-8]$/.test(sq);
}

function canAnimate(el: Element): el is HTMLElement & { animate: Element['animate'] } {
  return typeof (el as HTMLElement).animate === 'function';
}

/**
 * Angle a tilted piece is showing right now, so a second tilt (or a reset)
 * continues from where the piece leans instead of snapping back to upright
 * first. Mid-flight it interpolates from the animation's progress; anything
 * unreadable falls back to the resting angle.
 */
function currentTiltAngle(entry: TiltEntry | undefined): number {
  if (!entry) return 0;
  if (!entry.anim || entry.settled) return entry.rest;
  try {
    const progress = (entry.anim.effect as KeyframeEffect | null)?.getComputedTiming?.().progress;
    if (typeof progress === 'number' && Number.isFinite(progress)) {
      return entry.from + (entry.peak - entry.from) * progress;
    }
  } catch {
    // Exotic/stubbed Animation objects can throw; the resting angle is fine.
  }
  return entry.rest;
}

/**
 * Imperative teaching effects layered over the board:
 * - animateMove: slowly "picks up" a piece, glides it to a target square and
 *   sets it down — a coach demonstrating a move without a human hand.
 * - pulseSquare: attention pulse ("look at this square").
 * - shakePiece: quick head-shake on a piece ("not that one / wrong move").
 * - tiltPiece / resetPieceTilt: lean a piece by a given angle at a given speed,
 *   rotating about the centre of the piece so it leans in place.
 */
export const TeachingLayer = memo(forwardRef<TeachingLayerRef, TeachingLayerProps>(function TeachingLayer({
  boardStateRef,
  pieceSet,
  customPieces,
  flipPieces = false,
  getPieceElement,
}, ref) {
  const [demos, setDemos] = useState<DemoEntry[]>([]);
  const [pulses, setPulses] = useState<PulseEntry[]>([]);
  const demosRef = useRef<DemoEntry[]>(demos);
  demosRef.current = demos;

  const idRef = useRef(0);
  const demoResolversRef = useRef<Map<number, () => void>>(new Map());
  const demoAnimationsRef = useRef<Map<number, Animation>>(new Map());
  // Tilts live on the real piece elements (like shakePiece), so they need no
  // overlay nodes and survive this layer rendering null.
  const tiltsRef = useRef<Map<string, TiltEntry>>(new Map());
  const startedRef = useRef<Set<number>>(new Set());
  const finishedRef = useRef<Set<number>>(new Set());
  const getPieceElementRef = useRef(getPieceElement);
  getPieceElementRef.current = getPieceElement;

  /**
   * The tilt recorded for a square, but only if it still belongs to the piece
   * standing there now. A tilted piece can be captured or moved on, and React
   * mounts a fresh element for whatever arrives next; that newcomer inherited
   * no angle, so a stale entry is cancelled and forgotten rather than replayed
   * onto it. Without this, resetting a square whose piece had changed would
   * whip the innocent newcomer from the old angle back to upright.
   *
   * Held in a ref so `runTilt` can use it without taking it as a dependency.
   */
  const liveTiltRef = useRef((square: string, inner: Element | null): TiltEntry | undefined => {
    const entry = tiltsRef.current.get(square);
    if (!entry) return undefined;
    if (entry.el === inner) return entry;
    entry.anim?.cancel();
    tiltsRef.current.delete(square);
    return undefined;
  });

  const finishDemo = useCallback((entry: DemoEntry) => {
    if (finishedRef.current.has(entry.id)) return;
    finishedRef.current.add(entry.id);

    // Resolve first so callers can commit the real move while the demo piece
    // (fill: forwards) still covers the destination square; cleanup happens a
    // couple of frames later, avoiding a flash of the piece back at origin.
    const resolve = demoResolversRef.current.get(entry.id);
    demoResolversRef.current.delete(entry.id);
    resolve?.();

    const cleanup = () => {
      demoAnimationsRef.current.delete(entry.id);
      startedRef.current.delete(entry.id);
      finishedRef.current.delete(entry.id);
      if (entry.hiddenSquare) {
        const orig = getPieceElementRef.current(entry.hiddenSquare);
        if (orig) orig.style.opacity = '';
      }
      setDemos(prev => prev.filter(d => d.id !== entry.id));
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(cleanup));
    } else {
      cleanup();
    }
  }, []);

  const startDemoAnimation = useCallback((el: HTMLDivElement, entry: DemoEntry) => {
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);

    if (!canAnimate(el)) {
      finishDemo(entry);
      return;
    }

    const fromT = `translate(${entry.fromCol * 100}%, ${entry.fromRow * 100}%)`;
    const toT = `translate(${entry.toCol * 100}%, ${entry.toRow * 100}%)`;
    const lift = entry.liftScale;

    const glide = el.animate(
      [
        { transform: `${fromT} scale(1)` },
        { transform: `${fromT} scale(${lift})`, offset: 0.15 },
        { transform: `${toT} scale(${lift})`, offset: 0.85 },
        { transform: `${toT} scale(1)` },
      ],
      { duration: Math.max(50, entry.durationMs), easing: 'ease-in-out', fill: 'forwards' },
    );
    demoAnimationsRef.current.set(entry.id, glide);

    glide.oncancel = () => finishDemo(entry);
    glide.onfinish = () => {
      if (entry.ghost) {
        const fade = el.animate(
          [{ opacity: String(entry.ghostOpacity) }, { opacity: '0' }],
          { duration: 200, easing: 'ease-out', fill: 'forwards' },
        );
        demoAnimationsRef.current.set(entry.id, fade);
        fade.onfinish = () => finishDemo(entry);
        fade.oncancel = () => finishDemo(entry);
      } else {
        finishDemo(entry);
      }
    };
  }, [finishDemo]);

  const animateMove = useCallback((from: string, to: string, options?: AnimateMoveOptions): Promise<void> => {
    if (!isValidSquare(from) || !isValidSquare(to) || from === to) {
      return Promise.resolve();
    }

    const { pieces, asWhite } = boardStateRef.current;
    const existing = pieces.get(from);
    const pieceKey = options?.piece
      ?? (existing ? `${existing.color}${existing.role.toUpperCase()}` : undefined);
    if (!pieceKey) return Promise.resolve();

    const ghost = options?.ghost ?? false;
    const hideOriginal = !ghost && (options?.hideOriginal ?? true) && !!existing;

    const [fromCol, fromRow] = squareColRow(from, asWhite);
    const [toCol, toRow] = squareColRow(to, asWhite);

    const entry: DemoEntry = {
      id: ++idRef.current,
      pieceKey,
      fromCol,
      fromRow,
      toCol,
      toRow,
      durationMs: options?.durationMs ?? DEFAULT_DEMO_DURATION_MS,
      liftScale: options?.liftScale ?? DEFAULT_LIFT_SCALE,
      ghost,
      ghostOpacity: ghost ? 0.6 : 1,
      hiddenSquare: hideOriginal ? from : null,
    };

    if (entry.hiddenSquare) {
      const orig = getPieceElementRef.current(entry.hiddenSquare);
      if (orig) orig.style.opacity = '0';
    }

    return new Promise<void>((resolve) => {
      demoResolversRef.current.set(entry.id, resolve);
      setDemos(prev => [...prev, entry]);
    });
  }, []);

  const pulseSquare = useCallback((square: string, options?: PulseSquareOptions): Promise<void> => {
    if (!isValidSquare(square)) return Promise.resolve();
    const { asWhite } = boardStateRef.current;
    const [col, row] = squareColRow(square, asWhite);
    const entry: PulseEntry = {
      id: ++idRef.current,
      col,
      row,
      color: options?.color ?? DEFAULT_PULSE_COLOR,
      durationMs: options?.durationMs ?? DEFAULT_PULSE_DURATION_MS,
      times: Math.max(1, options?.times ?? DEFAULT_PULSE_TIMES),
    };
    return new Promise<void>((resolve) => {
      demoResolversRef.current.set(entry.id, resolve);
      setPulses(prev => [...prev, entry]);
    });
  }, []);

  const finishPulse = useCallback((id: number) => {
    startedRef.current.delete(id);
    const resolve = demoResolversRef.current.get(id);
    demoResolversRef.current.delete(id);
    setPulses(prev => prev.filter(p => p.id !== id));
    resolve?.();
  }, []);

  const startPulseAnimation = useCallback((el: HTMLDivElement, entry: PulseEntry) => {
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);

    if (!canAnimate(el)) {
      finishPulse(entry.id);
      return;
    }

    const anim = el.animate(
      [
        { opacity: '0', transform: 'scale(0.55)' },
        { opacity: '1', transform: 'scale(0.92)', offset: 0.35 },
        { opacity: '0', transform: 'scale(1.28)' },
      ],
      {
        duration: Math.max(150, entry.durationMs),
        iterations: entry.times,
        easing: 'ease-out',
      },
    );
    anim.onfinish = () => finishPulse(entry.id);
    anim.oncancel = () => finishPulse(entry.id);
  }, [finishPulse]);

  const shakePiece = useCallback((square: string): Promise<void> => {
    if (!isValidSquare(square)) return Promise.resolve();
    const outer = getPieceElementRef.current(square);
    const inner = outer?.firstElementChild;
    if (!inner || !canAnimate(inner)) return Promise.resolve();

    return new Promise<void>((resolve) => {
      const anim = inner.animate(
        [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-9%)' },
          { transform: 'translateX(9%)' },
          { transform: 'translateX(-6%)' },
          { transform: 'translateX(6%)' },
          { transform: 'translateX(-3%)' },
          { transform: 'translateX(0)' },
        ],
        { duration: 420, easing: 'ease-in-out' },
      );
      anim.onfinish = () => resolve();
      anim.oncancel = () => resolve();
    });
  }, []);

  /**
   * Drive a piece's lean from wherever it currently is to `spec.to`. The
   * animation owns both the transform and the pivot (fill: 'forwards'), so it
   * outranks the inline style React writes on the same element.
   *
   * Three shapes, all one animation so a cancel always lands cleanly:
   * - `hold`: lean over and stay there until something resets it.
   * - `holdMs`: lean over, wait that long at the angle, come back by itself.
   * - neither: lean over and spring straight back inside `durationMs`.
   */
  const runTilt = useCallback((
    square: string,
    inner: HTMLElement,
    spec: {
      to: number;
      hold: boolean;
      durationMs: number;
      holdMs?: number;
      pivot: string;
      easing: string;
    },
  ): Promise<void> => {
    const prev = liveTiltRef.current(square, inner);
    const from = currentTiltAngle(prev);

    // Already resting exactly there: leave the existing hold alone. Cancelling
    // and restarting it would drop the fill and snap the piece upright.
    if (spec.hold && spec.to === from && prev?.settled !== false) {
      if (spec.to === 0) tiltsRef.current.delete(square);
      return Promise.resolve();
    }
    prev?.anim?.cancel();

    const base = flipPieces ? ' rotate(180deg)' : '';
    const at = (deg: number, offset?: number, easing?: string): Keyframe => ({
      transform: `rotateZ(${deg}deg)${base}`,
      transformOrigin: spec.pivot,
      ...(offset === undefined ? {} : { offset }),
      ...(easing === undefined ? {} : { easing }),
    });

    // A timed hold runs lean → wait → return, so it lasts longer than the
    // travel time the caller asked for; the other two shapes are exactly
    // `durationMs` long.
    const timed = spec.holdMs !== undefined;
    const travel = spec.durationMs;
    const totalMs = timed ? travel * 2 + (spec.holdMs ?? 0) : travel;
    // Only used to place the keyframes, so a zero-length tilt must not divide
    // by zero — the animation still finishes immediately either way.
    const span = Math.max(1, totalMs);

    let frames: Keyframe[];
    if (timed) {
      frames = [
        at(from, 0, spec.easing),
        // 'linear' over the hold window: it is a pause, not a movement.
        at(spec.to, travel / span, 'linear'),
        at(spec.to, (travel + (spec.holdMs ?? 0)) / span, spec.easing),
        at(from, 1),
      ];
    } else if (spec.hold) {
      frames = [at(from), at(spec.to)];
    } else {
      // Lean over, hold briefly at the extreme, then spring back.
      frames = [at(from, 0), at(spec.to, 0.45), at(spec.to, 0.6), at(from, 1)];
    }

    const anim = inner.animate(frames, {
      duration: totalMs,
      // Timed holds carry their easing per keyframe so the pause stays flat.
      easing: timed ? 'linear' : (spec.hold ? spec.easing : 'ease-in-out'),
      fill: 'forwards',
    });

    const rest = spec.hold && !timed ? spec.to : from;
    const entry: TiltEntry = {
      el: inner, from, peak: spec.to, rest, pivot: spec.pivot, anim, settled: false,
    };
    tiltsRef.current.set(square, entry);

    return waitForAnimation(anim, totalMs).then(() => {
      if (tiltsRef.current.get(square) !== entry) return; // superseded
      entry.settled = true;
      if (rest === 0) {
        // Upright again: drop the fill so the piece's own inline transform
        // (flip, selection scale) takes over, and stop tracking the square.
        entry.anim = null;
        tiltsRef.current.delete(square);
        anim.cancel();
      }
    });
  }, [flipPieces]);

  const tiltPiece = useCallback((square: string, options?: PieceTiltOptions): Promise<void> => {
    if (!isValidSquare(square)) return Promise.resolve();
    const outer = getPieceElementRef.current(square);
    const inner = outer?.firstElementChild;
    if (!inner || !canAnimate(inner)) return Promise.resolve();

    const { asWhite } = boardStateRef.current;
    const [col] = squareColRow(square, asWhite);
    const dir = options?.direction === 'left' ? -1
      : options?.direction === 'auto' ? (col <= 3 ? -1 : 1)
      : 1; // 'right' by default
    const rawAngle = options?.angle;
    const angle = typeof rawAngle === 'number' && Number.isFinite(rawAngle)
      ? rawAngle
      : DEFAULT_TILT_ANGLE_DEG;
    const rawHoldMs = options?.holdMs;
    // A timed hold answers 'how long does it stay down', which is a different
    // question from `hold`'s 'does it stay down at all', so it wins outright.
    const holdMs = typeof rawHoldMs === 'number' && Number.isFinite(rawHoldMs)
      ? Math.max(0, rawHoldMs)
      : undefined;
    const reduced = prefersReducedMotion() && !options?.force;

    return runTilt(square, inner, {
      to: angle * dir,
      hold: holdMs === undefined && (options?.hold ?? true),
      holdMs,
      // Under reduced motion a toppled king is still information, so the end
      // state is kept and only the travel is skipped.
      durationMs: reduced ? 0 : Math.max(0, options?.durationMs ?? DEFAULT_TILT_DURATION_MS),
      pivot: options?.pivot ?? TILT_PIVOT,
      easing: options?.easing ?? DEFAULT_TILT_EASING,
    });
  }, [runTilt]);

  const resetPieceTilt = useCallback((square?: string, durationMs?: number): Promise<void> => {
    const squares = square === undefined ? Array.from(tiltsRef.current.keys()) : [square];
    const duration = prefersReducedMotion() ? 0 : Math.max(0, durationMs ?? DEFAULT_TILT_RESET_MS);

    const jobs: Promise<void>[] = [];
    for (const sq of squares) {
      const inner = getPieceElementRef.current(sq)?.firstElementChild ?? null;
      // Skips squares whose tilted piece has been captured, moved on, or
      // replaced — liveTilt cancels and forgets those rather than dragging a
      // stranger back through an angle it never leaned to.
      const entry = liveTiltRef.current(sq, inner);
      if (!entry) continue;
      if (!inner || !canAnimate(inner)) {
        entry.anim?.cancel();
        tiltsRef.current.delete(sq);
        continue;
      }
      jobs.push(runTilt(sq, inner, {
        to: 0,
        hold: true,
        durationMs: duration,
        pivot: entry.pivot,
        easing: DEFAULT_TILT_EASING,
      }));
    }
    return jobs.length === 0 ? Promise.resolve() : Promise.all(jobs).then(() => undefined);
  }, [runTilt]);

  const clearEffects = useCallback(() => {
    for (const anim of Array.from(demoAnimationsRef.current.values())) {
      anim.cancel();
    }
    for (const entry of demosRef.current) {
      if (entry.hiddenSquare) {
        const orig = getPieceElementRef.current(entry.hiddenSquare);
        if (orig) orig.style.opacity = '';
      }
    }
    // Cancelling a held tilt drops its fill, so the piece snaps upright.
    for (const entry of tiltsRef.current.values()) entry.anim?.cancel();
    tiltsRef.current.clear();
    const resolvers = Array.from(demoResolversRef.current.values());
    demoResolversRef.current.clear();
    demoAnimationsRef.current.clear();
    startedRef.current.clear();
    setDemos([]);
    setPulses([]);
    for (const resolve of resolvers) resolve();
  }, []);

  useImperativeHandle(ref, () => ({
    animateMove,
    pulseSquare,
    shakePiece,
    tiltPiece,
    resetPieceTilt,
    clearEffects,
  }), [animateMove, pulseSquare, shakePiece, tiltPiece, resetPieceTilt, clearEffects]);

  useEffect(() => {
    return () => {
      for (const anim of demoAnimationsRef.current.values()) {
        anim.cancel();
      }
      for (const entry of tiltsRef.current.values()) entry.anim?.cancel();
      tiltsRef.current.clear();
      for (const resolve of demoResolversRef.current.values()) resolve();
      demoResolversRef.current.clear();
    };
  }, []);

  if (demos.length === 0 && pulses.length === 0) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 9 }}>
      {pulses.map((p) => (
        <div
          key={`pulse-${p.id}`}
          style={{
            position: 'absolute',
            width: '12.5%',
            height: '12.5%',
            transform: `translate(${p.col * 100}%, ${p.row * 100}%)`,
            pointerEvents: 'none',
          }}
        >
          <div
            ref={(el) => { if (el) startPulseAnimation(el as HTMLDivElement, p); }}
            style={{
              position: 'absolute',
              inset: '6%',
              borderRadius: '50%',
              border: `3px solid ${p.color}`,
              boxShadow: `0 0 12px 1px ${p.color}`,
              opacity: 0,
            }}
          />
        </div>
      ))}
      {demos.map((d) => (
        <div
          key={`demo-${d.id}`}
          ref={(el) => { if (el) startDemoAnimation(el, d); }}
          style={{
            position: 'absolute',
            width: '12.5%',
            height: '12.5%',
            transform: `translate(${d.fromCol * 100}%, ${d.fromRow * 100}%)`,
            opacity: d.ghost ? d.ghostOpacity : 1,
            willChange: 'transform',
            pointerEvents: 'none',
            filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.28))',
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
            <PieceGlyph pieceKey={d.pieceKey} pieceSet={pieceSet} customPieces={customPieces} />
          </div>
        </div>
      ))}
    </div>
  );
}));
