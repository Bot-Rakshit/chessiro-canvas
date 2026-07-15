import { memo } from 'react';
import type { Orientation, Square, SquareLabel } from '../types';

interface SquareLabelsLayerProps {
  labels: Record<string, string | SquareLabel>;
  orientation: Orientation;
}

function squareColRow(sq: Square, asWhite: boolean): [number, number] {
  const f = sq.charCodeAt(0) - 97;
  const r = sq.charCodeAt(1) - 49;
  return [asWhite ? f : 7 - f, asWhite ? 7 - r : r];
}

function isValidSquare(sq: string): sq is Square {
  return /^[a-h][1-8]$/.test(sq);
}

const CORNER_POSITIONS: Record<NonNullable<SquareLabel['corner']>, React.CSSProperties> = {
  topLeft: { top: '4%', left: '4%' },
  topRight: { top: '4%', right: '4%' },
  bottomLeft: { bottom: '4%', left: '4%' },
  bottomRight: { bottom: '4%', right: '4%' },
  center: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
};

/**
 * Small text badges on squares for teaching: attacker counts, move numbers,
 * "!" / "?" annotations, candidate-move letters, etc.
 */
export const SquareLabelsLayer = memo(function SquareLabelsLayer({
  labels,
  orientation,
}: SquareLabelsLayerProps) {
  const asWhite = orientation === 'white';
  const entries = Object.entries(labels);
  if (entries.length === 0) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 6 }}>
      {entries.map(([sq, raw]) => {
        if (!isValidSquare(sq)) return null;
        const label: SquareLabel = typeof raw === 'string' ? { text: raw } : raw;
        if (!label.text) return null;
        const [col, row] = squareColRow(sq, asWhite);
        const corner = label.corner ?? 'topRight';
        return (
          <div
            key={`label-${sq}`}
            style={{
              position: 'absolute',
              width: '12.5%',
              height: '12.5%',
              transform: `translate(${col * 100}%, ${row * 100}%)`,
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                position: 'absolute',
                ...CORNER_POSITIONS[corner],
                minWidth: '1.5em',
                padding: '0.1em 0.35em',
                borderRadius: '999px',
                background: label.background ?? 'rgba(15, 23, 42, 0.85)',
                color: label.color ?? '#ffffff',
                fontSize: label.fontSize ?? 'clamp(9px, 1.6vmin, 13px)',
                fontWeight: 700,
                fontFamily: 'system-ui, sans-serif',
                lineHeight: 1.4,
                textAlign: 'center',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.35)',
              }}
            >
              {label.text}
            </span>
          </div>
        );
      })}
    </div>
  );
});
