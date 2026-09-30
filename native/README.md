# chessiro-canvas-native

A fast chessboard for **React Native** and **Expo**, the native counterpart of
[`chessiro-canvas`](https://chessiro-canvas.vercel.app/). It uses the same
controlled API: pass a FEN `position` and answer `onMove`. It also shares the
web board's motion model, so both boards animate moves the same way.

- **Drag and move animations run on the UI thread.** Drag, snap-back, move,
  capture, promotion and flip animations all run through Reanimated worklets,
  and the JS thread does no work per frame.
- **Any easing curve.** The shared core samples each easing (spring, bounce,
  back-out or your own function) into keyframes. The UI thread then
  interpolates linearly between them.
- **Touch-first interaction.** You can tap a piece and then tap a square, or
  drag and drop. A dragged piece is lifted like on chessground, and the square
  under your finger is highlighted.
- **Game features.** Legal-move hints from `dests`, premoves, a
  promotion chooser, arrows (knight arrows are L-shaped), marks, highlights,
  last-move and check highlights, coordinates and themes.
- **Guided mode** with `expectedMove` / `onWrongMove`. A wrong move snaps back
  and the piece shakes.
- **Hooks for haptics** (`onPieceLift`, `onPieceDrop`), so you can wire up
  `expo-haptics` without the board depending on it.
- Honors the OS **Reduce Motion** setting.
- Works with Reanimated **3 and 4** and Gesture Handler **2 and 3**.

## Install

```sh
npm install chessiro-canvas-native
```

Expo:

```sh
npx expo install react-native-reanimated react-native-gesture-handler react-native-svg
```

Bare React Native: install the same three packages with your package manager,
then run `pod install`.

Two one-time setup steps:

1. **Gesture Handler root.** Wrap your app once in `GestureHandlerRootView`.
   Expo Router already does this in its root layout.

   ```tsx
   import { GestureHandlerRootView } from 'react-native-gesture-handler';

   export default function Root() {
     return <GestureHandlerRootView style={{ flex: 1 }}>{/* app */}</GestureHandlerRootView>;
   }
   ```

2. **Reanimated Babel plugin.** `babel-preset-expo` adds it for you. In a bare
   app, add it last in `babel.config.js`:
   - Reanimated 4: `plugins: ['react-native-worklets/plugin']`
   - Reanimated 3: `plugins: ['react-native-reanimated/plugin']`

   The board ships `'worklet'` functions, and the plugin compiles them from
   `node_modules` like any other code.

## Quick start (chess.js)

```tsx
import { useCallback, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { ChessiroBoard } from 'chessiro-canvas-native';
import type { Dests, PromotionPiece, Square } from 'chessiro-canvas-native';

export function Game() {
  const chess = useMemo(() => new Chess(), []);
  const [fen, setFen] = useState(chess.fen());
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  const dests = useMemo(() => {
    const d: Dests = new Map();
    for (const m of chess.moves({ verbose: true })) {
      d.set(m.from as Square, [...(d.get(m.from as Square) ?? []), m.to as Square]);
    }
    return d;
  }, [chess, fen]);

  const onMove = useCallback((from: string, to: string, promotion?: PromotionPiece) => {
    try {
      chess.move({ from, to, promotion });
    } catch {
      return false; // rejected: the piece snaps back
    }
    setFen(chess.fen());
    setLastMove({ from, to });
    return true;
  }, [chess]);

  return (
    <ChessiroBoard
      position={fen}
      turnColor={chess.turn()}
      dests={dests}
      onMove={onMove}
      lastMove={lastMove}
      moveAnimation="playful"
    />
  );
}
```

If you omit `size`, the board fills its container's width. For a complete
screen with undo, flip and preset buttons, see [`example/App.tsx`](example/App.tsx).

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `position` | `string` | initial position | FEN (only the placement field is read) or `'start'`. |
| `orientation` | `'white' \| 'black'` | `'white'` | Changes animate according to `moveAnimation.flip`. |
| `size` | `number` | container width | Board side length in px. |
| `interactive` | `boolean` | `true` | Allows selecting and moving pieces. |
| `turnColor` | `'w' \| 'b'` | — | Side to move. Premoves need it. |
| `movableColor` | `'w' \| 'b' \| 'both'` | `turnColor` | Which side(s) the user can move. If neither this nor `turnColor` is set, both sides can move. |
| `dests` | `Map<Square, Square[]>` | — | Legal destinations, drawn as hints. If omitted, every move is offered to `onMove`. |
| `onMove` | `(from, to, promotion?) => boolean` | — | Return `true` and update `position`. Return `false` to snap the piece back. |
| `lastMove` | `{ from, to } \| null` | — | Highlighted with `theme.lastMoveHighlight`. |
| `check` | `string \| null` | — | Square of the king in check, drawn with a red glow. |
| `autoPromoteTo` | `'q' \| 'r' \| 'b' \| 'n'` | — | Skips the promotion chooser. |
| `premovable` | `{ enabled, showDests?, current?, events?: { set?, unset? } }` | — | Same behavior as the web board. A queued premove plays when it becomes your turn. |
| `expectedMove` | `ExpectedMove \| ExpectedMove[] \| null` | — | Guided mode: only these moves reach `onMove`. |
| `onWrongMove` | `(from, to) => void` | — | Called for a rejected move in guided mode. |
| `wrongMoveFeedback` | `'shake' \| 'none'` | `'shake'` | |
| `arrows` | `Arrow[]` | — | `{ startSquare, endSquare, color, brush? }`. Knight arrows are L-shaped. |
| `arrowBrushes` | `Partial<ArrowBrushes>` | — | Overrides the `green` / `red` / `blue` / `yellow` brush colors. |
| `highlightedSquares` | `Record<string, string>` | — | Maps a square to a fill color. Drawn under the pieces. |
| `markedSquares` | `string[]` | — | Translucent red marks. |
| `theme` | `Partial<BoardTheme>` | Chessiro brown | `darkSquare`, `lightSquare`, `lastMoveHighlight`, `selectedPiece`. |
| `showCoordinates` | `boolean` | `true` | Labels drawn inside the edge squares. |
| `squareVisuals` | `NativeSquareVisuals` | — | `legalDot`, `legalMoveStyle` (`'ring'` \| `'dot'`), `legalCaptureRing`, `legalCaptureRingShape`, `premoveDot`, `premoveCaptureRing`, `premoveCurrent`, `markOverlay`, `selected`, `dragOverHighlight`, `dragOriginOpacity`. |
| `flipPieces` | `boolean` | `false` | Turns the piece artwork 180° for pass-and-play. |
| `renderPiece` | `(code, size) => ReactNode` | built-in SVG set | Custom artwork, such as PNG `<Image>`s. Keep the function stable (`useCallback` or module scope). |
| `moveAnimation` | `MoveAnimationOptions \| MoveAnimationPreset` | `'classic'` | See [Animation](#animation). |
| `animationDurationMs` | `number` | `200` | Base move duration. Presets scale it. |
| `showAnimations` | `boolean` | `true` | Master switch for piece motion. |
| `dragScale` | `number` | `1.6` | Scale of a lifted piece. |
| `dragLiftSquares` | `number` | `0.5` | How far above the finger a dragged piece floats, in squares. |
| `onSquarePress` | `(square) => void` | — | Called on every tap, including when the board isn't interactive. |
| `onPieceLift` | `(square) => void` | — | Called when a drag starts. |
| `onPieceDrop` | `(from, to \| null, accepted) => void` | — | Called when a dragged piece is released. `to` is `null` off the board. |
| `style`, `testID`, `accessibilityLabel` | | | Applied to the board's outer view. |

`ChessiroCanvas` is an alias of `ChessiroBoard`, so code ported from the web
keeps its component name.

## Ref API

```tsx
const board = useRef<ChessiroBoardRef>(null);
<ChessiroBoard ref={board} … />;

await board.current?.pulseSquare('e4', { color: 'rgba(255,215,0,.55)', times: 2, durationMs: 600 });
await board.current?.shakePiece('g1'); // "wrong move" wiggle
await board.current?.animateMove('g1', 'f3', { durationMs: 700 }); // demo glide; doesn't call onMove
board.current?.getSquareAtPoint(x, y); // board-local px → 'e4' | null
board.current?.clearSelection();
```

`animateMove` leaves the piece on the target square without committing the
move. Update `position` to commit it. If the position changes some other way,
the piece glides back home.

## Animation

`moveAnimation` takes a preset name or an options object. It uses the same
model as the web board (`chessiro-canvas/core`):

| Preset | Feel | Capture | Landing | Appear | Flip |
| --- | --- | --- | --- | --- | --- |
| `classic` *(default)* | eased slide | fade | — | — | — |
| `snappy` | fast ease-out | fade | — | fade | rotate |
| `smooth` | long sine glide, slight lift | shrink | settle | fade | rotate |
| `playful` | anticipate + overshoot, arcs, knight hops | knockout | squash | pop | rotate |
| `arcade` | spring, big arcs | poof | bounce | drop | rotate |
| `elegant` | slow ease, distance-scaled | sink | settle | rise | fade |
| `minimal` | short flat slide | fade | — | — | — |
| `none` | no motion | | | | |

To start from a preset and override individual settings:

```tsx
<ChessiroBoard
  moveAnimation={{
    preset: 'smooth',
    easing: (t) => 1 - Math.pow(1 - t, 4), // any JS function; it's sampled into keyframes
    arc: 0.15,
    knightArc: 0.5,
    capture: 'poof',
    landing: 'squash',
    appear: 'pop',
    flip: 'rotate', // 'none' | 'rotate' | 'fade'
    stagger: 20,    // cascade delay when many pieces move at once (new game, position jumps)
    snapBack: true, // animate rejected drops home
  }}
/>
```

How the board animates specific situations:

- **Interrupted moves.** If the position changes mid-flight, the moving piece
  continues from where it is on screen.
- **Drag and drop.** When you drag a piece, the board doesn't replay the move
  from its origin square. It plays only the preset's landing flourish, and a
  captured piece on the target square leaves right away. Other pieces that
  move as part of the same move, such as the rook when castling, still
  animate.
- **Flipping the board.** The `'rotate'` flip turns the whole piece layer half
  a turn while each piece counter-rotates to stay upright. Square colors look
  the same after a 180° turn, so it reads as the board turning.
- **Reduce Motion.** When the OS setting is on, every preset becomes
  `minimal`. Pass `respectReducedMotion: false` to opt out.

## Haptics (expo-haptics)

```tsx
import * as Haptics from 'expo-haptics';

<ChessiroBoard
  onPieceLift={() => Haptics.selectionAsync()}
  onPieceDrop={(_from, _to, accepted) =>
    Haptics.impactAsync(accepted ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Rigid)
  }
  onWrongMove={() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)}
/>
```

## Custom pieces

```tsx
const PNG = { wk: require('./pieces/wK.png'), /* … */ };
const renderPiece = (code: PieceCode, size: number) => (
  <Image source={PNG[code]} style={{ width: size, height: size }} />
);

<ChessiroBoard renderPiece={renderPiece} />;
```

The board calls `renderPiece` when a piece mounts or the board resizes, never
per frame.

## Performance notes

- **No per-frame React renders.** Each piece is an `Animated.View` with a
  stable key. Its pose comes from a `progress` value that runs from 0 to 1
  with `withTiming(…, Easing.linear)` and is mapped through the track's
  keyframes inside `useAnimatedStyle`.
- **The drag runs entirely on the UI thread.** A single `Gesture.Pan()` reads
  a UI-thread snapshot of the board (which piece is on each square and whether
  it can move). It lifts the piece and moves a ghost that already has every
  piece's artwork mounted, then hands the drop to JS through `runOnJS`.
  Selecting a piece or showing hints re-renders the hint layer only; the
  pieces don't re-render.
- **Squares are cheap to draw.** The 64 squares are two SVG nodes (a backdrop
  and one path for the dark squares). Hints, highlights and arrows are single
  SVG layers that re-render only when their inputs change.
- **SVG is parsed once.** The default artwork is `SvgXml`, memoized by piece
  and size, so the XML is parsed when a piece mounts, not when it moves.
- **Keep inputs stable.** Pass stable `dests`, `renderPiece` and
  `squareVisuals` (`useMemo` / `useCallback`). The board already compares
  `theme` and `arrows` by value.
- **Scroll views.** The board's pan gesture activates on touch, so a drag
  that starts on the board won't scroll a parent `ScrollView`.

## Shared core

The native package bundles the framework-free core of `chessiro-canvas` (FEN
parsing, move diffing, the motion model). It has no runtime dependency on the
web package or `react-dom`. It also re-exports useful helpers: `readFen`,
`writeFen`, `INITIAL_FEN`, `computeAnimPlan`, `premoveDests`,
`squareToPoint`, `pointToSquare`, `resolveMoveAnimation`, `renderBoardSvg`,
`DEFAULT_PIECE_SVGS` and others.

## Development

```sh
npm install
npm run typecheck
npm run build          # dist/index.js (CJS), dist/esm/index.js (ESM, used by Metro), dist/index.d.ts
npm run example:web    # the board through react-native-web at http://localhost:5199
npm run verify:web     # Playwright checks against the web harness (SHOTS=<dir> for screenshots)
```

`example-web/` runs the built bundle through react-native-web, with the
Reanimated Babel plugin enabled like in an app. It's only a test harness; it
isn't a supported way to ship the board to the web. For the web, use
`chessiro-canvas`.
