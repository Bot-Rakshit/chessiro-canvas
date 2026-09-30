import {
  memo,
  forwardRef,
  useCallback,
  useLayoutEffect,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { Piece, Pieces, Square, Orientation, PieceSet, PieceRenderer } from '../types';
import { computeAnimPlan } from '../animation/anim';
import {
  EASINGS,
  planAppearTrack,
  planCaptureTrack,
  planFlipFadeTrack,
  planLandingTrack,
  planMoveTrack,
  planSnapBackTrack,
  moveDurationMs,
  sampleTrack,
  staggerRank,
  type BoardPoint,
  type MotionTrack,
  type ResolvedMoveAnimation,
} from '../core/motion';
import { preloadPieceSet } from '../hooks/usePieceCache';
import { PieceGlyph } from './PieceGlyph';

export interface PiecesLayerRef {
  getPieceElement: (square: string) => HTMLDivElement | null;
  /**
   * Glide the piece on `square` home from a viewport point (a rejected drop).
   * `clientX/Y` is where the dragged piece's centre was released.
   */
  snapBack: (square: string, clientX: number, clientY: number) => void;
}

/** A drag-and-drop the board already showed; its move must not replay. */
export interface DropHint {
  from: string;
  to: string;
  at: number;
}

interface PiecesLayerProps {
  /**
   * Squares whose piece must render invisible. The cinematic layer fills this
   * before it resolves, so a piece committed by the caller is hidden in the
   * very commit that creates it — a layout effect runs before paint, which
   * chasing the element with rAF afterwards can never achieve.
   */
  suppressedSquaresRef?: React.RefObject<Set<string>>;
  /** Written by the interaction layer when a drop is accepted. */
  dropHintRef?: React.RefObject<DropHint | null>;
  pieces: Pieces;
  orientation: Orientation;
  pieceSet?: PieceSet;
  customPieces?: PieceRenderer;
  flipPieces?: boolean;
  motion: ResolvedMoveAnimation;
  draggingSquare?: string | null;
  selectedSquare?: string | null;
  selectedPieceScale?: number;
}

interface RunningTrack {
  anim: Animation;
  track: MotionTrack;
  startedAt: number;
}

interface FadingPiece {
  id: number;
  square: Square;
  piece: Piece;
  track: MotionTrack;
}

const DROP_HINT_TTL_MS = 5000;
const FLIGHT_Z = '8';

// Board-relative column/row for a square (0..7 each), respecting orientation.
function squareColRow(sq: string, asWhite: boolean): [number, number] {
  const f = sq.charCodeAt(0) - 97;
  const r = sq.charCodeAt(1) - 49;
  return [asWhite ? f : 7 - f, asWhite ? 7 - r : r];
}

// Pieces are sized at 12.5% of the board, so translate percentages are
// expressed in squares: translate(100%, 0) moves exactly one square right.
// Percentage-based positioning keeps pieces glued to their squares through
// any resize, container reflow, CSS transform, or missed measurement — the
// browser resolves the position, not stale JS-measured pixel bounds.
function baseTransform(col: number, row: number): string {
  return `translate(${col * 100}%, ${row * 100}%)`;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Turn a sampled track into Web Animations keyframes. Transform and opacity
 * only — both run on the compositor, so a busy main thread (an engine
 * search, a React commit) can't make a moving piece stutter.
 */
function toKeyframes(track: MotionTrack, raise: boolean): Keyframe[] {
  const fades = track.frames.some((f) => f.opacity !== 1);
  return track.frames.map((f) => {
    let transform = `translate(${round(f.x * 100)}%, ${round(f.y * 100)}%)`;
    if (f.rotate !== 0) transform += ` rotate(${round(f.rotate)}deg)`;
    if (f.scaleX !== 1 || f.scaleY !== 1) transform += ` scale(${round(f.scaleX)}, ${round(f.scaleY)})`;
    const kf: Keyframe = { offset: f.offset, transform };
    if (fades) kf.opacity = round(f.opacity);
    if (raise) kf.zIndex = FLIGHT_Z;
    return kf;
  });
}

function playTrack(el: Element | null | undefined, track: MotionTrack | null, raise = true): Animation | null {
  if (!el || !track || track.durationMs <= 0) return null;
  if (typeof (el as HTMLElement).animate !== 'function') return null;
  try {
    return (el as HTMLElement).animate(toKeyframes(track, raise), {
      duration: track.durationMs,
      delay: track.delayMs,
      easing: 'linear',
      // Hold the first pose through the delay: a staggered piece waits at its
      // origin, an appearing one stays invisible until its turn.
      fill: 'backwards',
    });
  } catch {
    return null;
  }
}

/** Run `cb` once when an animation finishes or is cancelled. */
function onSettle(anim: Animation, cb: () => void): void {
  let done = false;
  const settle = () => {
    if (done) return;
    done = true;
    cb();
  };
  const finished = (anim as Partial<Animation>).finished;
  if (finished && typeof finished.then === 'function') finished.then(settle, settle);
  anim.onfinish = settle;
  anim.oncancel = settle;
}

interface PieceNodeProps {
  square: Square;
  pieceKey: string;
  col: number;
  row: number;
  dragging: boolean;
  selectedScale: number | undefined;
  flipPieces: boolean;
  pieceSet?: PieceSet;
  customPieces?: PieceRenderer;
  setRef: (el: HTMLDivElement | null) => void;
}

// One memoized node per piece: a selection, drag or single move re-renders
// only the pieces whose props changed instead of all 32.
const PieceNode = memo(function PieceNode({
  pieceKey,
  col,
  row,
  dragging,
  selectedScale,
  flipPieces,
  pieceSet,
  customPieces,
  setRef,
}: PieceNodeProps) {
  const innerTransform = [
    flipPieces ? 'rotate(180deg)' : '',
    selectedScale ? `scale(${selectedScale})` : '',
  ].filter(Boolean).join(' ') || undefined;
  return (
    <div
      ref={setRef}
      style={{
        position: 'absolute',
        width: '12.5%',
        height: '12.5%',
        transform: baseTransform(col, row),
        opacity: dragging ? 0.5 : 1,
        zIndex: dragging ? 1 : 2,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          transition: 'transform 0.15s ease-out',
          transform: innerTransform,
          transformOrigin: 'center center',
          width: '100%',
          height: '100%',
        }}
      >
        <PieceGlyph pieceKey={pieceKey} pieceSet={pieceSet} customPieces={customPieces} />
      </div>
    </div>
  );
});

export const PiecesLayer = memo(forwardRef<PiecesLayerRef, PiecesLayerProps>(function PiecesLayer({
  pieces,
  orientation,
  pieceSet,
  customPieces,
  flipPieces = false,
  motion,
  draggingSquare,
  suppressedSquaresRef,
  dropHintRef,
  selectedSquare,
  selectedPieceScale,
}, ref) {
  const asWhite = orientation === 'white';
  const piecePath = pieceSet?.path;

  const containerRef = useRef<HTMLDivElement>(null);
  const prevPiecesRef = useRef(pieces);
  const prevAsWhiteRef = useRef(asWhite);
  const pieceElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const fadingElsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const refCallbacksRef = useRef<Map<string, (el: HTMLDivElement | null) => void>>(new Map());
  const runningRef = useRef<Map<string, RunningTrack>>(new Map());
  const boardSpinRef = useRef<Animation | null>(null);
  const startedFadingsRef = useRef<Set<number>>(new Set());
  const fadingIdRef = useRef(0);
  const motionRef = useRef(motion);
  motionRef.current = motion;
  const asWhiteRef = useRef(asWhite);
  asWhiteRef.current = asWhite;

  // Captured pieces, kept on the board just long enough to play their exit.
  const [fadings, setFadings] = useState<FadingPiece[]>([]);

  const track = useCallback((square: string, anim: Animation | null, t: MotionTrack | null) => {
    if (!anim || !t) return;
    const entry: RunningTrack = { anim, track: t, startedAt: performance.now() };
    runningRef.current.set(square, entry);
    const done = () => {
      if (runningRef.current.get(square) === entry) runningRef.current.delete(square);
    };
    onSettle(anim, done);
  }, []);

  const cancelAll = useCallback(() => {
    boardSpinRef.current?.cancel();
    boardSpinRef.current = null;
    const running = runningRef.current;
    runningRef.current = new Map();
    for (const { anim } of running.values()) anim.cancel();
  }, []);

  useImperativeHandle(ref, () => ({
    getPieceElement(square: string) {
      return pieceElsRef.current.get(square) ?? null;
    },
    snapBack(square: string, clientX: number, clientY: number) {
      const m = motionRef.current;
      if (!m.enabled || !m.snapBack) return;
      const el = pieceElsRef.current.get(square);
      const box = containerRef.current?.getBoundingClientRect();
      if (!el || !box || box.width <= 0) return;
      const from: BoardPoint = [
        ((clientX - box.left) / box.width) * 8 - 0.5,
        ((clientY - box.top) / box.height) * 8 - 0.5,
      ];
      const home = squareColRow(square, asWhiteRef.current);
      // A release within a hair of home needs no animation.
      if (Math.hypot(from[0] - home[0], from[1] - home[1]) < 0.05) return;
      runningRef.current.get(square)?.anim.cancel();
      const t = planSnapBackTrack(from, home);
      track(square, playTrack(el, t), t);
    },
  }), [track]);

  useEffect(() => {
    if (piecePath) preloadPieceSet(piecePath);
  }, [piecePath]);

  // Plan and launch motion for whatever changed in this commit. Runs before
  // paint, so pieces never flash at their destination first.
  useLayoutEffect(() => {
    const prevPieces = prevPiecesRef.current;
    const prevAsWhite = prevAsWhiteRef.current;
    prevPiecesRef.current = pieces;
    prevAsWhiteRef.current = asWhite;
    const positionChanged = prevPieces !== pieces;
    const flipped = prevAsWhite !== asWhite;
    if (!positionChanged && !flipped) return;

    const now = performance.now();
    const hint = dropHintRef?.current ?? null;
    if (positionChanged && dropHintRef) dropHintRef.current = null;
    const freshHint = hint && now - hint.at < DROP_HINT_TTL_MS ? hint : null;

    // Where each in-flight piece is right now, so an interrupted move
    // continues from its visible position instead of jumping back.
    const inFlight = new Map<string, BoardPoint>();
    for (const [sq, run] of runningRef.current) {
      const pose = sampleTrack(run.track, now - run.startedAt);
      inFlight.set(sq, [pose.x, pose.y]);
    }
    cancelAll();

    const m = motion;
    const suppressed = suppressedSquaresRef?.current;
    const isSuppressed = (sq: string) => !!suppressed && suppressed.has(sq);

    if (!m.enabled) {
      setFadings((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    if (!positionChanged) {
      // Orientation flip over an unchanged position.
      if (m.flip === 'none') return;
      if (m.flip === 'fade') {
        for (const sq of pieces.keys()) {
          if (isSuppressed(sq)) continue;
          const t = planFlipFadeTrack(squareColRow(sq, asWhite), Math.max(220, m.durationMs));
          track(sq, playTrack(pieceElsRef.current.get(sq), t), t);
        }
        return;
      }
      // 'rotate': the new layout is the old one turned 180°, and square colors
      // are symmetric under that turn — so spinning just the piece layer back
      // from 180° reads as the whole board turning. Each piece counter-rotates
      // on the same sampled curve to stay upright.
      const container = containerRef.current;
      if (!container || typeof container.animate !== 'function') return;
      const duration = Math.max(420, m.durationMs * 2);
      const steps = 16;
      const offsets: number[] = [];
      const angles: number[] = [];
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        offsets.push(u);
        angles.push(180 * (1 - EASINGS.smooth(u)));
      }
      try {
        const spin = container.animate(
          offsets.map((offset, i) => ({ offset, transform: `rotate(${round(angles[i])}deg)` })),
          { duration, easing: 'linear' },
        );
        boardSpinRef.current = spin;
        onSettle(spin, () => {
          if (boardSpinRef.current === spin) boardSpinRef.current = null;
        });
      } catch {
        return;
      }
      for (const sq of pieces.keys()) {
        if (isSuppressed(sq)) continue;
        const [x, y] = squareColRow(sq, asWhite);
        const t: MotionTrack = {
          delayMs: 0,
          durationMs: duration,
          frames: offsets.map((offset, i) => ({ offset, x, y, scaleX: 1, scaleY: 1, rotate: -angles[i], opacity: 1 })),
        };
        track(sq, playTrack(pieceElsRef.current.get(sq), t, false), t);
      }
      return;
    }

    const plan = computeAnimPlan(prevPieces, pieces);
    const origin = (sq: string): BoardPoint => inFlight.get(sq) ?? squareColRow(sq, prevAsWhite);

    // Cascade order for multi-piece changes: bottom rows first, left to right.
    const moves = plan.moves.length > 1 && m.stagger > 0
      ? [...plan.moves].sort((a, b) => {
        const [ax, ay] = squareColRow(a.to, asWhite);
        const [bx, by] = squareColRow(b.to, asWhite);
        return staggerRank(ax, ay) - staggerRank(bx, by);
      })
      : plan.moves;
    const byRank = (a: { square: string }, b: { square: string }) => {
      const [ax, ay] = squareColRow(a.square, asWhite);
      const [bx, by] = squareColRow(b.square, asWhite);
      return staggerRank(ax, ay) - staggerRank(bx, by);
    };
    const appears = plan.appears.length > 1 && m.stagger > 0 ? [...plan.appears].sort(byRank) : plan.appears;
    const count = plan.moves.length + plan.appears.length;
    // Keep a full-board cascade under ~0.45s however many pieces take part.
    const step = count > 2 ? Math.min(m.stagger, 450 / count) : 0;

    const arrivals = new Map<string, { from: BoardPoint; to: BoardPoint; arriveMs: number }>();
    let order = 0;
    for (const mv of moves) {
      const to = squareColRow(mv.to, asWhite);
      if (freshHint && freshHint.from === mv.from && freshHint.to === mv.to) {
        // The user already carried this piece here; just land it.
        arrivals.set(mv.to, { from: to, to, arriveMs: 0 });
        if (!isSuppressed(mv.to)) {
          const t = planLandingTrack(to, m);
          track(mv.to, playTrack(pieceElsRef.current.get(mv.to), t), t);
        }
        continue;
      }
      const from = origin(mv.from);
      const t = planMoveTrack(from, to, m, { delayMs: step * order++ });
      const travelMs = moveDurationMs(Math.hypot(to[0] - from[0], to[1] - from[1]), m);
      arrivals.set(mv.to, { from, to, arriveMs: t.delayMs + travelMs });
      if (isSuppressed(mv.to)) continue;
      track(mv.to, playTrack(pieceElsRef.current.get(mv.to), t), t);
    }

    for (const ap of appears) {
      if (isSuppressed(ap.square)) continue;
      const at = squareColRow(ap.square, asWhite);
      const t = planAppearTrack(at, m, step * order++);
      if (t) track(ap.square, playTrack(pieceElsRef.current.get(ap.square), t), t);
    }

    const nextFadings: FadingPiece[] = [];
    for (const cap of plan.captures) {
      // The dragged piece's origin is already empty on screen.
      if (freshHint && cap.square === freshHint.from) continue;
      const at = squareColRow(cap.square, prevAsWhite);
      // The capturer is whoever lands here — or, for en passant, the nearest arrival.
      let hit = arrivals.get(cap.square);
      if (!hit) {
        let best = Infinity;
        for (const a of arrivals.values()) {
          const d = Math.hypot(a.to[0] - at[0], a.to[1] - at[1]);
          if (d < best && d < 1.5) {
            best = d;
            hit = a;
          }
        }
      }
      const t = planCaptureTrack(at, m, {
        arriveMs: hit ? hit.arriveMs : m.durationMs,
        push: hit ? [hit.to[0] - hit.from[0], hit.to[1] - hit.from[1]] : undefined,
      });
      if (t) nextFadings.push({ id: ++fadingIdRef.current, square: cap.square, piece: cap.piece, track: t });
    }
    setFadings((prev) => (prev.length === 0 && nextFadings.length === 0 ? prev : nextFadings));
  }, [pieces, asWhite, motion, cancelAll, track, dropHintRef, suppressedSquaresRef]);

  // Launch exits for newly mounted captured pieces; drop each when it ends.
  useLayoutEffect(() => {
    const started = startedFadingsRef.current;
    const live = new Set<number>();
    for (const f of fadings) {
      live.add(f.id);
      if (started.has(f.id)) continue;
      started.add(f.id);
      const anim = playTrack(fadingElsRef.current.get(f.id), f.track, false);
      const remove = () => setFadings((prev) => {
        const next = prev.filter((p) => p.id !== f.id);
        return next.length === prev.length ? prev : next;
      });
      if (anim) {
        onSettle(anim, remove);
      } else {
        remove();
      }
    }
    for (const id of started) if (!live.has(id)) started.delete(id);
  }, [fadings]);

  // Enforce suppression before paint, in the same commit that mounted the
  // piece. Runs on every commit because the set is mutated by reference.
  useLayoutEffect(() => {
    const suppressed = suppressedSquaresRef?.current;
    if (!suppressed || suppressed.size === 0) return;
    for (const sq of suppressed) {
      const el = pieceElsRef.current.get(sq);
      if (el) el.style.opacity = '0';
    }
  });

  useEffect(() => cancelAll, [cancelAll]);

  // Stable per-square ref callbacks: a fresh closure per render would make
  // React detach/re-attach every piece ref on every render.
  const setRef = useCallback((square: string) => {
    let cb = refCallbacksRef.current.get(square);
    if (!cb) {
      cb = (el: HTMLDivElement | null) => {
        if (el) {
          pieceElsRef.current.set(square, el);
        } else {
          pieceElsRef.current.delete(square);
        }
      };
      refCallbacksRef.current.set(square, cb);
    }
    return cb;
  }, []);

  const pieceRotation = flipPieces ? 'rotate(180deg)' : undefined;

  const nodes: React.ReactNode[] = [];
  for (const [square, piece] of pieces) {
    const [col, row] = squareColRow(square, asWhite);
    const code = `${piece.color}${piece.role.toUpperCase()}`;
    nodes.push(
      <PieceNode
        key={`${square}-${code}`}
        square={square}
        pieceKey={code}
        col={col}
        row={row}
        dragging={draggingSquare === square}
        selectedScale={selectedSquare === square ? selectedPieceScale : undefined}
        flipPieces={flipPieces}
        pieceSet={pieceSet}
        customPieces={customPieces}
        setRef={setRef(square)}
      />,
    );
  }

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {fadings.map((f) => {
        const [col, row] = squareColRow(f.square, asWhite);
        return (
          <div
            key={`fade-${f.id}`}
            ref={(el) => {
              if (el) fadingElsRef.current.set(f.id, el);
              else fadingElsRef.current.delete(f.id);
            }}
            style={{
              position: 'absolute',
              width: '12.5%',
              height: '12.5%',
              transform: baseTransform(col, row),
              // Visible only while its exit animation runs.
              opacity: 0,
              zIndex: 1,
              pointerEvents: 'none',
            }}
          >
            <div style={{ transform: pieceRotation, width: '100%', height: '100%' }}>
              <PieceGlyph
                pieceKey={`${f.piece.color}${f.piece.role.toUpperCase()}`}
                pieceSet={pieceSet}
                customPieces={customPieces}
              />
            </div>
          </div>
        );
      })}
      {nodes}
    </div>
  );
}));
