import { memo, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import type { Piece, PieceSet, PieceRenderer } from '../types';
import { CachedPieceImg } from '../hooks/usePieceCache';
import { resolvePieceImageSrc } from '../defaultPieces';

interface DragGhostProps {
  piece: Piece;
  x: number;
  y: number;
  squareSize: number;
  pieceSet?: PieceSet;
  customPieces?: PieceRenderer;
  /** Scale factor applied to the dragged piece. Default: 1. */
  scale?: number;
  /** Upward offset (in square-size units) so the piece floats above the finger/cursor. Default: 0. */
  liftSquares?: number;
}

export const DragGhost = memo(forwardRef<HTMLDivElement, DragGhostProps>(function DragGhost({
  piece,
  x,
  y,
  squareSize,
  pieceSet,
  customPieces,
  scale = 1,
  liftSquares = 0,
}, ref) {
  const piecePath = pieceSet?.path;
  const key = `${piece.color}${piece.role.toUpperCase()}`;

  let content: React.ReactNode;
  if (customPieces?.[key]) {
    content = customPieces[key]();
  } else {
    const src = resolvePieceImageSrc(key, piecePath);
    content = <CachedPieceImg src={src} alt={key} />;
  }

  // Outer div: positioning only. useInteraction rewrites this `transform` on pointermove,
  // so keep it a plain translate to avoid interference from scale/lift.
  const offset = squareSize / 2;
  // Inner wrapper carries the visual transform (scale + lift).
  const lift = liftSquares * squareSize;
  const liftTransform = scale !== 1 || lift !== 0
    ? `translate(0, ${-lift}px) scale(${scale})`
    : undefined;

  const ghost = (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        width: squareSize,
        height: squareSize,
        left: 0,
        top: 0,
        transform: `translate(${x - offset}px, ${y - offset}px)`,
        pointerEvents: 'none',
        zIndex: 100,
        willChange: 'transform',
        cursor: 'grabbing',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          transform: liftTransform,
          transformOrigin: 'center center',
          transition: 'transform 80ms ease-out',
        }}
      >
        {content}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return ghost;
  return createPortal(ghost, document.body);
}));
