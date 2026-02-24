import { memo, useCallback } from 'react';
import type { PromotionContext, PromotionPiece, PieceSet } from '../types';
import { CachedPieceImg } from '../hooks/usePieceCache';
import { resolvePieceImageSrc } from '../defaultPieces';

const PROMO_PIECES: readonly PromotionPiece[] = ['q', 'r', 'b', 'n'];
const PROMO_LABELS: Record<PromotionPiece, string> = {
  q: 'Queen',
  r: 'Rook',
  b: 'Bishop',
  n: 'Knight',
};

interface PromotionDialogProps {
  promotion: PromotionContext;
  pieceSet?: PieceSet;
  onSelect: (piece: PromotionPiece) => void;
  onDismiss: () => void;
}

export const PromotionDialog = memo(function PromotionDialog({
  promotion,
  pieceSet,
  onSelect,
  onDismiss,
}: PromotionDialogProps) {
  const piecePath = pieceSet?.path;

  const renderPiece = useCallback(
    (color: 'w' | 'b', piece: PromotionPiece) => {
      const key = `${color}${piece.toUpperCase()}`;
      const src = resolvePieceImageSrc(key, piecePath);
      return <CachedPieceImg src={src} alt={key} />;
    },
    [piecePath],
  );

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(17, 24, 39, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={onDismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'rgba(248, 244, 236, 0.98)',
          borderRadius: '10px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          minWidth: '220px',
          boxShadow: '0 18px 40px rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(139, 107, 74, 0.25)',
        }}
      >
        <span style={{ fontSize: '0.95rem', fontWeight: 400, color: '#3B2F23' }}>
          Select promotion piece
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {PROMO_PIECES.map((piece) => (
            <button
              key={piece}
              type="button"
              onClick={() => onSelect(piece)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '10px 12px',
                border: '1px solid rgba(139, 107, 74, 0.25)',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                cursor: 'pointer',
              }}
            >
              <div style={{ width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {renderPiece(promotion.color, piece)}
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: 400, color: '#4B3621' }}>
                {PROMO_LABELS[piece]}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            alignSelf: 'center',
            padding: '6px 12px',
            backgroundColor: 'transparent',
            border: 'none',
            color: 'rgba(107, 83, 59, 0.9)',
            cursor: 'pointer',
            fontSize: '0.85rem',
            textDecoration: 'underline',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
});
