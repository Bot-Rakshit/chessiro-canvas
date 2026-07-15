import { memo } from 'react';
import type { ReactNode } from 'react';
import type { PieceSet, PieceRenderer } from '../types';
import { CachedPieceImg } from '../hooks/usePieceCache';
import { resolvePieceImageSrc } from '../defaultPieces';

interface PieceGlyphProps {
  /** Piece key like 'wQ', 'bN'. */
  pieceKey: string;
  pieceSet?: PieceSet;
  customPieces?: PieceRenderer;
}

export const PieceGlyph = memo(function PieceGlyph({
  pieceKey,
  pieceSet,
  customPieces,
}: PieceGlyphProps): ReactNode {
  if (customPieces?.[pieceKey]) {
    return customPieces[pieceKey]();
  }
  const src = resolvePieceImageSrc(pieceKey, pieceSet?.path);
  return <CachedPieceImg src={src} alt={pieceKey} />;
});
