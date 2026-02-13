import { memo, useMemo } from 'react';
import type { Orientation, BoardTheme, Square } from '../types';
import { FILES, RANKS } from '../types';
import { hexToRgba } from '../utils/colors';

interface SquaresProps {
  theme: BoardTheme;
  orientation: Orientation;
  lastMove?: { from: string; to: string } | null;
  selectedSquare?: string | null;
  legalSquares?: string[];
  premoveSquares?: string[];
  premoveCurrent?: [string, string] | null;
  occupiedSquares?: Set<string>;
  markedSquares?: Record<string, boolean>;
  highlightedSquares?: Record<string, string>;
  check?: string | null;
  lastMoveColor?: string;
}

const MARK_OVERLAY = 'rgba(235, 64, 52, 0.65)';
const MARK_OUTLINE = 'rgba(235, 64, 52, 0.9)';
const SELECTED_OUTLINE = 'rgba(255, 255, 255, 0.95)';
const LEGAL_DOT_BG = 'rgba(80, 37, 19, 0.65)';
const LEGAL_DOT_BORDER = 'rgba(255, 255, 255, 0.9)';
const LEGAL_CAPTURE = 'rgba(80, 37, 19, 0.8)';
const PREMOVE_DOT = 'rgba(20, 85, 30, 0.5)';
const PREMOVE_CAPTURE = 'rgba(20, 85, 30, 0.6)';
const PREMOVE_HIGHLIGHT = 'rgba(20, 30, 85, 0.4)';

export const Squares = memo(function Squares({
  theme,
  orientation,
  lastMove,
  selectedSquare,
  legalSquares = [],
  occupiedSquares,
  premoveSquares = [],
  premoveCurrent,
  markedSquares = {},
  highlightedSquares = {},
  check,
  lastMoveColor,
}: SquaresProps) {
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
        const isSelected = selectedSquare === sq;
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
          backgroundImage = 'radial-gradient(ellipse at center, rgba(255, 0, 0, 1) 0%, rgba(231, 0, 0, 1) 25%, rgba(169, 0, 0, 0) 89%, rgba(158, 0, 0, 0) 100%)';
        }

        // Marked squares (right-click)
        if (isMarked) {
          bg = MARK_OVERLAY;
          outline = `2px solid ${MARK_OUTLINE}`;
          outlineOffset = '-2px';
        }

        // Selected square
        if (isSelected) {
          bg = selectedColor;
          boxShadow = `inset 0 0 0 4px ${SELECTED_OUTLINE}`;
        }

        // Current premove highlight
        if (isPremoveCurrent) {
          bg = PREMOVE_HIGHLIGHT;
        }

        // Legal move indicators
        if (isLegal) {
          if (isOccupied) {
            boxShadow = `inset 0 0 0 5px ${LEGAL_CAPTURE}`;
            borderRadius = '50%';
          } else {
            backgroundImage = `radial-gradient(circle at center, ${LEGAL_DOT_BG} 0%, ${LEGAL_DOT_BG} 10%, ${LEGAL_DOT_BORDER} 10%, ${LEGAL_DOT_BORDER} 14%, transparent 14%)`;
          }
        }

        // Premove destination indicators (similar to legal dots but different color)
        if (isPremoveDest && !isLegal) {
          if (isOccupied) {
            boxShadow = `inset 0 0 0 5px ${PREMOVE_CAPTURE}`;
            borderRadius = '50%';
          } else {
            backgroundImage = `radial-gradient(circle at center, ${PREMOVE_DOT} 0%, ${PREMOVE_DOT} 10%, ${PREMOVE_DOT} 14%, transparent 14%)`;
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
              transition: 'background-color 150ms ease',
            }}
          />
        );
      })}
    </div>
  );
});
