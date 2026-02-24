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

### Piece Rendering (Default + Custom)

`ChessiroCanvas` ships with embedded default SVG pieces and renders them by default with no asset hosting setup.

```tsx
<ChessiroCanvas position={fen} />
```

Piece license note:
- Bundled default piece artwork is generated from `react-chessboard` defaults (MIT license).
- You can replace it any time via `pieceSet.path`.

Use `pieceSet.path` only when you want to override with your own hosted piece set.

```tsx
<ChessiroCanvas
  position={fen}
  pieceSet={{
    id: 'alpha',
    name: 'Alpha',
    path: '/pieces/alpha', // expects /pieces/alpha/wp.svg ... /bk.svg
  }}
/>
```

If pieces appear as broken images, upgrade to the latest package version.

### Customize Legal Move UI

Use `squareVisuals` to customize legal dots, capture rings, premove hints, marks, and check overlay.

```tsx
<ChessiroCanvas
  position={fen}
  dests={dests}
  squareVisuals={{
    legalDot: 'rgba(30, 144, 255, 0.55)',
    legalDotOutline: 'rgba(255, 255, 255, 0.95)',
    legalCaptureRing: 'rgba(30, 144, 255, 0.8)',
    premoveDot: 'rgba(155, 89, 182, 0.55)',
    premoveCaptureRing: 'rgba(155, 89, 182, 0.75)',
    selectedOutline: 'rgba(255, 255, 255, 1)',
    markOverlay: 'rgba(244, 67, 54, 0.6)',
    markOutline: 'rgba(244, 67, 54, 0.9)',
  }}
/>
```

### Customize Other UI Layers

```tsx
<ChessiroCanvas
  position={fen}
  arrowVisuals={{
    lineWidth: 0.2,
    opacity: 1,
    markerWidth: 5,
    markerHeight: 5,
  }}
  notationVisuals={{
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    onBoardFontSize: '11px',
    opacity: 0.95,
  }}
  promotionVisuals={{
    panelColor: 'rgba(20, 24, 36, 0.98)',
    titleColor: '#f2f6ff',
    optionBackground: 'rgba(255, 255, 255, 0.08)',
    optionTextColor: '#f2f6ff',
    cancelTextColor: '#cbd5e1',
  }}
  overlayVisuals={{
    background: 'rgba(2, 6, 23, 0.85)',
    color: '#f8fafc',
    borderRadius: '6px',
    fontSize: '11px',
  }}
/>
```

## Integration With `chess.js`

```bash
npm install chess.js chessiro-canvas
```

```tsx
import { useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { ChessiroCanvas, type Dests, type Square } from 'chessiro-canvas';

export function ChessJsBoard() {
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(() => chess.fen());

  const dests = useMemo<Dests>(() => {
    const map = new Map<Square, Square[]>();
    const moves = chess.moves({ verbose: true });
    for (const move of moves) {
      const from = move.from as Square;
      const to = move.to as Square;
      const current = map.get(from);
      if (current) current.push(to);
      else map.set(from, [to]);
    }
    return map;
  }, [chess, fen]);

  return (
    <ChessiroCanvas
      position={fen}
      turnColor={chess.turn()}
      movableColor={chess.turn()}
      dests={dests}
      onMove={(from, to, promotion) => {
        const result = chess.move({ from, to, promotion });
        if (!result) return false;
        setFen(chess.fen());
        return true;
      }}
    />
  );
}
```

## Integration With `chessops`

```bash
npm install chessops chessiro-canvas
```

