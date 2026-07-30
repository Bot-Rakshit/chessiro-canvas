import type { BoardTheme } from 'chessiro-canvas';

export const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'start', label: 'Getting started' },
  { id: 'playground', label: 'Playground' },
  { id: 'arrows', label: 'Arrows & premoves' },
  { id: 'teaching', label: 'Teaching' },
  { id: 'drills', label: 'Drills' },
  { id: 'cinematics', label: 'Cinematics' },
  { id: 'styling', label: 'Styling' },
  { id: 'api', label: 'API reference' },
  { id: 'engines', label: 'Engines' },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

export const THEMES: BoardTheme[] = [
  {
    id: 'chessiro',
    name: 'Chessiro',
    darkSquare: '#785E45',
    lightSquare: '#DFC29A',
    margin: '#66503B',
    lastMoveHighlight: '#DFAA4E',
    selectedPiece: '#B57340',
  },
  {
    id: 'slate',
    name: 'Slate',
    darkSquare: '#566073',
    lightSquare: '#D2D8E1',
    margin: '#3D4554',
    lastMoveHighlight: '#6FA4D9',
    selectedPiece: '#2E6C9E',
  },
  {
    id: 'forest',
    name: 'Forest',
    darkSquare: '#6C7A3A',
    lightSquare: '#E8E7C8',
    margin: '#4F5929',
    lastMoveHighlight: '#94B23B',
    selectedPiece: '#4E6A2A',
  },
];

/* ── Facts, measured. Sourced from benchmarks/latest.json ──────────── */

export const FACTS = [
  { value: '32 KB', label: 'ESM, gzipped' },
  { value: '0', label: 'Runtime deps' },
  { value: '0.44 ms', label: 'Mean update' },
  { value: '67', label: 'Typed props' },
];

/* ── Code samples ─────────────────────────────────────────────────── */

export const BOARD_ONLY_CODE = `import { useState } from 'react';
import { ChessiroCanvas, INITIAL_FEN } from 'chessiro-canvas';

export function Board() {
  const [fen, setFen] = useState(INITIAL_FEN);

  return (
    <div style={{ width: 520 }}>
      <ChessiroCanvas
        position={fen}
        onMove={(from, to) => {
          // No rules engine yet: accept everything.
          return true;
        }}
      />
    </div>
  );
}`;

export const CHESSOPS_QUICKSTART_CODE = `import { useMemo, useState } from 'react';
import { Chess } from 'chessops/chess';
import { chessgroundDests } from 'chessops/compat';
import { parseFen, makeFen } from 'chessops/fen';
import { parseUci } from 'chessops/util';
import { ChessiroCanvas, INITIAL_GAME_FEN } from 'chessiro-canvas';

export function LegalBoard() {
  const [pos, setPos] = useState(() =>
    Chess.fromSetup(parseFen(INITIAL_GAME_FEN).unwrap()).unwrap()
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
        const move = parseUci(from + to + (promotion ?? ''));
        if (!move || !pos.isLegal(move)) return false;
        const next = pos.clone();
        next.play(move);
        setPos(next);
        return true;
      }}
    />
  );
}`;

export const CHESS_JS_CODE = `import { useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { ChessiroCanvas, type Dests, type Square } from 'chessiro-canvas';

export function ChessJsBoard() {
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(() => chess.fen());

  // Key derived state off \`fen\`, never off \`chess\` — chess.js mutates
  // the same instance in place, so its reference never changes.
  const dests = useMemo<Dests>(() => {
    const map = new Map<Square, Square[]>();
    for (const move of chess.moves({ verbose: true })) {
      const from = move.from as Square;
      const list = map.get(from);
      if (list) list.push(move.to as Square);
      else map.set(from, [move.to as Square]);
    }
    return map;
  }, [fen]);

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
}`;

export const CUSTOM_PIECES_CODE = `<ChessiroCanvas
  position={fen}
  // Hosted set: expects /pieces/alpha/wp.svg ... /bk.svg
  pieceSet={{ id: 'alpha', name: 'Alpha', path: '/pieces/alpha' }}
  // ...or render each piece yourself
  pieces={{
    wP: () => <MyPawn color="white" />,
    bP: () => <MyPawn color="black" />,
  }}
/>`;

