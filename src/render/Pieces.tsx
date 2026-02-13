import { memo, useCallback, useEffect, useRef, useMemo } from 'react';
import type { Piece, Square, Orientation, PieceSet, PieceRenderer } from '../types';
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

// Cubic easing
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
  // Map of square -> DOM element ref for direct transform updates
  const pieceElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  // Track fading elements
  const fadingElsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  // Detect drag end to skip animation
  if (prevDraggingRef.current && !draggingSquare) {
    skipNextAnimRef.current = true;
  }
  prevDraggingRef.current = draggingSquare;

  useEffect(() => {
    preloadPieceSet(piecePath);
  }, [piecePath]);

  // Run animation via direct DOM manipulation - no React state updates during animation
  useEffect(() => {
    const currentPos = position || INITIAL_FEN;
    const prevPos = prevPositionRef.current;
    prevPositionRef.current = currentPos;

    // Cancel any running animation
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    // Clean up old fading elements
    for (const el of fadingElsRef.current.values()) {
      el.remove();
    }
    fadingElsRef.current.clear();

    if (prevPos === currentPos) return;
    if (!showAnimations || animationDurationMs < 50) return;
    if (skipNextAnimRef.current) {
      skipNextAnimRef.current = false;
      return;
    }

    const prevPieces = readFen(prevPos);
    const plan = computeAnimPlan(prevPieces, pieces);
    if (plan.anims.size === 0 && plan.fadings.size === 0) return;

    const sqW = boardWidth / 8;
    const sqH = boardHeight / 8;
    const startTime = performance.now();
    const frequency = 1 / animationDurationMs;

    // Set initial offsets on DOM elements immediately
    for (const [sq, vec] of plan.anims) {
      const el = pieceElsRef.current.get(sq);
      if (!el) continue;
      const basePos = square2pos(sq);
      const [baseX, baseY] = pos2translate(basePos, asWhite, boardWidth, boardHeight);
      const offsetX = (vec.fromPos[0] - vec.toPos[0]) * sqW;
      const offsetY = -(vec.fromPos[1] - vec.toPos[1]) * sqH;
      el.style.transform = `translate(${baseX + offsetX}px, ${baseY + offsetY}px)`;
      el.style.zIndex = '8';
      el.style.willChange = 'transform';
    }

    function step(now: number) {
      const elapsed = now - startTime;
      const rest = 1 - elapsed * frequency;

      if (rest <= 0) {
        // Animation complete - reset to final positions
        for (const [sq] of plan.anims) {
          const el = pieceElsRef.current.get(sq);
          if (!el) continue;
          const basePos = square2pos(sq);
          const [baseX, baseY] = pos2translate(basePos, asWhite, boardWidth, boardHeight);
          el.style.transform = `translate(${baseX}px, ${baseY}px)`;
          el.style.zIndex = '2';
          el.style.willChange = '';
        }
        // Remove fading elements
        for (const el of fadingElsRef.current.values()) {
          el.remove();
        }
        fadingElsRef.current.clear();
        rafIdRef.current = null;
        return;
      }

      const ease = easing(rest);

      for (const [sq, vec] of plan.anims) {
        const el = pieceElsRef.current.get(sq);
        if (!el) continue;
        const basePos = square2pos(sq);
        const [baseX, baseY] = pos2translate(basePos, asWhite, boardWidth, boardHeight);
        const offsetX = (vec.fromPos[0] - vec.toPos[0]) * ease * sqW;
        const offsetY = -(vec.fromPos[1] - vec.toPos[1]) * ease * sqH;
        el.style.transform = `translate(${baseX + offsetX}px, ${baseY + offsetY}px)`;
      }

      rafIdRef.current = requestAnimationFrame(step);
    }

    rafIdRef.current = requestAnimationFrame(step);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [position, pieces, showAnimations, animationDurationMs, asWhite, boardWidth, boardHeight]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // Build static piece states (no animation offsets - those are applied via DOM)
  const pieceStates = useMemo(() => {
    const states: Array<{
      square: Square;
      piece: Piece;
      x: number;
      y: number;
      dragging: boolean;
    }> = [];

    for (const [square, piece] of pieces) {
      const pos = square2pos(square);
      const [x, y] = pos2translate(pos, asWhite, boardWidth, boardHeight);
      states.push({
        square,
        piece,
        x,
        y,
        dragging: draggingSquare === square,
      });
    }
    return states;
  }, [pieces, asWhite, boardWidth, boardHeight, draggingSquare]);

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

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {pieceStates.map((ps) => (
        <div
          key={`${ps.square}-${ps.piece.color}${ps.piece.role}`}
          ref={setRef(ps.square)}
          style={{
            position: 'absolute',
            width: `${boardWidth / 8}px`,
            height: `${boardHeight / 8}px`,
            transform: `translate(${ps.x}px, ${ps.y}px)`,
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
