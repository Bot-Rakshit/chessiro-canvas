import { memo, useCallback, useLayoutEffect, useEffect, useRef, useMemo } from 'react';
import type { Piece, Square, Orientation, PieceSet, PieceRenderer, AnimationPlan } from '../types';
import { readFen, INITIAL_FEN } from '../utils/fen';
import { square2pos, pos2translate } from '../utils/coords';
import { computeAnimPlan } from '../animation/anim';
import { CachedPieceImg, preloadPieceSet } from '../hooks/usePieceCache';

interface PiecesLayerProps {
  position: string;
  orientation: Orientation;
  pieceSet?: PieceSet;
  customPieces?: PieceRenderer;
  boardWidth: number;
  boardHeight: number;
  animationDurationMs: number;
  showAnimations: boolean;
  draggingSquare?: string | null;
}

function easing(t: number): number {
  return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

export const PiecesLayer = memo(function PiecesLayer({
  position,
  orientation,
  pieceSet,
  customPieces,
  boardWidth,
  boardHeight,
  animationDurationMs,
  showAnimations,
  draggingSquare,
}: PiecesLayerProps) {
  const asWhite = orientation === 'white';
  const piecePath = pieceSet?.path || '/pieces/cases';
  const pieces = useMemo(() => readFen(position || INITIAL_FEN), [position]);

  const prevPositionRef = useRef<string>(position || INITIAL_FEN);
  const skipNextAnimRef = useRef(false);
  const prevDraggingRef = useRef<string | null | undefined>(draggingSquare);
  const rafIdRef = useRef<number | null>(null);
  const pieceElsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  // The current animation state, mutated by rAF loop and read by layoutEffect
  const animRef = useRef<{
    plan: AnimationPlan;
    startTime: number;
    frequency: number;
  } | null>(null);

  if (prevDraggingRef.current && !draggingSquare) {
    skipNextAnimRef.current = true;
  }
  prevDraggingRef.current = draggingSquare;

  useEffect(() => {
    preloadPieceSet(piecePath);
  }, [piecePath]);

  // This is the core render function, inspired by chessground's render().
  // It walks all piece elements and applies the correct transform,
  // incorporating any active animation offset.
  // Called from useLayoutEffect (on position change) AND from rAF (during animation).
  const applyTransforms = useCallback(() => {
    const sqW = boardWidth / 8;
    const sqH = boardHeight / 8;
    const anim = animRef.current;

    let ease = 0;
    if (anim) {
      const elapsed = performance.now() - anim.startTime;
      const rest = 1 - elapsed * anim.frequency;
      if (rest <= 0) {
        // Animation finished
        animRef.current = null;
      } else {
        ease = easing(rest);
      }
    }

    const currentAnim = animRef.current;

    for (const [sq, el] of pieceElsRef.current) {
      const basePos = square2pos(sq as Square);
      const [baseX, baseY] = pos2translate(basePos, asWhite, boardWidth, boardHeight);

      let x = baseX;
      let y = baseY;

      if (currentAnim) {
        const vec = currentAnim.plan.anims.get(sq as Square);
        if (vec) {
          x += (vec.fromPos[0] - vec.toPos[0]) * ease * sqW;
          y -= (vec.fromPos[1] - vec.toPos[1]) * ease * sqH;
          el.style.zIndex = '8';
          el.style.willChange = 'transform';
        } else {
          el.style.zIndex = '2';
          el.style.willChange = '';
        }
      } else {
        el.style.zIndex = '2';
        el.style.willChange = '';
      }

      // Clamp to board bounds
      x = Math.max(0, Math.min(boardWidth - sqW, x));
      y = Math.max(0, Math.min(boardHeight - sqH, y));

      el.style.transform = `translate(${x}px, ${y}px)`;
    }

    return !!animRef.current;
  }, [asWhite, boardWidth, boardHeight]);

  // rAF animation loop - just calls applyTransforms repeatedly
  const animLoop = useCallback((_now: number) => {
    const stillAnimating = applyTransforms();
    if (stillAnimating) {
      rafIdRef.current = requestAnimationFrame(animLoop);
    } else {
      rafIdRef.current = null;
    }
  }, [applyTransforms]);

  // useLayoutEffect runs synchronously BEFORE browser paint.
  // This is critical: React has updated the DOM (possibly adding/removing piece elements),
  // and we immediately apply correct transforms before the user sees anything.
  useLayoutEffect(() => {
    const currentPos = position || INITIAL_FEN;
    const prevPos = prevPositionRef.current;
    prevPositionRef.current = currentPos;

    // Cancel any running rAF loop
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    // Clear previous animation
    animRef.current = null;

    // Compute new animation if position changed
    if (prevPos !== currentPos && showAnimations && animationDurationMs >= 50) {
      if (skipNextAnimRef.current) {
        skipNextAnimRef.current = false;
      } else {
        const prevPieces = readFen(prevPos);
        const plan = computeAnimPlan(prevPieces, pieces);
        if (plan.anims.size > 0) {
          animRef.current = {
            plan,
            startTime: performance.now(),
            frequency: 1 / animationDurationMs,
          };
        }
      }
    }

    // Apply transforms immediately (before paint!)
    // This either sets final positions or the animation start positions
    applyTransforms();

    // If there's an animation, start the rAF loop
    if (animRef.current) {
      rafIdRef.current = requestAnimationFrame(animLoop);
    }
  }, [position, pieces, showAnimations, animationDurationMs, applyTransforms, animLoop]);

  // Also re-apply on orientation/size changes (no animation needed)
  useLayoutEffect(() => {
    if (!animRef.current) {
      applyTransforms();
    }
  }, [asWhite, boardWidth, boardHeight, applyTransforms]);

  // Cleanup on unmount
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
    }> = [];

    for (const [square, piece] of pieces) {
      states.push({
        square,
        piece,
        dragging: draggingSquare === square,
      });
    }
    return states;
  }, [pieces, draggingSquare]);

  const setRef = useCallback((square: string) => (el: HTMLDivElement | null) => {
    if (el) {
      pieceElsRef.current.set(square, el);
    } else {
      pieceElsRef.current.delete(square);
    }
  }, []);

  const renderPiece = useCallback(
    (piece: Piece): React.ReactNode => {
      const key = `${piece.color}${piece.role.toUpperCase()}`;
      if (customPieces?.[key]) {
        return customPieces[key]();
      }
      const src = `${piecePath}/${key.toLowerCase()}.svg`;
      return <CachedPieceImg src={src} alt={key} />;
    },
    [piecePath, customPieces],
  );

  const sqW = boardWidth / 8;
  const sqH = boardHeight / 8;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {pieceStates.map((ps) => (
        <div
          key={`${ps.square}-${ps.piece.color}${ps.piece.role}`}
          ref={setRef(ps.square)}
          style={{
            position: 'absolute',
            width: `${sqW}px`,
            height: `${sqH}px`,
            // Don't set transform here - useLayoutEffect handles it
            // This avoids fighting between React and animation
            transform: 'translate(0px, 0px)',
            opacity: ps.dragging ? 0.5 : 1,
            zIndex: ps.dragging ? 1 : 2,
            pointerEvents: 'none',
          }}
        >
          {renderPiece(ps.piece)}
        </div>
      ))}
    </div>
  );
});
