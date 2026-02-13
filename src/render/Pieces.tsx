import { memo, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import type { Pieces, Piece, Square, Orientation, PieceSet, PieceRenderer, AnimationCurrent } from '../types';
import { readFen, INITIAL_FEN } from '../utils/fen';
import { square2pos, pos2translate } from '../utils/coords';
import { computeAnimPlan, createAnimationController } from '../animation/anim';
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

interface PieceState {
  square: Square;
  piece: Piece;
  x: number;
  y: number;
  animating: boolean;
  dragging: boolean;   // origin piece while being dragged (shows ghost)
  capturing: boolean;  // piece fading out (captured during animation)
}

function buildPieceStates(
  pieces: Pieces,
  asWhite: boolean,
  boardWidth: number,
  boardHeight: number,
  anim: AnimationCurrent | null,
  draggingSquare: string | null | undefined,
): PieceState[] {
  const states: PieceState[] = [];
  const sqW = boardWidth / 8;
  const sqH = boardHeight / 8;

  for (const [square, piece] of pieces) {
    const isDragging = draggingSquare === square;

    const pos = square2pos(square);
    let [x, y] = pos2translate(pos, asWhite, boardWidth, boardHeight);
    let animating = false;

    if (anim) {
      const vec = anim.plan.anims.get(square);
      if (vec) {
        x += vec.currentX * sqW;
        y -= vec.currentY * sqH;
        animating = true;
      }
    }

    states.push({
      square, piece, x, y, animating,
      dragging: isDragging,
      capturing: false,
    });
  }

  // Add fading pieces (captured during animation)
  if (anim) {
    for (const [square, piece] of anim.plan.fadings) {
      const pos = square2pos(square);
      const [x, y] = pos2translate(pos, asWhite, boardWidth, boardHeight);
      states.push({ square, piece, x, y, animating: false, dragging: false, capturing: true });
    }
  }

  return states;
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

  // Track previous position FEN string to detect actual changes and compute anim plan
  const prevPositionRef = useRef<string>(position || INITIAL_FEN);
  const [animCurrent, setAnimCurrent] = useState<AnimationCurrent | null>(null);
  const skipNextAnimRef = useRef(false);
  const prevDraggingRef = useRef<string | null | undefined>(draggingSquare);

  if (prevDraggingRef.current && !draggingSquare) {
    skipNextAnimRef.current = true;
  }
  prevDraggingRef.current = draggingSquare;

  const animController = useRef(
    createAnimationController(
      (current) => setAnimCurrent({ ...current }),
      () => setAnimCurrent(null),
    ),
  );

  useEffect(() => {
    preloadPieceSet(piecePath);
  }, [piecePath]);

  useEffect(() => {
    const currentPos = position || INITIAL_FEN;
    const prevPos = prevPositionRef.current;
    prevPositionRef.current = currentPos;

    if (!showAnimations || animationDurationMs < 50) return;
    if (prevPos === currentPos) return;

    if (skipNextAnimRef.current) {
      skipNextAnimRef.current = false;
      return;
    }

    // Parse the PREVIOUS position from the stored FEN, not from a ref that may be stale
    const prevPieces = readFen(prevPos);
    const plan = computeAnimPlan(prevPieces, pieces);
    if (plan.anims.size > 0 || plan.fadings.size > 0) {
      animController.current.start(plan, animationDurationMs);
    }
  }, [position, pieces, showAnimations, animationDurationMs]);

  const pieceStates = useMemo(
    () => buildPieceStates(pieces, asWhite, boardWidth, boardHeight, animCurrent, draggingSquare),
    [pieces, asWhite, boardWidth, boardHeight, animCurrent, draggingSquare],
  );

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
      {pieceStates.map((ps) => {
        let opacity = 1;
        let zIndex = 2;

        if (ps.dragging) {
          // Ghost piece at origin: semi-transparent, like chessground/lichess
          opacity = 0.5;
          zIndex = 1;
        } else if (ps.capturing) {
          // Captured piece fading out
          opacity = 0;
          zIndex = 1;
        } else if (ps.animating) {
          zIndex = 8;
        }

        return (
          <div
            key={`${ps.capturing ? 'cap-' : ''}${ps.square}-${ps.piece.color}${ps.piece.role}`}
            style={{
              position: 'absolute',
              width: `${boardWidth / 8}px`,
              height: `${boardHeight / 8}px`,
              transform: `translate(${ps.x}px, ${ps.y}px)`,
              willChange: ps.animating ? 'transform' : undefined,
              opacity,
              zIndex,
              pointerEvents: 'none',
              transition: ps.capturing ? 'opacity 200ms ease' : undefined,
            }}
          >
            {renderPiece(ps.piece)}
          </div>
        );
      })}
    </div>
  );
});