export const SQUARE_VISUALS_CODE = `<ChessiroCanvas
  position={fen}
  dests={dests}
  squareVisuals={{
    legalMoveStyle: 'ring',          // 'dot' | 'ring'
    legalDot: 'rgba(30, 144, 255, 0.55)',
    legalCaptureRing: 'rgba(30, 144, 255, 0.8)',
    legalCaptureRingShape: 'square', // 'circle' | 'square'
    selectedStyle: 'both',           // 'fill' | 'border' | 'both'
    premoveDot: 'rgba(155, 89, 182, 0.55)',
    premoveCurrentStyle: 'dashed',   // 'fill' | 'dashed' | 'both'
    dragOverHighlight: 'rgba(255, 255, 255, 0.25)',
  }}
/>`;

export const UI_VISUALS_CODE = `<ChessiroCanvas
  position={fen}
  boardRadius={14}
  marginRadius={16}
  notationVisuals={{
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 11,
    opacity: 0.95,
  }}
  promotionVisuals={{
    panelColor: 'rgba(20, 24, 36, 0.98)',
    optionBackground: 'rgba(255, 255, 255, 0.08)',
  }}
  overlayVisuals={{
    background: 'rgba(2, 6, 23, 0.85)',
    borderRadius: '6px',
  }}
/>`;

export const TEACHING_CODE = `const boardRef = useRef<ChessiroCanvasRef>(null);

// Coach hand: slowly pick the piece up and place it on the square
await boardRef.current.animateMove('e2', 'e4', { durationMs: 1000 });
commitMove('e2', 'e4'); // update position once it resolves

// Preview an idea without touching the position (fading copy)
await boardRef.current.animateMove('g1', 'f3', { ghost: true });

// Direct the student's attention to a square
await boardRef.current.pulseSquare('f7', { color: 'rgba(239,68,68,0.9)', times: 2 });

// Wrong-move feedback
await boardRef.current.shakePiece('d1');

// Persistent placement hints
<ChessiroCanvas
  ref={boardRef}
  position={fen}
  ghostPieces={[{ square: 'f3', piece: 'wN' }, { square: 'c4', piece: 'wB' }]}
/>`;

export const CINEMATIC_CODE = `const boardRef = useRef<ChessiroCanvasRef>(null);

// Script a brilliant-move replay: zoom in, fly the queen with 3D spins,
// commit the position, zoom back out. Impact effects (shockwave, flash,
// victim blast, camera shake, onImpact) fire frame-accurately the instant
// the piece touches the square — the approach animation's finish IS the hit.
const playback = boardRef.current.playCinematic([
  { type: 'camera', action: 'zoomTo', square: 'f7', options: { scale: 1.5 } },
  {
    type: 'move', from: 'f3', to: 'f7',
    options: { style: 'brilliant', badge: '!!', onImpact: () => thud.play() },
  },
  { type: 'call', fn: () => commitMove('f3', 'f7') }, // your position update
  { type: 'banner', options: { text: 'BRILLIANT!!' } },
  { type: 'celebrate', options: { kind: 'both' } },
  { type: 'camera', action: 'zoomOut' },
]);
await playback.finished;   // or playback.cancel() to stop mid-sequence

// One-off primitives, outside a script:
await boardRef.current.cinematicMove('g1', 'f3', { style: 'slam' });
await boardRef.current.cinematicMove('c4', 'f7', { style: 'meteor' }); // trail + blast
await boardRef.current.squareBurst('e4', { kind: 'both' });
await boardRef.current.popBadge('f7', { text: '!!' });
await boardRef.current.popBanner({ text: 'CHECKMATE' });
await boardRef.current.celebrate();     // confetti + fireworks

// Special-move spectacles:
await boardRef.current.promotionBeam('e8', { fromPiece: 'wP', piece: 'wQ' });
await boardRef.current.implode('d5');   // en passant "black hole"
await boardRef.current.castleSwap('e1', 'g1', 'h1', 'f1'); // 3D teleport swap
await boardRef.current.drawLaser('c4', 'f7', { persist: true });
const spot = boardRef.current.spotlight(['c4', 'f7']); // dim all but these
spot.clear();

await boardRef.current.camera.tilt({ rotateX: 18 });
const drift = boardRef.current.camera.drift(); // Ken Burns wander
drift.stop();
boardRef.current.clearCinematics(); // cancel everything + reset camera

// Styles: brilliant | great | smooth | slam | meteor. Tune per move with
// trail, flash, victimBlast, impactShake and onImpact (sound/haptics hook).
// Respects prefers-reduced-motion (degrades to a plain glide);
// pass { force: true } to override. Use interactive={false} —
// camera transforms break pointer-to-square math until reset().`;

/* ── API reference ────────────────────────────────────────────────── */

export type PropRow = { prop: string; type: string; def: string; notes: string };

