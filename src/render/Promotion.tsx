import { memo, useCallback, useEffect, useState } from 'react';
import type { Orientation, PromotionContext, PromotionPiece, PieceSet, PromotionVisuals } from '../types';
import { CachedPieceImg } from '../hooks/usePieceCache';
import { resolvePieceImageSrc } from '../defaultPieces';

const PROMO_PIECES: readonly PromotionPiece[] = ['q', 'n', 'r', 'b'];
const PROMO_LABELS: Record<PromotionPiece, string> = {
  q: 'Queen',
  n: 'Knight',
  r: 'Rook',
  b: 'Bishop',
};

interface PromotionDialogProps {
  promotion: PromotionContext;
  pieceSet?: PieceSet;
  flipPieces?: boolean;
  visuals?: Partial<PromotionVisuals>;
  orientation: Orientation;
  boardWidth: number;
  boardHeight: number;
  onSelect: (piece: PromotionPiece) => void;
  onDismiss: () => void;
}

export const PromotionDialog = memo(function PromotionDialog({
  promotion,
  pieceSet,
  flipPieces = false,
  visuals = {},
  orientation,
  boardWidth,
  boardHeight,
  onSelect,
  onDismiss,
}: PromotionDialogProps) {
  const [entered, setEntered] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  const asWhite = orientation === 'white';
  const fileIdx = promotion.to.charCodeAt(0) - 97;
  const rankIdx = promotion.to.charCodeAt(1) - 49;
  const sqW = boardWidth / 8;
  const sqH = boardHeight / 8;

  const cellX = (asWhite ? fileIdx : 7 - fileIdx) * sqW;
  const cellY = (asWhite ? 7 - rankIdx : rankIdx) * sqH;
  const extendsDown = cellY + sqH / 2 < boardHeight / 2;

  const panelPadding = Math.max(3, sqW * 0.04);
  const cellGap = Math.max(2, sqW * 0.02);
  const cellSize = sqW;
  const stackHeight = 4 * cellSize + 3 * cellGap + panelPadding * 2;
  const stackTop = extendsDown
    ? cellY - panelPadding
    : cellY + sqH + panelPadding - stackHeight;

  const renderPiece = useCallback(
    (piece: PromotionPiece) => {
      const key = `${promotion.color}${piece.toUpperCase()}`;
      const src = resolvePieceImageSrc(key, pieceSet?.path);
      return <CachedPieceImg src={src} alt={key} />;
    },
    [promotion.color, pieceSet?.path],
  );

  const visualPieces = extendsDown ? PROMO_PIECES : [...PROMO_PIECES].reverse();

  return (
    <div
      role="dialog"
      aria-label="Choose promotion piece"
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: visuals.backdropColor || 'rgba(15, 18, 25, 0.35)',
        opacity: entered ? 1 : 0,
        transition: 'opacity 160ms ease-out',
        zIndex: 20,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={onDismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          left: cellX - panelPadding,
          top: stackTop,
          width: cellSize + panelPadding * 2,
          padding: panelPadding,
          display: 'flex',
          flexDirection: 'column',
          gap: cellGap,
          backgroundColor: visuals.panelColor || 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderRadius: visuals.panelRadius || '12px',
          border: `1px solid ${visuals.panelBorderColor || 'rgba(15, 23, 42, 0.1)'}`,
          boxShadow: visuals.panelShadow
            || '0 10px 28px rgba(15, 23, 42, 0.22), 0 2px 8px rgba(15, 23, 42, 0.12)',
        }}
      >
        {visualPieces.map((piece, i) => {
          const distanceFromAnchor = extendsDown ? i : PROMO_PIECES.length - 1 - i;
          const isHovered = hovered === i;
          return (
            <button
              key={piece}
              type="button"
              aria-label={`Promote to ${PROMO_LABELS[piece]}`}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
              onClick={() => onSelect(piece)}
              style={{
                appearance: 'none',
                width: cellSize,
                height: cellSize,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: `${cellSize * 0.09}px`,
                border: `1px solid ${isHovered
                  ? (visuals.optionBorderColor || 'rgba(15, 23, 42, 0.22)')
                  : 'transparent'}`,
                borderRadius: visuals.optionRadius || '8px',
                backgroundColor: isHovered
                  ? (visuals.optionHoverBackground || 'rgba(15, 23, 42, 0.07)')
                  : (visuals.optionBackground || 'transparent'),
                cursor: 'pointer',
                opacity: entered ? 1 : 0,
                transform: entered ? 'translateY(0)' : `translateY(${extendsDown ? '-10px' : '10px'})`,
                transition: 'opacity 200ms ease-out, transform 200ms cubic-bezier(0.2, 0.8, 0.3, 1), background-color 120ms ease, border-color 120ms ease',
                transitionDelay: entered ? `${distanceFromAnchor * 28}ms` : '0ms',
              }}
            >
              <span
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: flipPieces ? 'rotate(180deg)' : undefined,
                }}
              >
                {renderPiece(piece)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
