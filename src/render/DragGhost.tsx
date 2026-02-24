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
}

export const DragGhost = memo(forwardRef<HTMLDivElement, DragGhostProps>(function DragGhost({
  piece,
  x,
  y,
  squareSize,
  pieceSet,
  customPieces,
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

  // Offset so piece is centered under the cursor
  const offset = squareSize / 2;

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
      {content}
    </div>
  );

  if (typeof document === 'undefined') return ghost;
  return createPortal(ghost, document.body);
}));
