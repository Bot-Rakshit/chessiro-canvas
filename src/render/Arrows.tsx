import { memo, useMemo } from 'react';
import type { Arrow, Orientation } from '../types';

interface ArrowsProps {
  arrows: Arrow[];
  orientation: Orientation;
  boardWidth: number;
  boardHeight: number;
}

// Chessground-style normalized coordinate system:
// viewBox="-4 -4 8 8", square centers at -3.5..3.5
function pos2user(
  fileIdx: number,
  rankIdx: number,
  asWhite: boolean,
  boardWidth: number,
  boardHeight: number,
): [number, number] {
  const f = asWhite ? fileIdx : 7 - fileIdx;
  const r = asWhite ? rankIdx : 7 - rankIdx;
  const xScale = Math.min(1, boardWidth / boardHeight);
  const yScale = Math.min(1, boardHeight / boardWidth);
  return [(f - 3.5) * xScale, (3.5 - r) * yScale];
}

function squareToFileRank(sq: string): [number, number] | null {
  if (sq.length !== 2) return null;
  const f = sq.charCodeAt(0) - 97;
  const r = parseInt(sq[1]) - 1;
  if (f < 0 || f > 7 || r < 0 || r > 7) return null;
  return [f, r];
}

export const ArrowsLayer = memo(function ArrowsLayer({
  arrows,
  orientation,
  boardWidth,
  boardHeight,
}: ArrowsProps) {
  const asWhite = orientation === 'white';

  const markerColors = useMemo(() => {
    const set = new Set<string>();
    for (const a of arrows) set.add(a.color);
    return [...set];
  }, [arrows]);

  if (arrows.length === 0 || boardWidth === 0) return null;

  // Line width in normalized coordinates (chessground: (lineWidth || 10) / 64)
  const lineW = 10 / 64;
  // Arrow margin: shorten line by this amount so arrowhead sits at square center
  const margin = 10 / 64;

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex: 5,
      }}
      viewBox="-4 -4 8 8"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        {markerColors.map((color) => (
          <marker
            key={markerKey(color)}
            id={markerKey(color)}
            orient="auto"
            overflow="visible"
            markerWidth={4}
            markerHeight={4}
            refX={2.05}
            refY={2}
          >
            <path d="M0,0 V4 L3,2 Z" fill={color} />
          </marker>
        ))}
      </defs>
      {arrows.map((arrow, i) => {
        const fromFR = squareToFileRank(arrow.startSquare);
        const toFR = squareToFileRank(arrow.endSquare);
        if (!fromFR || !toFR) return null;

        const from = pos2user(fromFR[0], fromFR[1], asWhite, boardWidth, boardHeight);
        const to = pos2user(toFR[0], toFR[1], asWhite, boardWidth, boardHeight);

        const dx = to[0] - from[0];
        const dy = to[1] - from[1];
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return null;

        // Shorten the line by margin so the arrowhead tip lands on the dest center
        const angle = Math.atan2(dy, dx);
        const endX = to[0] - Math.cos(angle) * margin;
        const endY = to[1] - Math.sin(angle) * margin;

        return (
          <line
            key={`${arrow.startSquare}-${arrow.endSquare}-${arrow.color}-${i}`}
            x1={from[0]}
            y1={from[1]}
            x2={endX}
            y2={endY}
            stroke={arrow.color}
            strokeWidth={lineW}
            strokeLinecap="round"
            markerEnd={`url(#${markerKey(arrow.color)})`}
            opacity={0.9}
          />
        );
      })}
    </svg>
  );
});

function markerKey(color: string): string {
  return `cc-ah-${color.replace(/[^a-zA-Z0-9]/g, '')}`;
}
