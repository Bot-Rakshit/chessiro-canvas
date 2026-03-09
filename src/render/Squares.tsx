import { memo, useMemo } from 'react';
import type { Orientation, BoardTheme, Square, SquareVisuals } from '../types';
import { FILES, RANKS } from '../types';
import { hexToRgba } from '../utils/colors';

interface SquaresProps {
  theme: BoardTheme;
  orientation: Orientation;
  lastMove?: { from: string; to: string } | null;
  selectedSquare?: string | null;
  draggingSquare?: string | null;
  legalSquares?: string[];
  premoveSquares?: string[];
  premoveCurrent?: [string, string] | null;
  occupiedSquares?: Set<string>;
  markedSquares?: Record<string, boolean>;
  highlightedSquares?: Record<string, string>;
  squareVisuals?: Partial<SquareVisuals>;
  check?: string | null;
  lastMoveColor?: string;
}

const DEFAULT_SQUARE_VISUALS: Required<SquareVisuals> = {
  markOverlay: 'rgba(235, 64, 52, 0.65)',
  markOutline: 'rgba(235, 64, 52, 0.9)',
  selectedOutline: 'rgba(255, 255, 255, 0.95)',
  legalDot: 'rgba(80, 37, 19, 0.65)',
  legalDotOutline: 'rgba(255, 255, 255, 0.9)',
  legalCaptureRing: 'rgba(80, 37, 19, 0.8)',
  premoveDot: 'rgba(20, 85, 30, 0.5)',
  premoveCaptureRing: 'rgba(20, 85, 30, 0.6)',
  premoveCurrent: 'rgba(20, 30, 85, 0.4)',
  checkGradient:
    'radial-gradient(ellipse at center, rgba(255, 0, 0, 1) 0%, rgba(231, 0, 0, 1) 25%, rgba(169, 0, 0, 0) 89%, rgba(158, 0, 0, 0) 100%)',
  selectedStyle: 'fill',
  selectedBorderWidth: 4,
  legalMoveStyle: 'ring',
  legalRingOuterRadius: 24,
  legalRingInnerRadius: 17,
  legalCaptureRingWidth: 7,
};
const EMPTY_SQUARES: string[] = [];
const EMPTY_MARKS: Record<string, boolean> = {};
const EMPTY_HIGHLIGHTS: Record<string, string> = {};
const EMPTY_SQUARE_VISUALS: Partial<SquareVisuals> = {};

