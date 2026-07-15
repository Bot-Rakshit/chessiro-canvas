import { memo } from 'react';
import type { GhostPiece, Orientation, PieceSet, PieceRenderer, Square } from '../types';
import { PieceGlyph } from './PieceGlyph';

interface GhostPiecesLayerProps {
  ghosts: GhostPiece[];
  orientation: Orientation;
  pieceSet?: PieceSet;
  customPieces?: PieceRenderer;
  flipPieces?: boolean;
}

function squareColRow(sq: Square, asWhite: boolean): [number, number] {
  const f = sq.charCodeAt(0) - 97;
  const r = sq.charCodeAt(1) - 49;
  return [asWhite ? f : 7 - f, asWhite ? 7 - r : r];
}

function isValidSquare(sq: string): sq is Square {
  return /^[a-h][1-8]$/.test(sq);
}

/**
 * Translucent "hint" pieces for teaching: show where a piece could or should
 * be placed without touching the real position (e.g. "your knight belongs on
 * f5"). Rendered under the real pieces, non-interactive.
 */
export const GhostPiecesLayer = memo(function GhostPiecesLayer({
  ghosts,
  orientation,
  pieceSet,
  customPieces,
  flipPieces = false,
}: GhostPiecesLayerProps) {
  const asWhite = orientation === 'white';

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {ghosts.map((g, i) => {
        if (!isValidSquare(g.square)) return null;
        const [col, row] = squareColRow(g.square, asWhite);
        const scale = g.scale ?? 1;
        return (
          <div
            key={`ghost-${g.square}-${g.piece}-${i}`}
            style={{
              position: 'absolute',
              width: '12.5%',
              height: '12.5%',
              transform: `translate(${col * 100}%, ${row * 100}%)`,
              opacity: g.opacity ?? 0.45,
              zIndex: 1,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                transform: [
                  flipPieces ? 'rotate(180deg)' : '',
                  scale !== 1 ? `scale(${scale})` : '',
                ].filter(Boolean).join(' ') || undefined,
                transformOrigin: 'center center',
              }}
            >
              <PieceGlyph pieceKey={g.piece} pieceSet={pieceSet} customPieces={customPieces} />
            </div>
          </div>
        );
      })}
    </div>
  );
});