export const PROP_GROUPS: { title: string; rows: PropRow[] }[] = [
  {
    title: 'Core',
    rows: [
      { prop: 'position', type: 'string', def: 'INITIAL_FEN', notes: 'FEN to render. Full FEN or placement only.' },
      { prop: 'orientation', type: "'white' | 'black'", def: "'white'", notes: 'Which side sits at the bottom.' },
      { prop: 'interactive', type: 'boolean', def: 'true', notes: 'Disables all move interaction when false.' },
      { prop: 'turnColor', type: "'w' | 'b'", def: '—', notes: 'Whose turn it is. Required for premoves.' },
      { prop: 'movableColor', type: "'w' | 'b' | 'both'", def: 'turnColor', notes: 'Which side(s) the user may move.' },
    ],
  },
  {
    title: 'Moves',
    rows: [
      { prop: 'onMove', type: '(from, to, promotion?) => boolean', def: '—', notes: 'Return true to accept, false to snap back.' },
      { prop: 'dests', type: 'Map<Square, Square[]>', def: '—', notes: 'Legal destinations per origin square.' },
      { prop: 'lastMove', type: '{ from, to } | null', def: '—', notes: 'Highlights the last move.' },
      { prop: 'check', type: 'string | null', def: '—', notes: 'Square of the king in check.' },
      { prop: 'autoPromoteTo', type: "'q' | 'r' | 'b' | 'n'", def: '—', notes: 'Skip the promotion dialog.' },
      { prop: 'premovable', type: 'PremoveConfig', def: '—', notes: 'Enables premoves; pass current to control the queue.' },
    ],
  },
  {
    title: 'Guided mode',
    rows: [
      { prop: 'expectedMove', type: 'ExpectedMove | ExpectedMove[] | null', def: '—', notes: 'Accept only these moves; others are rejected.' },
      { prop: 'onWrongMove', type: '(from, to) => void', def: '—', notes: 'Fires when a non-expected move is attempted.' },
      { prop: 'wrongMoveFeedback', type: "'shake' | 'none'", def: "'shake'", notes: 'Feedback for a rejected guided move.' },
    ],
  },
  {
    title: 'Annotation',
    rows: [
      { prop: 'arrows', type: 'Arrow[]', def: 'internal', notes: 'Controlled arrow list.' },
      { prop: 'onArrowsChange', type: '(arrows) => void', def: '—', notes: 'User drew or cleared arrows.' },
      { prop: 'markedSquares', type: 'string[]', def: 'internal', notes: 'Controlled square marks.' },
      { prop: 'arrowBrushes', type: 'Partial<ArrowBrushes>', def: 'defaults', notes: 'Override brush colors.' },
      { prop: 'arrowVisuals', type: 'Partial<ArrowVisuals>', def: '—', notes: 'Geometry, dashes, head shape, outline.' },
      { prop: 'plyIndex', type: 'number', def: '—', notes: 'Swaps annotations per ply with plyArrows / plyMarks.' },
      { prop: 'ghostPieces', type: 'GhostPiece[]', def: '—', notes: 'Translucent hint pieces (teaching).' },
      { prop: 'squareLabels', type: 'Record<string, string | SquareLabel>', def: '—', notes: 'Text badges on squares.' },
      { prop: 'moveQualityBadge', type: 'MoveQualityBadge | null', def: '—', notes: 'Icon badge pinned to a square.' },
    ],
  },
  {
    title: 'Appearance',
    rows: [
      { prop: 'theme', type: 'BoardTheme', def: 'built-in', notes: 'Square, margin and highlight colors.' },
      { prop: 'pieceSet', type: 'PieceSet', def: 'embedded', notes: 'Hosted piece set path.' },
      { prop: 'pieces', type: 'Record<string, () => ReactNode>', def: '—', notes: 'Custom renderer per piece key.' },
      { prop: 'flipPieces', type: 'boolean', def: 'false', notes: 'Rotate artwork 180° for pass-and-play.' },
      { prop: 'showMargin', type: 'boolean', def: 'true', notes: 'Notation frame around the board.' },
      { prop: 'marginThickness', type: 'number', def: '24', notes: 'Margin thickness in px.' },
      { prop: 'boardRadius', type: 'number | string', def: '0', notes: 'Inner board corner radius.' },
      { prop: 'marginRadius', type: 'number | string', def: '4', notes: 'Outer margin corner radius.' },
      { prop: 'showNotation', type: 'boolean', def: 'true', notes: 'File and rank labels.' },
      { prop: 'squareVisuals', type: 'Partial<SquareVisuals>', def: '—', notes: 'Legal/premove hints, marks, selection, check.' },
      { prop: 'notationVisuals', type: 'Partial<NotationVisuals>', def: '—', notes: 'Font, size, weight, colors, offsets.' },
      { prop: 'promotionVisuals', type: 'Partial<PromotionVisuals>', def: '—', notes: 'Promotion dialog styling.' },
      { prop: 'highlightedSquares', type: 'Record<string, string>', def: '{}', notes: 'Arbitrary square background colors.' },
    ],
  },
  {
    title: 'Behaviour',
    rows: [
      { prop: 'allowDragging', type: 'boolean', def: 'true', notes: 'Drag-to-move (click-to-move still works).' },
      { prop: 'allowDrawingArrows', type: 'boolean', def: 'true', notes: 'Right-click arrows and marks.' },
      { prop: 'showAnimations', type: 'boolean', def: 'true', notes: 'Piece movement animation.' },
      { prop: 'animationDurationMs', type: 'number', def: '200', notes: 'Animation length.' },
      { prop: 'blockTouchScroll', type: 'boolean', def: 'false', notes: 'Stop page scroll while touching the board.' },
      { prop: 'touchDragScale', type: 'number', def: '1.9', notes: 'Piece scale while touch-dragging.' },
      { prop: 'touchDragLiftSquares', type: 'number', def: '0.6', notes: 'Lift above the finger, in squares.' },
      { prop: 'dragScale', type: 'number', def: '1', notes: 'Piece scale while mouse-dragging.' },
    ],
  },
];