export const Squares = memo(function Squares({
  theme,
  orientation,
  lastMove,
  selectedSquare,
  draggingSquare,
  legalSquares = EMPTY_SQUARES,
  occupiedSquares,
  premoveSquares = EMPTY_SQUARES,
  premoveCurrent,
  markedSquares = EMPTY_MARKS,
  highlightedSquares = EMPTY_HIGHLIGHTS,
  squareVisuals = EMPTY_SQUARE_VISUALS,
  check,
  lastMoveColor,
}: SquaresProps) {
  const visuals = useMemo(
    () => ({ ...DEFAULT_SQUARE_VISUALS, ...squareVisuals }),
    [squareVisuals],
  );

  const highlightColor = lastMoveColor
    || hexToRgba(theme.lastMoveHighlight || '#DFAA4E', 0.5)
    || 'rgba(223, 170, 78, 0.5)';

  const selectedColor = hexToRgba(theme.selectedPiece || '#B57340', 0.5)
    || 'rgba(181, 115, 64, 0.5)';

  const asWhite = orientation === 'white';
  const legalSet = useMemo(() => new Set(legalSquares), [legalSquares]);
  const premoveSet = useMemo(() => new Set(premoveSquares), [premoveSquares]);
  const premoveCurrentSet = useMemo(() => {
    if (!premoveCurrent) return new Set<string>();
    return new Set(premoveCurrent);
  }, [premoveCurrent]);

  const squares = useMemo(() => {
    const result: Array<{
      sq: Square;
      isLight: boolean;
      col: number;
      row: number;
    }> = [];

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const file = asWhite ? col : 7 - col;
        const rank = asWhite ? 7 - row : row;
        const sq = `${FILES[file]}${RANKS[rank]}` as Square;
        const isLight = (file + rank) % 2 !== 0;
        result.push({ sq, isLight, col, row });
      }
    }
    return result;
  }, [asWhite]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 1fr)',
        gridTemplateRows: 'repeat(8, 1fr)',
      }}
    >
      {squares.map(({ sq, isLight }) => {
        const isLastMoveFrom = lastMove?.from === sq;
        const isLastMoveTo = lastMove?.to === sq;
        const isSelected = selectedSquare === sq && draggingSquare !== sq;
        const isLegal = legalSet.has(sq);
        const isPremoveDest = premoveSet.has(sq);
        const isPremoveCurrent = premoveCurrentSet.has(sq);
        const isMarked = !!markedSquares[sq];
        const customHighlight = highlightedSquares[sq];
        const isOccupied = occupiedSquares?.has(sq);
        const isCheck = check === sq;

        let bg = isLight ? theme.lightSquare : theme.darkSquare;
        let boxShadow: string | undefined;
        let outline: string | undefined;
        let outlineOffset: string | undefined;
        let backgroundImage: string | undefined;
        let borderRadius: string | undefined;

        // Last move highlight
        if (isLastMoveFrom || isLastMoveTo) {
          bg = highlightColor;
        }

        // Custom highlights
        if (customHighlight) {
          bg = customHighlight;
        }

        // Check highlight (radial red glow, like lichess/chessground)
        if (isCheck) {
          backgroundImage = visuals.checkGradient;
        }

        // Marked squares (right-click)
        if (isMarked) {
          bg = visuals.markOverlay;
          outline = `2px solid ${visuals.markOutline}`;
          outlineOffset = '-2px';
        }

        // Selected square
        if (isSelected) {
          const style = visuals.selectedStyle;
          if (style === 'fill' || style === 'both') {
            bg = selectedColor;
          }
          if (style === 'border' || style === 'both') {
            boxShadow = `inset 0 0 0 ${visuals.selectedBorderWidth}px ${visuals.selectedOutline}`;
          }
        }

        // Current premove highlight
        if (isPremoveCurrent) {
          bg = visuals.premoveCurrent;
        }

        // Legal move indicators
        if (isLegal) {
          if (isOccupied) {
            boxShadow = `inset 0 0 0 ${visuals.legalCaptureRingWidth}px ${visuals.legalCaptureRing}`;
            borderRadius = '50%';
          } else if (visuals.legalMoveStyle === 'ring') {
            const inner = visuals.legalRingInnerRadius;
            const outer = visuals.legalRingOuterRadius;
            backgroundImage = `radial-gradient(circle at center, transparent 0%, transparent ${inner}%, ${visuals.legalDot} ${inner}%, ${visuals.legalDot} ${outer}%, transparent ${outer}%)`;
          } else {
            backgroundImage = `radial-gradient(circle at center, ${visuals.legalDot} 0%, ${visuals.legalDot} 15%, ${visuals.legalDotOutline} 15%, ${visuals.legalDotOutline} 19%, transparent 19%)`;
          }
        }

        // Premove destination indicators (same style, different color)
        if (isPremoveDest && !isLegal) {
          if (isOccupied) {
            boxShadow = `inset 0 0 0 ${visuals.legalCaptureRingWidth}px ${visuals.premoveCaptureRing}`;
            borderRadius = '50%';
          } else if (visuals.legalMoveStyle === 'ring') {
            const inner = visuals.legalRingInnerRadius;
            const outer = visuals.legalRingOuterRadius;
            backgroundImage = `radial-gradient(circle at center, transparent 0%, transparent ${inner}%, ${visuals.premoveDot} ${inner}%, ${visuals.premoveDot} ${outer}%, transparent ${outer}%)`;
          } else {
            backgroundImage = `radial-gradient(circle at center, ${visuals.premoveDot} 0%, ${visuals.premoveDot} 15%, ${visuals.premoveDot} 19%, transparent 19%)`;
          }
        }

        return (
          <div
            key={sq}
            data-square={sq}
            style={{
              backgroundColor: bg,
              boxShadow,
              outline,
              outlineOffset,
              backgroundImage,
              borderRadius,
              position: 'relative',
            }}
          />
        );
      })}
    </div>
  );
});
