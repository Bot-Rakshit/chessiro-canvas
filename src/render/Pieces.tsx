import { memo, useCallback, useLayoutEffect, useEffect, useRef, useMemo } from 'react';
import type { Piece, Pieces, Square, Orientation, PieceSet, PieceRenderer, AnimationPlan } from '../types';
import { INITIAL_FEN } from '../utils/fen';
import { square2pos, pos2translate } from '../utils/coords';
import { computeAnimPlan } from '../animation/anim';
import { CachedPieceImg, preloadPieceSet } from '../hooks/usePieceCache';
import { resolvePieceImageSrc } from '../defaultPieces';

interface PiecesLayerProps {
  position: string;
  pieces: Pieces;
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
  pieces,
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
  const piecePath = pieceSet?.path;
  const currentPos = position || INITIAL_FEN;

  const skipNextAnimRef = useRef(false);
  const prevDraggingRef = useRef<string | null | undefined>(draggingSquare);
  const prevPositionRef = useRef(currentPos);
  const prevPiecesRef = useRef(pieces);
  const rafIdRef = useRef<number | null>(null);
  const pieceElsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  const animRef = useRef<{
    plan: AnimationPlan;
    startTime: number;
    frequency: number;
  } | null>(null);

  useEffect(() => {
    if (piecePath) preloadPieceSet(piecePath);
  }, [piecePath]);

  const applyTransforms = useCallback(() => {
    const sqW = boardWidth / 8;
    const sqH = boardHeight / 8;
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

    for (const [sq, el] of pieceElsRef.current) {
      const basePos = square2pos(sq as Square);
      const [baseX, baseY] = pos2translate(basePos, asWhite, boardWidth, boardHeight);

      let x = baseX;
      let y = baseY;

      if (currentAnim) {
        const vec = currentAnim.plan.anims.get(sq as Square);
        if (vec) {
          const mult = asWhite ? 1 : -1;
          x += mult * (vec.fromPos[0] - vec.toPos[0]) * ease * sqW;
          y -= mult * (vec.fromPos[1] - vec.toPos[1]) * ease * sqH;
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

      x = Math.max(0, Math.min(boardWidth - sqW, x));
      y = Math.max(0, Math.min(boardHeight - sqH, y));

      el.style.transform = `translate(${x}px, ${y}px)`;
    }

    return !!animRef.current;
  }, [asWhite, boardWidth, boardHeight]);

  const animLoop = useCallback(() => {
    const stillAnimating = applyTransforms();
    if (stillAnimating) {
      rafIdRef.current = requestAnimationFrame(animLoop);
    } else {
      rafIdRef.current = null;
    }
  }, [applyTransforms]);

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
    } else if (positionChanged || !showAnimations || animationDurationMs < 50) {
      animRef.current = null;
    }

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    const stillAnimating = applyTransforms();
    if (stillAnimating) {
      rafIdRef.current = requestAnimationFrame(animLoop);
    }
  }, [
    currentPos,
    pieces,
    draggingSquare,
    showAnimations,
    animationDurationMs,
    applyTransforms,
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
      const src = resolvePieceImageSrc(key, piecePath);
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