```tsx
import { useMemo, useState } from 'react';
import { Chess } from 'chessops/chess';
import { chessgroundDests } from 'chessops/compat';
import { parseFen, makeFen } from 'chessops/fen';
import { parseUci } from 'chessops/util';
import { ChessiroCanvas, INITIAL_FEN } from 'chessiro-canvas';

export function ChessopsBoard() {
  const [pos, setPos] = useState(() =>
    Chess.fromSetup(parseFen(INITIAL_FEN).unwrap()).unwrap(),
  );

  const fen = useMemo(() => makeFen(pos.toSetup()), [pos]);
  const dests = useMemo(() => chessgroundDests(pos), [pos]);
  const turn = pos.turn === 'white' ? 'w' : 'b';

  return (
    <ChessiroCanvas
      position={fen}
      turnColor={turn}
      movableColor={turn}
      dests={dests}
      onMove={(from, to, promotion) => {
        const uci = `${from}${to}${promotion ?? ''}`;
        const move = parseUci(uci);
        if (!move || !pos.isLegal(move)) return false;
        const next = pos.clone();
        next.play(move);
        setPos(next);
        return true;
      }}
    />
  );
}
```

## Features

- FEN-based board rendering
- Built-in default piece set shipped with the package
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
| `arrowVisuals` | `Partial<ArrowVisuals>` | `undefined` | Customize arrow width, opacity, marker size, and arrow margin |
| `snapArrowsToValidMoves` | `boolean` | `true` | Queen/knight snap behavior |
| `theme` | `BoardTheme` | built-in theme | Board colors |
| `pieceSet` | `PieceSet` | bundled default pieces | Optional custom piece asset path config |
| `pieces` | `Record<string, () => ReactNode>` | `undefined` | Custom piece renderer map |
| `showMargin` | `boolean` | `true` | Margin frame for notation |
| `marginThickness` | `number` | `24` | Margin px |
| `showNotation` | `boolean` | `true` | Coordinate labels |
| `notationVisuals` | `Partial<NotationVisuals>` | `undefined` | Customize notation font family, size, weight, color, and offsets |
| `highlightedSquares` | `Record<string, string>` | `{}` | Arbitrary square background colors |
| `squareVisuals` | `Partial<SquareVisuals>` | `undefined` | Customize legal/premove indicators, marks, selected outline, and check overlay |
| `moveQualityBadge` | `MoveQualityBadge \| null` | `undefined` | Badge icon on square |
| `allowDragging` | `boolean` | `true` | Drag interaction toggle |
| `allowDrawingArrows` | `boolean` | `true` | Right-click arrows/marks toggle |
| `showAnimations` | `boolean` | `true` | Piece animation toggle |
| `animationDurationMs` | `number` | `200` | Piece animation length |
| `blockTouchScroll` | `boolean` | `false` | Prevent scrolling on touch interaction |
| `overlays` | `TextOverlay[]` | `[]` | Text overlays |
| `overlayRenderer` | `(overlay) => ReactNode` | `undefined` | Custom overlay renderer |
| `overlayVisuals` | `Partial<OverlayVisuals>` | `undefined` | Customize default overlay bubble style (when `overlayRenderer` is not provided) |
| `onSquareClick` | `(square) => void` | `undefined` | Square click callback |
| `onClearOverlays` | `() => void` | `undefined` | Called when board clears current ply overlays |
| `promotionVisuals` | `Partial<PromotionVisuals>` | `undefined` | Customize promotion dialog backdrop, panel, option buttons, and text colors |
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

Results (generated on 2026-02-24 UTC):

| Metric | chessiro-canvas | react-chessboard | Delta |
| --- | ---: | ---: | ---: |
| Mount wall time (mean) | 3.13 ms | 14.23 ms | 78.0% faster |
| Update wall time (mean, 300 renders) | 277.42 ms | 733.11 ms | 62.2% faster |
| Update wall per render (mean) | 0.92 ms | 2.44 ms | 62.2% faster |
| React Profiler update duration (mean) | 0.22 ms | 1.33 ms | 83.4% faster |
| Bundle ESM gzip | 31.41 KB | 37.38 KB | 16.0% smaller |

Notes:

- Numbers will vary by machine, Node version, and benchmark config.
- This benchmark is for relative comparison under the same harness, not an absolute browser FPS claim.

## Development

```bash
npm install
npm run dev
npm run docs:dev
npm run build
npm run typecheck
npm run benchmark
```

## License

MIT
