# chessiro-canvas

> **WIP** -- This library is under active development. The animation system has known issues in React Strict Mode (Next.js dev). Use at your own risk until a stable 1.0 release.

A lightweight, high-performance React chessboard component. Zero runtime dependencies. Inspired by [chessground](https://github.com/lichess-org/chessground).

**~10 KB** min+gzip. No @dnd-kit, no heavy abstractions -- just React, pointer events, and SVG.

## Install

```bash
npm install chessiro-canvas
```

## Usage

```tsx
import { ChessiroCanvas } from 'chessiro-canvas';

function App() {
  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

  return (
    <ChessiroCanvas
      position={fen}
      orientation="white"
      onMove={(from, to) => {
        // handle move, update fen
        return true;
      }}
    />
  );
}
```

## Features

- **Piece rendering from FEN** with smooth animation on position changes
- **Click-to-move** with legal move dots and capture rings
- **Drag and drop** with ghost piece at origin (like lichess)
- **Arrow drawing** (right-click drag) with modifier key colors (green/red/blue/yellow)
- **Square marking** (right-click a square)
- **Premove system** with destination dots and auto-play
- **Check highlighting** with radial red glow
- **Promotion dialog**
- **Coordinate notation** (margin or on-board modes)
- **Board orientation** flip
- **Custom themes** and piece sets
- **Move quality badges**
- **Text overlays** (disappearing text, custom renderers)
- **Keyboard shortcuts** (F=flip, arrows=navigate, Escape=deselect)
- **Touch support** with scroll prevention

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `position` | `string` | Starting FEN | FEN string for board position |
| `orientation` | `'white' \| 'black'` | `'white'` | Board orientation |
| `interactive` | `boolean` | `true` | Allow user interaction |
| `turnColor` | `PieceColor` | - | Current turn ('w' or 'b'). Omit for free mode |
| `movableColor` | `PieceColor \| 'both'` | - | Which color can move |
| `onMove` | `(from, to, promo?) => boolean` | - | Move handler. Return true to accept |
| `dests` | `Dests` | - | Legal destinations map |
| `lastMove` | `{ from, to }` | - | Highlight last move squares |
| `check` | `string` | - | Square of king in check |
| `arrows` | `Arrow[]` | `[]` | Arrows to display |
| `onArrowsChange` | `(arrows) => void` | - | Arrow change callback |
| `theme` | `BoardTheme` | Chessiro theme | Board colors |
| `pieceSet` | `PieceSet` | Default pieces | Custom piece images |
| `showMargin` | `boolean` | `true` | Show coordinate margin |
| `showNotation` | `boolean` | `true` | Show file/rank labels |
| `showAnimations` | `boolean` | `true` | Enable animations |
| `animationDurationMs` | `number` | `200` | Animation duration |
| `allowDragging` | `boolean` | `true` | Allow drag and drop |
| `allowDrawingArrows` | `boolean` | `true` | Allow right-click arrows |
| `premovable` | `PremoveConfig` | - | Premove configuration |
| `blockTouchScroll` | `boolean` | `false` | Prevent touch scrolling |

## Arrow Brush Colors

| Modifier | Color |
|----------|-------|
| None | Green |
| Shift or Ctrl | Red |
| Alt or Meta | Blue |
| Shift + Alt | Yellow |

## Size Comparison

| Library | Min+Gzip | Runtime Deps |
|---------|----------|-------------|
| react-chessboard | ~36 KB | 2 |
| chessground | ~11.6 KB | 0 |
| **chessiro-canvas** | **~10.2 KB** | **0** |

## License

MIT