export const REF_GROUPS: { title: string; rows: { name: string; sig: string; notes: string }[] }[] = [
  {
    title: 'Geometry',
    rows: [
      { name: 'getSquareRect', sig: '(square) => DOMRect | null', notes: 'Viewport rect of a square.' },
      { name: 'getBoardRect', sig: '() => DOMRect | null', notes: 'Viewport rect of the board.' },
      { name: 'getSquareAtPoint', sig: '(clientX, clientY) => Square | null', notes: 'Square under a point — build external piece trays.' },
    ],
  },
  {
    title: 'Teaching',
    rows: [
      { name: 'animateMove', sig: '(from, to, options?) => Promise', notes: 'Slow demonstration move. Never calls onMove.' },
      { name: 'pulseSquare', sig: '(square, options?) => Promise', notes: 'Pulsing attention ring.' },
      { name: 'shakePiece', sig: '(square) => Promise', notes: 'Shake a piece (wrong move).' },
      { name: 'clearTeachingEffects', sig: '() => void', notes: 'Cancel all demos and pulses.' },
    ],
  },
  {
    title: 'Cinematics',
    rows: [
      { name: 'cinematicMove', sig: '(from, to, options?) => Promise', notes: 'Choreographed flight: spins, arc, glow, landing.' },
      { name: 'playCinematic', sig: '(steps, options?) => CinematicPlayback', notes: 'Run a scripted sequence.' },
      { name: 'squareBurst', sig: '(square, options?) => Promise', notes: 'Sparkles and/or shockwave ring.' },
      { name: 'popBadge', sig: '(square, options) => Promise', notes: 'Annotation badge (!!, ?).' },
      { name: 'popBanner', sig: '(options) => Promise', notes: 'Large glowing text banner.' },
      { name: 'celebrate', sig: '(options?) => Promise', notes: 'Confetti and/or fireworks.' },
      { name: 'promotionBeam', sig: '(square, options?) => Promise', notes: 'Pillar of light morphing one piece into another.' },
      { name: 'implode', sig: '(square, options?) => Promise', notes: 'Collapse a piece into a vortex.' },
      { name: 'castleSwap', sig: '(kFrom, kTo, rFrom, rTo, options?) => Promise', notes: '3D teleport-swap of king and rook.' },
      { name: 'spotlight', sig: '(squares, options?) => SpotlightHandle', notes: 'Dim the board except these squares.' },
      { name: 'drawLaser', sig: '(from, to, options?) => Promise', notes: 'Animated glowing threat beam.' },
      { name: 'drawArrow', sig: '(from, to, options?) => Promise', notes: 'Arrow draws itself, then the head pops in.' },
      { name: 'camera', sig: 'CameraController', notes: 'zoomTo, zoomOut, tilt, shake, drift, reset.' },
      { name: 'clearCinematics', sig: '() => void', notes: 'Cancel everything and reset the camera.' },
    ],
  },
];
