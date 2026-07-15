import {
  memo,
  forwardRef,
  useCallback,
  useLayoutEffect,
  useEffect,
  useImperativeHandle,
  useRef,
  useMemo,
  useState,
} from 'react';
import type { Piece, Pieces, Square, Orientation, PieceSet, PieceRenderer, AnimationPlan } from '../types';
import { INITIAL_FEN } from '../utils/fen';
import { computeAnimPlan } from '../animation/anim';
import { preloadPieceSet } from '../hooks/usePieceCache';
import { PieceGlyph } from './PieceGlyph';

export interface PiecesLayerRef {
  getPieceElement: (square: string) => HTMLDivElement | null;
}

interface PiecesLayerProps {
  position: string;
  pieces: Pieces;
  orientation: Orientation;
  pieceSet?: PieceSet;
  customPieces?: PieceRenderer;
  flipPieces?: boolean;
  animationDurationMs: number;
  showAnimations: boolean;
  draggingSquare?: string | null;
  selectedSquare?: string | null;
  selectedPieceScale?: number;
}

function easing(t: number): number {
  return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

// Board-relative column/row for a square (0..7 each), respecting orientation.
function squareColRow(sq: Square, asWhite: boolean): [number, number] {
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

export const PiecesLayer = memo(forwardRef<PiecesLayerRef, PiecesLayerProps>(function PiecesLayer({
  position,
  pieces,
  orientation,
  pieceSet,
  customPieces,
  flipPieces = false,
  animationDurationMs,
  showAnimations,
  draggingSquare,
  selectedSquare,
  selectedPieceScale,
}, ref) {
  const asWhite = orientation === 'white';
  const piecePath = pieceSet?.path;
  const currentPos = position || INITIAL_FEN;

  const skipNextAnimRef = useRef(false);
  const prevDraggingRef = useRef<string | null | undefined>(draggingSquare);
  const prevPositionRef = useRef(currentPos);
  const prevPiecesRef = useRef(pieces);
  const rafIdRef = useRef<number | null>(null);
  const pieceElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const fadingElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const refCallbacksRef = useRef<Map<string, (el: HTMLDivElement | null) => void>>(new Map());
  const fadingRefCallbacksRef = useRef<Map<string, (el: HTMLDivElement | null) => void>>(new Map());

  const animRef = useRef<{
    plan: AnimationPlan;
    startTime: number;
    frequency: number;
  } | null>(null);

  // Captured pieces from the in-flight animation, rendered so they fade out
  // under the arriving piece instead of vanishing instantly.
  const [fadings, setFadings] = useState<Array<{ square: Square; piece: Piece }>>([]);

  useImperativeHandle(ref, () => ({
    getPieceElement(square: string) {
      return pieceElsRef.current.get(square) ?? null;
    },
  }), []);

  useEffect(() => {
    if (piecePath) preloadPieceSet(piecePath);
  }, [piecePath]);

  // Set every piece to its resting transform, applying the current animation
  // offset for pieces that are mid-flight. Runs on commit; the per-frame loop
  // afterwards only touches animating/fading elements.
  const syncTransforms = useCallback(() => {
    const anim = animRef.current;

    let ease = 0;
    if (anim) {
      const elapsed = performance.now() - anim.startTime;
      const rest = 1 - elapsed * anim.frequency;
      if (rest <= 0) {
        animRef.current = null;
      } else {
        ease = easing(rest);
      }
    }

    const currentAnim = animRef.current;
    const mult = asWhite ? 1 : -1;

    for (const [sq, el] of pieceElsRef.current) {
      const [col, row] = squareColRow(sq as Square, asWhite);
      const vec = currentAnim?.plan.anims.get(sq as Square);
      if (vec) {
        let x = col + mult * (vec.fromPos[0] - vec.toPos[0]) * ease;
        let y = row - mult * (vec.fromPos[1] - vec.toPos[1]) * ease;
        x = Math.max(0, Math.min(7, x));
        y = Math.max(0, Math.min(7, y));
        el.style.transform = `translate(${x * 100}%, ${y * 100}%)`;
        el.style.zIndex = '8';
        el.style.willChange = 'transform';
      } else {
        el.style.transform = baseTransform(col, row);
        el.style.zIndex = '2';
        el.style.willChange = '';
      }
    }

    return !!animRef.current;
  }, [asWhite]);

  // Per-frame update: only animating pieces and fading captures are touched.
  const stepFrame = useCallback((): boolean => {
    const anim = animRef.current;
    if (!anim) return false;

    const elapsed = performance.now() - anim.startTime;
    const rest = 1 - elapsed * anim.frequency;

    if (rest <= 0) {
      animRef.current = null;
      for (const sq of anim.plan.anims.keys()) {
        const el = pieceElsRef.current.get(sq);
        if (el) {
          const [col, row] = squareColRow(sq, asWhite);
          el.style.transform = baseTransform(col, row);
          el.style.zIndex = '2';
          el.style.willChange = '';
        }
      }
      if (anim.plan.fadings.size > 0) {
        setFadings(prev => (prev.length === 0 ? prev : []));
      }
      return false;
    }

    const ease = easing(rest);
    const mult = asWhite ? 1 : -1;

    for (const [sq, vec] of anim.plan.anims) {
      const el = pieceElsRef.current.get(sq);
      if (!el) continue;
      const [col, row] = squareColRow(sq, asWhite);
      let x = col + mult * (vec.fromPos[0] - vec.toPos[0]) * ease;
      let y = row - mult * (vec.fromPos[1] - vec.toPos[1]) * ease;
      x = Math.max(0, Math.min(7, x));
      y = Math.max(0, Math.min(7, y));
      el.style.transform = `translate(${x * 100}%, ${y * 100}%)`;
    }

    for (const sq of anim.plan.fadings.keys()) {
      const el = fadingElsRef.current.get(sq);
      if (el) el.style.opacity = String(ease);
    }

    return true;
  }, [asWhite]);

  const animLoop = useCallback(() => {
    if (stepFrame()) {
      rafIdRef.current = requestAnimationFrame(animLoop);
    } else {
      rafIdRef.current = null;
    }
  }, [stepFrame]);

  useLayoutEffect(() => {
    if (prevDraggingRef.current && !draggingSquare) {
      skipNextAnimRef.current = true;
    }
    prevDraggingRef.current = draggingSquare;

    const prevPos = prevPositionRef.current;
    const positionChanged = currentPos !== prevPos;
    let nextPlan: AnimationPlan | null = null;

    if (positionChanged) {
      if (skipNextAnimRef.current) {
        skipNextAnimRef.current = false;
      } else if (showAnimations && animationDurationMs >= 50) {
        const plan = computeAnimPlan(prevPiecesRef.current, pieces);
        if (plan.anims.size > 0) {
          nextPlan = plan;
        }
      }
      prevPositionRef.current = currentPos;
      prevPiecesRef.current = pieces;
    }

    if (nextPlan) {
      animRef.current = {
        plan: nextPlan,
        startTime: performance.now(),
        frequency: 1 / animationDurationMs,
      };
      const nextFadings: Array<{ square: Square; piece: Piece }> = [];
      for (const [square, piece] of nextPlan.fadings) {
        nextFadings.push({ square, piece });
      }
      setFadings(prev => (prev.length === 0 && nextFadings.length === 0 ? prev : nextFadings));
    } else if (positionChanged || !showAnimations || animationDurationMs < 50) {
      animRef.current = null;
      setFadings(prev => (prev.length === 0 ? prev : []));
    }

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    const stillAnimating = syncTransforms();
    if (stillAnimating) {
      rafIdRef.current = requestAnimationFrame(animLoop);
    }
  }, [
    currentPos,
    pieces,
    draggingSquare,
    showAnimations,
    animationDurationMs,
    syncTransforms,
    animLoop,
  ]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const pieceStates = useMemo(() => {
    const states: Array<{
      square: Square;
      piece: Piece;
      dragging: boolean;
      selected: boolean;
    }> = [];

    for (const [square, piece] of pieces) {
      states.push({
        square,
        piece,
        dragging: draggingSquare === square,
        selected: selectedSquare === square,
      });
    }
    return states;
  }, [pieces, draggingSquare, selectedSquare]);

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

  const setFadingRef = useCallback((square: string) => {
    let cb = fadingRefCallbacksRef.current.get(square);
    if (!cb) {
      cb = (el: HTMLDivElement | null) => {
        if (el) {
          fadingElsRef.current.set(square, el);
        } else {
          fadingElsRef.current.delete(square);
        }
      };
      fadingRefCallbacksRef.current.set(square, cb);
    }
    return cb;
  }, []);

  const pieceRotation = flipPieces ? 'rotate(180deg)' : '';

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {fadings.map((f) => {
        const [col, row] = squareColRow(f.square, asWhite);
        return (
          <div
            key={`fade-${f.square}-${f.piece.color}${f.piece.role}`}
            ref={setFadingRef(f.square)}
            style={{
              position: 'absolute',
              width: '12.5%',
              height: '12.5%',
              transform: baseTransform(col, row),
              opacity: 1,
              zIndex: 1,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                transform: pieceRotation || undefined,
                width: '100%',
                height: '100%',
              }}
            >
              <PieceGlyph
                pieceKey={`${f.piece.color}${f.piece.role.toUpperCase()}`}
                pieceSet={pieceSet}
                customPieces={customPieces}
              />
            </div>
          </div>
        );
      })}
      {pieceStates.map((ps) => {
        const [col, row] = squareColRow(ps.square, asWhite);
        return (
          <div
            key={`${ps.square}-${ps.piece.color}${ps.piece.role}`}
            ref={setRef(ps.square)}
            style={{
              position: 'absolute',
              width: '12.5%',
              height: '12.5%',
              transform: baseTransform(col, row),
              opacity: ps.dragging ? 0.5 : 1,
              zIndex: ps.dragging ? 1 : 2,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                transition: 'transform 0.15s ease-out',
                transform: [
                  pieceRotation,
                  ps.selected && selectedPieceScale ? `scale(${selectedPieceScale})` : '',
                ].filter(Boolean).join(' ') || undefined,
                transformOrigin: 'center center',
                width: '100%',
                height: '100%',
              }}
            >
              <PieceGlyph
                pieceKey={`${ps.piece.color}${ps.piece.role.toUpperCase()}`}
                pieceSet={pieceSet}
                customPieces={customPieces}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}));
