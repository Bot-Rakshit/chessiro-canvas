# chessiro-canvas

Lightweight React chessboard with low overhead interaction primitives inspired by [chessground](https://github.com/lichess-org/chessground).

- Zero runtime dependencies
- TypeScript-first API
- Drag, click-move, arrows, marks, premoves, promotion, overlays
- Built for controlled usage in analysis and coaching apps

## Install

```bash
npm install chessiro-canvas
```

## Quick Start

Your container must define width, and board height follows width (square board).

```tsx
import { useState } from 'react';
import { ChessiroCanvas, INITIAL_FEN } from 'chessiro-canvas';

export default function App() {
  const [fen, setFen] = useState(INITIAL_FEN);

  return (
    <div style={{ width: 520 }}>
      <ChessiroCanvas
        position={fen}
        onMove={(from, to) => {
          // validate + update your game state here
          // return true to accept move, false to reject
          return true;
        }}
      />
    </div>
  );
}
```

## Features

- FEN-based board rendering
- Built-in Chessiro piece set shipped with the package
- Click-to-move and drag-to-move
- Legal move dots and capture rings
- Premoves with optional external event hooks
- Right-click arrows and marks
- Last-move, check, and custom square highlights
- Move-quality badge support
- Promotion chooser
- Text overlays with custom renderer
- Keyboard callbacks (`ArrowLeft`, `ArrowRight`, `Home`, `End`, `F`, `X`, `Escape`)
- Theme, piece set, and custom piece renderer support

## Core API

### `ChessiroCanvas` props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `position` | `string` | start position | FEN (piece placement or full FEN; placement is parsed) |
| `orientation` | `'white' \| 'black'` | `'white'` | Board orientation |
| `interactive` | `boolean` | `true` | Disables move interactions when false |
| `turnColor` | `'w' \| 'b'` | `undefined` | Needed for turn-aware move/premove flow |
| `movableColor` | `'w' \| 'b' \| 'both'` | `undefined` | Restricts which side can move |
| `onMove` | `(from, to, promotion?) => boolean` | `undefined` | Return `true` to accept move |
| `dests` | `Map<Square, Square[]>` | `undefined` | Legal destinations per square |
| `lastMove` | `{ from: string; to: string } \| null` | `undefined` | Last move highlight |
| `check` | `string \| null` | `undefined` | King-in-check square |
| `premovable` | `PremoveConfig` | `undefined` | Enables premove and callbacks |
| `arrows` | `Arrow[]` | `[]` | Controlled arrows |
| `onArrowsChange` | `(arrows) => void` | `undefined` | Arrow updates |
| `markedSquares` | `string[]` | internal | Controlled marks |
| `onMarkedSquaresChange` | `(squares) => void` | `undefined` | Mark updates |
| `arrowBrushes` | `Partial<ArrowBrushes>` | default set | Override arrow colors |
| `snapArrowsToValidMoves` | `boolean` | `true` | Queen/knight snap behavior |
| `theme` | `BoardTheme` | built-in theme | Board colors |
| `pieceSet` | `PieceSet` | bundled Chessiro pieces | Optional custom piece asset path config |
| `pieces` | `Record<string, () => ReactNode>` | `undefined` | Custom piece renderer map |
| `showMargin` | `boolean` | `true` | Margin frame for notation |
| `marginThickness` | `number` | `24` | Margin px |
| `showNotation` | `boolean` | `true` | Coordinate labels |
| `highlightedSquares` | `Record<string, string>` | `{}` | Arbitrary square background colors |
| `moveQualityBadge` | `MoveQualityBadge \| null` | `undefined` | Badge icon on square |
| `allowDragging` | `boolean` | `true` | Drag interaction toggle |
| `allowDrawingArrows` | `boolean` | `true` | Right-click arrows/marks toggle |
| `showAnimations` | `boolean` | `true` | Piece animation toggle |
| `animationDurationMs` | `number` | `200` | Piece animation length |
| `blockTouchScroll` | `boolean` | `false` | Prevent scrolling on touch interaction |
| `overlays` | `TextOverlay[]` | `[]` | Text overlays |
| `overlayRenderer` | `(overlay) => ReactNode` | `undefined` | Custom overlay renderer |
| `onSquareClick` | `(square) => void` | `undefined` | Square click callback |
| `onClearOverlays` | `() => void` | `undefined` | Called when board clears current ply overlays |
| `onPrevious` `onNext` `onFirst` `onLast` `onFlipBoard` `onShowThreat` `onDeselect` | callbacks | `undefined` | Keyboard callback hooks |
| `className` | `string` | `undefined` | Wrapper class |
| `style` | `CSSProperties` | `undefined` | Wrapper style |

### Exported helpers

- `INITIAL_FEN`
- `readFen(fen)` / `writeFen(pieces)`
- `premoveDests(square, pieces, color)`
- `preloadPieceSet(path)`
- `DEFAULT_ARROW_BRUSHES`

## Examples

### Controlled legal moves (`dests`)

```tsx
import { useMemo } from 'react';
import { ChessiroCanvas, type Dests, type Square } from 'chessiro-canvas';

function Board({ fen, legalMovesByFrom, onMove }) {
  const dests = useMemo<Dests>(() => {
    const map = new Map<Square, Square[]>();
    for (const [from, toList] of Object.entries(legalMovesByFrom)) {
      map.set(from as Square, toList as Square[]);
    }
    return map;
  }, [legalMovesByFrom]);

  return (
    <div style={{ width: 560 }}>
      <ChessiroCanvas position={fen} dests={dests} onMove={onMove} />
    </div>
  );
}
```

### Controlled arrows and marks

```tsx
import { useState } from 'react';
import { ChessiroCanvas, type Arrow } from 'chessiro-canvas';

function AnalysisBoard({ fen }: { fen: string }) {
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [marks, setMarks] = useState<string[]>([]);

  return (
    <div style={{ width: 560 }}>
      <ChessiroCanvas
        position={fen}
        arrows={arrows}
        onArrowsChange={setArrows}
        markedSquares={marks}
        onMarkedSquaresChange={setMarks}
      />
    </div>
  );
}
```

### Theme and piece assets

```tsx
<ChessiroCanvas
  position={fen}
  theme={{
    id: 'wood',
    name: 'Wood',
    darkSquare: '#8B5A2B',
    lightSquare: '#F0D9B5',
    margin: '#5C3B1F',
    lastMoveHighlight: '#E7C15D',
    selectedPiece: '#A86634',
  }}
  pieceSet={{
    id: 'alpha',
    name: 'Alpha',
    path: '/pieces/alpha',
  }}
/>
```

## Benchmark vs `react-chessboard`

Latest benchmark file: [`benchmarks/latest.json`](./benchmarks/latest.json)

Run it locally:

```bash
npm run benchmark
```

Method:

- Environment: Node `v25.6.1`, macOS arm64, Apple M4 (10 cores), 16 GB RAM
- 8 measured rounds + 2 warmup rounds
- 300 position updates per round
- Same board size (`640px`) and animations disabled for both libraries
- Metrics: mount wall time, update wall time, React Profiler update duration, bundle gzip
- Harness: `scripts/benchmark.mjs`

Results (generated on 2026-02-23 UTC):

| Metric | chessiro-canvas | react-chessboard | Delta |
| --- | ---: | ---: | ---: |
| Mount wall time (mean) | 8.11 ms | 76.76 ms | 89.4% faster |
| Update wall time (mean, 300 renders) | 652.34 ms | 2938.67 ms | 77.8% faster |
| Update wall per render (mean) | 2.17 ms | 9.80 ms | 77.8% faster |
| React Profiler update duration (mean) | 0.56 ms | 6.33 ms | 91.1% faster |
| Bundle ESM gzip | 14.78 KB | 37.38 KB | 60.5% smaller |

Notes:

- Numbers will vary by machine, Node version, and benchmark config.
- This benchmark is for relative comparison under the same harness, not an absolute browser FPS claim.

## Development

```bash
npm install
npm run dev
npm run build
npm run typecheck
npm run benchmark
```

## License

MIT
