import { memo } from 'react';
import type { Orientation, BoardTheme } from '../types';
import { FILES, RANKS } from '../types';

interface NotationProps {
  orientation: Orientation;
  theme: BoardTheme;
  showOnMargin: boolean;
  marginThickness: number;
}

export const Notation = memo(function Notation({
  orientation,
  theme,
  showOnMargin,
  marginThickness,
}: NotationProps) {
  const asWhite = orientation === 'white';
  const files = asWhite ? FILES : [...FILES].reverse();
  const ranks = asWhite ? [...RANKS].reverse() : RANKS;

  if (showOnMargin) {
    return <MarginNotation files={files} ranks={ranks} theme={theme} thickness={marginThickness} />;
  }

  return <OnBoardNotation files={files} ranks={ranks} theme={theme} orientation={orientation} />;
});

const notationFont = 'var(--font-geist-sans, system-ui, sans-serif)';

const coordStyle = (theme: BoardTheme): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '12px',
  fontWeight: 500,
  fontFamily: notationFont,
  color: theme.lightSquare,
  userSelect: 'none',
});

function MarginNotation({
  files,
  ranks,
  theme,
  thickness,
}: {
  files: readonly string[];
  ranks: readonly string[];
  theme: BoardTheme;
  thickness: number;
}) {
  const bg = theme.margin || theme.darkSquare;
  const cs = coordStyle(theme);

  return (
    <>
      {/* Top margin */}
      <div
        style={{
          position: 'absolute',
          top: -thickness,
          left: -thickness,
          right: -thickness,
          height: thickness,
          backgroundColor: bg,
          borderTopLeftRadius: 4,
          borderTopRightRadius: 4,
        }}
      />
      {/* Bottom margin with file labels */}
      <div
        style={{
          position: 'absolute',
          bottom: -thickness,
          left: -thickness,
          right: -thickness,
          height: thickness,
          display: 'flex',
          backgroundColor: bg,
          borderBottomLeftRadius: 4,
          borderBottomRightRadius: 4,
        }}
      >
        <div style={{ width: thickness, flexShrink: 0 }} />
        {files.map((f) => (
          <div key={f} style={{ flex: 1, ...cs }}>{f}</div>
        ))}
        <div style={{ width: thickness, flexShrink: 0 }} />
      </div>
      {/* Left margin with rank labels */}
      <div
        style={{
          position: 'absolute',
          left: -thickness,
          top: 0,
          bottom: 0,
          width: thickness,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: bg,
        }}
      >
        {ranks.map((r) => (
          <div key={r} style={{ flex: 1, ...cs }}>{r}</div>
        ))}
      </div>
      {/* Right margin */}
      <div
        style={{
          position: 'absolute',
          right: -thickness,
          top: 0,
          bottom: 0,
          width: thickness,
          backgroundColor: bg,
        }}
      />
    </>
  );
}

// Lichess-style on-board notation:
// - File letters (a-h) at bottom-right corner of each bottom-row square
// - Rank numbers (1-8) at top-left corner of each left-column square
// - Alternating colors to contrast with the square they're on
function OnBoardNotation({
  files,
  ranks,
  theme,
  orientation,
}: {
  files: readonly string[];
  ranks: readonly string[];
  theme: BoardTheme;
  orientation: Orientation;
}) {
  const asWhite = orientation === 'white';

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 10,
    }}>
      {/* File letters - bottom-right corner of each square in the bottom row */}
      {files.map((f, i) => {
        // Bottom row: for white, rank 1 squares are at bottom. For black, rank 8 squares.
        // The square color alternates. file index 0 = a-file.
        // For bottom-right placement, the text sits in the last row.
        // Square is light if (file + rank) is odd (0-indexed).
        const bottomRank = asWhite ? 0 : 7;
        const isLight = (i + bottomRank) % 2 !== 0;
        return (
          <div
            key={`f-${f}`}
            style={{
              position: 'absolute',
              bottom: '1px',
              right: `${(7 - i) * 12.5 + 0.5}%`,
              fontSize: '10px',
              fontWeight: 700,
              fontFamily: notationFont,
              color: isLight ? theme.darkSquare : theme.lightSquare,
              opacity: 0.85,
              userSelect: 'none',
              lineHeight: 1,
            }}
          >
            {f}
          </div>
        );
      })}
      {/* Rank numbers - top-left corner of each square in the left column */}
      {ranks.map((r, i) => {
        // Left column: for white, a-file is at left. For black, h-file is at left.
        const leftFile = asWhite ? 0 : 7;
        const rankIdx = asWhite ? 7 - i : i; // row index to rank index
        const isLight = (leftFile + rankIdx) % 2 !== 0;
        return (
          <div
            key={`r-${r}`}
            style={{
              position: 'absolute',
              top: `${i * 12.5 + 0.5}%`,
              left: '2px',
              fontSize: '10px',
              fontWeight: 700,
              fontFamily: notationFont,
              color: isLight ? theme.darkSquare : theme.lightSquare,
              opacity: 0.85,
              userSelect: 'none',
              lineHeight: 1,
            }}
          >
            {r}
          </div>
        );
      })}
    </div>
  );
}
