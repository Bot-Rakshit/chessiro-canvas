import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ChessiroCanvas,
  DEFAULT_ARROW_BRUSHES,
  resolvePieceImageSrc,
  type Arrow,
  type ArrowBrushes,
  type ArrowHeadShape,
  type ArrowVisuals,
  type BoardTheme,
  type ChessiroCanvasRef,
  type CinematicStep,
  type GhostPiece,
  type PieceColor,
  type SquareLabel,
  type SquareVisuals,
  type Square,
} from 'chessiro-canvas';
import { chessgroundDests } from 'chessops/compat';
import { makeFen } from 'chessops/fen';
import { parseUci } from 'chessops/util';

import { createInitialPosition, posFromFen } from './chess';
import { CINEMATIC_CODE, TEACHING_CODE } from './content';
import {
  C,
  Choice,
  CodeBlock,
  ColorField,
  Panel,
  Plate,
  Slider,
  Status,
  Toggle,
  Workbench,
  cn,
  round,
  sleep,
  toHex,
} from './ui';

/* ═══ Arrows & premoves ═══════════════════════════════════════════════ */

const STUDIO_FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 3';

const DEFAULT_PRESET_ARROWS: Arrow[] = [
  { startSquare: 'f3', endSquare: 'e5', color: DEFAULT_ARROW_BRUSHES.green, brush: 'green' },
  { startSquare: 'c4', endSquare: 'f7', color: DEFAULT_ARROW_BRUSHES.red, brush: 'red' },
  { startSquare: 'd1', endSquare: 'h5', color: DEFAULT_ARROW_BRUSHES.blue, brush: 'blue' },
];

type PremoveMode = 'off' | 'waiting';

export function ArrowPremoveStudio({ theme }: { theme: BoardTheme }) {
  const [pos, setPos] = useState(() => posFromFen(STUDIO_FEN));
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [userArrows, setUserArrows] = useState<Arrow[]>(DEFAULT_PRESET_ARROWS);

  const [lineWidth, setLineWidth] = useState(0.086);
  const [opacity, setOpacity] = useState(0.85);
  const [headLength, setHeadLength] = useState(3.2);
  const [headWidth, setHeadWidth] = useState(3.5);
  const [margin, setMargin] = useState(0.18);
  const [startOffset, setStartOffset] = useState(0);
  const [lineCap, setLineCap] = useState<'round' | 'butt' | 'square'>('round');
  const [lineJoin, setLineJoin] = useState<'round' | 'miter' | 'bevel'>('miter');
  const [headShape, setHeadShape] = useState<ArrowHeadShape>('classic');
  const [headCornerRadius, setHeadCornerRadius] = useState(0);
  const [dashed, setDashed] = useState(false);
  const [dashArray, setDashArray] = useState('0.22 0.16');
  const [dashOffset, setDashOffset] = useState(0);
  const [outlineWidth, setOutlineWidth] = useState(0);
  const [outlineColor, setOutlineColor] = useState('rgba(0,0,0,0.45)');
  const [fadeInMs, setFadeInMs] = useState(400);
  const [fadeOutMs, setFadeOutMs] = useState(350);
  const [staggerMs, setStaggerMs] = useState(550);
  const [fadeBusy, setFadeBusy] = useState(false);
  const fadeSeqRef = useRef(0);
  const [brushes, setBrushes] = useState<ArrowBrushes>({ ...DEFAULT_ARROW_BRUSHES });

  const [touchDragScale, setTouchDragScale] = useState(1.9);
  const [touchDragLiftSquares, setTouchDragLiftSquares] = useState(0.6);
  const [dragScale, setDragScale] = useState(1);
  const [dragLiftSquares, setDragLiftSquares] = useState(0);

  const [premoveMode, setPremoveMode] = useState<PremoveMode>('off');
  const [premoveColor, setPremoveColor] = useState('rgba(155, 89, 182, 0.55)');
  const [premoveRingColor, setPremoveRingColor] = useState('rgba(155, 89, 182, 0.75)');
  const [premoveCurrentColor, setPremoveCurrentColor] = useState('rgba(155, 89, 182, 0.35)');
  const [showPremoveDests, setShowPremoveDests] = useState(true);
  const [currentPremove, setCurrentPremove] = useState<[string, string] | null>(null);
  const [premoveCurrentStyle, setPremoveCurrentStyle] = useState<'fill' | 'dashed' | 'both'>('fill');
  const [premoveBorderWidth, setPremoveBorderWidth] = useState(3);
  const [premoveBorderColor, setPremoveBorderColor] = useState('rgba(155, 89, 182, 0.9)');
  const [captureRingShape, setCaptureRingShape] = useState<'circle' | 'square'>('square');
  const [captureRingWidth, setCaptureRingWidth] = useState(3);
  const [captureRingCornerRadius, setCaptureRingCornerRadius] = useState(14);

  const fen = useMemo(() => makeFen(pos.toSetup()), [pos]);
  const dests = useMemo(() => chessgroundDests(pos), [pos]);
  const realTurn: PieceColor = pos.turn === 'white' ? 'w' : 'b';
  // Premove mode pretends it's the opponent's turn so the user can queue a move.
  const turnColor: PieceColor = premoveMode === 'waiting' ? (realTurn === 'w' ? 'b' : 'w') : realTurn;
  const movableColor: PieceColor = realTurn;

  const arrowVisuals = useMemo<Partial<ArrowVisuals>>(
    () => ({
      lineWidth, opacity, margin, startOffset, headLength, headWidth,
      headShape, headCornerRadius, lineCap, lineJoin,
      dashArray: dashed ? dashArray : undefined,
      dashOffset: dashed ? dashOffset : undefined,
      outlineWidth, outlineColor,
      fadeInMs,
      fadeOutMs,
    }),
    [lineWidth, opacity, margin, startOffset, headLength, headWidth, headShape, headCornerRadius, lineCap, lineJoin, dashed, dashArray, dashOffset, outlineWidth, outlineColor, fadeInMs, fadeOutMs],
  );

  const squareVisuals = useMemo<Partial<SquareVisuals>>(
    () => ({
      premoveDot: premoveColor,
      premoveCaptureRing: premoveRingColor,
      premoveCurrent: premoveCurrentColor,
      premoveCurrentStyle,
      premoveCurrentBorderWidth: premoveBorderWidth,
      premoveCurrentBorderColor: premoveBorderColor,
      legalCaptureRingShape: captureRingShape,
      legalCaptureRingWidth: captureRingWidth,
      legalCaptureRingCornerRadius: captureRingCornerRadius,
    }),
    [premoveColor, premoveRingColor, premoveCurrentColor, premoveCurrentStyle, premoveBorderWidth, premoveBorderColor, captureRingShape, captureRingWidth, captureRingCornerRadius],
  );

  const handleMove = useCallback(
    (from: string, to: string, promotion?: string) => {
      const move = parseUci(`${from}${to}${promotion ?? ''}`);
      if (!move || !pos.isLegal(move)) return false;
      const next = pos.clone();
      next.play(move);
      setPos(next);
      setLastMove({ from, to });
      return true;
    },
    [pos],
  );

  const resetStudio = useCallback(() => {
    setPos(posFromFen(STUDIO_FEN));
    setLastMove(null);
    setUserArrows(DEFAULT_PRESET_ARROWS);
    setCurrentPremove(null);
  }, []);

  const resetArrowDefaults = useCallback(() => {
    setLineWidth(0.086); setOpacity(0.85); setHeadLength(3.2); setHeadWidth(3.5);
    setMargin(0.18); setStartOffset(0); setLineCap('round'); setLineJoin('miter');
    setHeadShape('classic'); setHeadCornerRadius(0); setDashed(false);
    setDashArray('0.22 0.16'); setDashOffset(0); setOutlineWidth(0);
    setOutlineColor('rgba(0,0,0,0.45)'); setFadeInMs(400); setFadeOutMs(350);
    setStaggerMs(550); setBrushes({ ...DEFAULT_ARROW_BRUSHES });
  }, []);

  const coloredPresets = useCallback(
    () =>
      DEFAULT_PRESET_ARROWS.map((a) => ({
        ...a,
        id: `${a.startSquare}-${a.endSquare}`,
        color: a.brush ? brushes[a.brush] : a.color,
      })),
    [brushes],
  );

  const addPresetArrows = useCallback(() => {
    setUserArrows(coloredPresets());
  }, [coloredPresets]);

  const playFadeSequence = useCallback(async () => {
    const seq = ++fadeSeqRef.current;
    setFadeBusy(true);
    try {
      setUserArrows([]);
      await sleep(Math.max(fadeOutMs, 50) + 40);
      if (fadeSeqRef.current !== seq) return;

      const presets = coloredPresets();
      for (let i = 0; i < presets.length; i++) {
        if (fadeSeqRef.current !== seq) return;
        setUserArrows(presets.slice(0, i + 1));
        if (i < presets.length - 1) {
          await sleep(staggerMs);
        }
      }

      await sleep(Math.max(fadeInMs, 200) + 600);
      if (fadeSeqRef.current !== seq) return;
      setUserArrows([]);
      await sleep(Math.max(fadeOutMs, 50) + 40);
    } finally {
      if (fadeSeqRef.current === seq) setFadeBusy(false);
    }
  }, [coloredPresets, fadeInMs, fadeOutMs, staggerMs]);

  const snippet = useMemo(() => {
    const arrowObj: Record<string, unknown> = {
      lineWidth: round(lineWidth, 3),
      opacity: round(opacity, 2),
      margin: round(margin, 2),
      startOffset: round(startOffset, 2),
      headLength: round(headLength, 2),
      headWidth: round(headWidth, 2),
      headShape, lineCap, lineJoin,
      fadeInMs,
      fadeOutMs,
    };
    if (headCornerRadius > 0) arrowObj.headCornerRadius = round(headCornerRadius, 2);
    if (dashed) {
      arrowObj.dashArray = dashArray;
      if (dashOffset) arrowObj.dashOffset = round(dashOffset, 2);
    }
    if (outlineWidth > 0) {
      arrowObj.outlineWidth = round(outlineWidth, 3);
      arrowObj.outlineColor = outlineColor;
    }
    return `<ChessiroCanvas
  position={fen}
  arrows={arrows}
  arrowVisuals={${JSON.stringify(arrowObj, null, 2).replace(/\n/g, '\n  ')}}
  arrowBrushes={${JSON.stringify(brushes, null, 2).replace(/\n/g, '\n  ')}}
  dragScale={${dragScale}}
  touchDragScale={${touchDragScale}}
  dragLiftSquares={${dragLiftSquares}}
  touchDragLiftSquares={${touchDragLiftSquares}}
/>`;
  }, [lineWidth, opacity, margin, startOffset, headLength, headWidth, headShape, headCornerRadius, lineCap, lineJoin, dashed, dashArray, dashOffset, outlineWidth, outlineColor, fadeInMs, fadeOutMs, brushes, dragScale, touchDragScale, dragLiftSquares, touchDragLiftSquares]);

  return (
    <Workbench
      board={
        <>
          <Plate caption="Right-drag on the board to draw. Shift, Alt or Ctrl with right-drag picks a different brush.">
            <ChessiroCanvas
              position={fen}
              lastMove={lastMove}
              turnColor={turnColor}
              movableColor={movableColor}
              dests={dests}
              onMove={handleMove}
              interactive
              theme={theme}
              showNotation
              showMargin
              arrows={userArrows}
              onArrowsChange={setUserArrows}
              arrowVisuals={arrowVisuals}
              arrowBrushes={brushes}
              squareVisuals={squareVisuals}
              dragScale={dragScale}
              touchDragScale={touchDragScale}
              dragLiftSquares={dragLiftSquares}
              touchDragLiftSquares={touchDragLiftSquares}
              premovable={{
                enabled: true,
                showDests: showPremoveDests,
                current: currentPremove ?? undefined,
                events: {
                  set: (from, to) => setCurrentPremove([from, to]),
                  unset: () => setCurrentPremove(null),
                },
              }}
            />
          </Plate>
          <div className="flex flex-wrap gap-2">
            <button onClick={resetStudio} className="btn">Reset board</button>
            <button onClick={addPresetArrows} className="btn" disabled={fadeBusy}>Re-add presets</button>
            <button onClick={() => setUserArrows([])} className="btn" disabled={fadeBusy}>Clear arrows</button>
            <button onClick={() => void playFadeSequence()} className="btn" disabled={fadeBusy}>
              {fadeBusy ? 'Playing fade…' : 'Play fade sequence'}
            </button>
            <button onClick={resetArrowDefaults} className="btn">Reset style</button>
          </div>
        </>
      }
      controls={
        <>
          <Panel title="Try it">
            <button
              type="button"
              onClick={() => void playFadeSequence()}
              disabled={fadeBusy}
              className="btn btn-primary btn-block"
            >
              {fadeBusy ? 'Playing fade…' : 'Play fade sequence'}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addPresetArrows}
                disabled={fadeBusy}
                className="btn flex-1"
              >
                Fade in presets
              </button>
              <button
                type="button"
                onClick={() => setUserArrows([])}
                disabled={fadeBusy}
                className="btn flex-1"
              >
                Fade out all
              </button>
            </div>
            <p className="note">
              Watch the board: arrows fade in when added and fade out when cleared.
            </p>
          </Panel>

          <Panel title="Fade in / out">
            <Slider
              label="Fade in"
              value={fadeInMs}
              min={0}
              max={1500}
              step={50}
              onChange={setFadeInMs}
              format={(v) => (v === 0 ? 'instant' : `${v}ms`)}
            />
            <Slider
              label="Fade out"
              value={fadeOutMs}
              min={0}
              max={1500}
              step={50}
              onChange={setFadeOutMs}
              format={(v) => (v === 0 ? 'instant' : `${v}ms`)}
            />
            <Slider
              label="Sequence stagger"
              value={staggerMs}
              min={100}
              max={1500}
              step={50}
              onChange={setStaggerMs}
              format={(v) => `${v}ms`}
            />
            <p className="note">
              Library-level fades: set <C>arrowVisuals.fadeInMs</C> / <C>fadeOutMs</C> (or per-arrow
              overrides). Adding an arrow fades it in; removing it from the array fades it out.
            </p>
          </Panel>

          <Panel title="Geometry">
            <Slider label="Line width" value={lineWidth} min={0.02} max={0.25} step={0.005} onChange={setLineWidth} format={(v) => v.toFixed(3)} />
            <Slider label="Opacity" value={opacity} min={0.1} max={1} step={0.05} onChange={setOpacity} format={(v) => v.toFixed(2)} />
            <Slider label="Head length" value={headLength} min={1.5} max={6} step={0.1} onChange={setHeadLength} format={(v) => v.toFixed(1)} />
            <Slider label="Head width" value={headWidth} min={1.5} max={6} step={0.1} onChange={setHeadWidth} format={(v) => v.toFixed(1)} />
            <Slider label="Tip margin" value={margin} min={0} max={0.5} step={0.01} onChange={setMargin} format={(v) => v.toFixed(2)} />
            <Slider label="Start offset" value={startOffset} min={0} max={0.5} step={0.01} onChange={setStartOffset} format={(v) => v.toFixed(2)} />
          </Panel>

          <Panel title="Head & line">
            <Slider
              label="Head roundness"
              value={headCornerRadius}
              min={0} max={1} step={0.02}
              onChange={setHeadCornerRadius}
              format={(v) => (v === 0 ? 'triangle' : v === 1 ? 'circle' : v.toFixed(2))}
            />
            <p className="note">
              Morphs the head from a sharp triangle to a rounded bullet. The base edge where the shaft
              meets stays straight.
            </p>
            <Choice label="Head" options={['classic', 'open', 'concave', 'diamond'] as const} value={headShape} onChange={setHeadShape} />
            <Choice label="Cap" options={['round', 'butt', 'square'] as const} value={lineCap} onChange={setLineCap} />
            <Choice label="Join" options={['round', 'miter', 'bevel'] as const} value={lineJoin} onChange={setLineJoin} />
          </Panel>

          <Panel title="Dashing">
            <Toggle label="Dashed shaft" checked={dashed} onChange={setDashed} />
            <label className="block">
              <span className="field">
                <span>Pattern</span>
                <span className="val">{dashArray}</span>
              </span>
              <input
                type="text"
                className="text-input"
                value={dashArray}
                onChange={(e) => setDashArray(e.target.value)}
                disabled={!dashed}
                placeholder="0.22 0.16"
              />
            </label>
            <Slider label="Dash offset" value={dashOffset} min={0} max={1} step={0.02} onChange={setDashOffset} format={(v) => v.toFixed(2)} />
          </Panel>

          <Panel title="Outline">
            <Slider label="Width" value={outlineWidth} min={0} max={0.06} step={0.002} onChange={setOutlineWidth} format={(v) => v.toFixed(3)} />
            <ColorField label="Color" value={outlineColor} onChange={setOutlineColor} />
            <p className="note">Wraps shaft and head for legibility on busy boards. Zero disables it.</p>
          </Panel>

          <Panel title="Brushes">
            {(['green', 'red', 'blue', 'yellow'] as const).map((brush) => (
              <ColorField
                key={brush}
                label={brush[0].toUpperCase() + brush.slice(1)}
                value={brushes[brush]}
                showHex
                onChange={(v) => setBrushes((prev) => ({ ...prev, [brush]: v }))}
              />
            ))}
          </Panel>

          <Panel title="Drag lift">
            <Slider label="Touch scale" value={touchDragScale} min={1} max={2.5} step={0.05} onChange={setTouchDragScale} format={(v) => `${v.toFixed(2)}×`} />
            <Slider label="Touch lift" value={touchDragLiftSquares} min={0} max={1.5} step={0.05} onChange={setTouchDragLiftSquares} format={(v) => v.toFixed(2)} />
            <Slider label="Mouse scale" value={dragScale} min={1} max={2} step={0.05} onChange={setDragScale} format={(v) => `${v.toFixed(2)}×`} />
            <Slider label="Mouse lift" value={dragLiftSquares} min={0} max={1} step={0.05} onChange={setDragLiftSquares} format={(v) => v.toFixed(2)} />
            <p className="note">
              Touch values apply only to touch drags. Raise <C>dragScale</C> above 1 to preview on desktop.
            </p>
          </Panel>

          <Panel title="Premove">
            <div className="flex -space-x-px">
              <button
                onClick={() => setPremoveMode('off')}
                className={cn('seg flex-1', premoveMode === 'off' && 'seg-on')}
              >
                Your turn
              </button>
              <button
                onClick={() => setPremoveMode('waiting')}
                className={cn('seg flex-1', premoveMode === 'waiting' && 'seg-on')}
              >
                Opponent thinking
              </button>
            </div>
            <p className="note">
              Switch to “Opponent thinking” to queue a premove, then back to “Your turn” to see it fire.
            </p>
            <Toggle label="Show destinations" checked={showPremoveDests} onChange={setShowPremoveDests} />
            <ColorField label="Dest dot" value={premoveColor} onChange={setPremoveColor} />
            <ColorField label="Capture ring" value={premoveRingColor} onChange={setPremoveRingColor} />
            <ColorField label="Queued square" value={premoveCurrentColor} onChange={setPremoveCurrentColor} />
            <Choice label="Queued style" options={['fill', 'dashed', 'both'] as const} value={premoveCurrentStyle} onChange={setPremoveCurrentStyle} />
            {(premoveCurrentStyle === 'dashed' || premoveCurrentStyle === 'both') && (
              <>
                <Slider label="Border width" value={premoveBorderWidth} min={1} max={8} step={0.5} onChange={setPremoveBorderWidth} format={(v) => `${v}px`} />
                <ColorField label="Border color" value={premoveBorderColor} onChange={setPremoveBorderColor} />
              </>
            )}
            <p className="field">
              <span>Queued</span>
              <span className="val">{currentPremove ? `${currentPremove[0]} → ${currentPremove[1]}` : 'none'}</span>
            </p>
          </Panel>

          <Panel title="Capture ring">
            <Choice label="Shape" options={['square', 'circle'] as const} value={captureRingShape} onChange={setCaptureRingShape} />
            <Slider label="Ring width" value={captureRingWidth} min={1} max={10} step={0.5} onChange={setCaptureRingWidth} format={(v) => `${v}px`} />
            {captureRingShape === 'square' && (
              <Slider label="Corner radius" value={captureRingCornerRadius} min={0} max={50} step={1} onChange={setCaptureRingCornerRadius} format={(v) => `${v}%`} />
            )}
            <p className="note">The thin ring on squares you can capture on. Premove captures use it too.</p>
          </Panel>
        </>
      }
      code={
        <>
          <p className="eyebrow mb-2.5">Your current configuration</p>
          <CodeBlock code={snippet} language="tsx" />
        </>
      }
    />
  );
}

/* ═══ Teaching ════════════════════════════════════════════════════════ */

const LESSON_GHOSTS: GhostPiece[] = [
  { square: 'f3', piece: 'wN' },
  { square: 'c4', piece: 'wB' },
  { square: 'd4', piece: 'wP', opacity: 0.35 },
];

export function TeachingStudio({ theme }: { theme: BoardTheme }) {
  const boardRef = useRef<ChessiroCanvasRef>(null);
  const [pos, setPos] = useState(createInitialPosition);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [instant, setInstant] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showGhosts, setShowGhosts] = useState(false);
  const [boardWidthPct, setBoardWidthPct] = useState(100);
  const [status, setStatus] = useState('Idle — try the demonstrations, or move a piece yourself.');

  const posRef = useRef(pos);
  posRef.current = pos;

  const fen = useMemo(() => makeFen(pos.toSetup()), [pos]);
  const dests = useMemo(() => chessgroundDests(pos), [pos]);
  const turnColor: PieceColor = pos.turn === 'white' ? 'w' : 'b';

  const commitMove = useCallback((from: string, to: string): boolean => {
    const move = parseUci(`${from}${to}`);
    const current = posRef.current;
    if (!move || !current.isLegal(move)) return false;
    const next = current.clone();
    next.play(move);
    setPos(next);
    setLastMove({ from, to });
    return true;
  }, []);

  const handleMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    const move = parseUci(`${from}${to}${promotion ?? ''}`);
    const current = posRef.current;
    if (!move || !current.isLegal(move)) return false;
    const next = current.clone();
    next.play(move);
    setPos(next);
    setLastMove({ from, to });
    return true;
  }, []);

  // Demonstrate like a coach: pulse the target, glide the piece there, then
  // commit with animations suppressed for a tick so it doesn't animate twice.
  const demonstrate = useCallback(async (from: string, to: string, note?: string) => {
    if (note) setStatus(note);
    await boardRef.current?.pulseSquare(to, { times: 1, durationMs: 500 });
    await boardRef.current?.animateMove(from, to, { durationMs: 950 });
    setInstant(true);
    commitMove(from, to);
    window.setTimeout(() => setInstant(false), 80);
    await sleep(120);
  }, [commitMove]);

  const runLesson = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      setPos(createInitialPosition());
      setLastMove(null);
      await sleep(400);
      await demonstrate('e2', 'e4', 'Lesson: control the centre with 1. e4');
      await sleep(300);
      await demonstrate('e7', 'e5', 'Black mirrors with 1… e5');
      await sleep(300);
      setStatus('Preview the idea first, as a ghost…');
      await boardRef.current?.animateMove('g1', 'f3', { ghost: true, durationMs: 900 });
      await sleep(150);
      await demonstrate('g1', 'f3', '…then play it: 2. Nf3 attacks e5');
      await sleep(300);
      await demonstrate('b8', 'c6', 'Black defends with 2… Nc6');
      await sleep(300);
      setStatus('f7 is the weakest square in Black’s camp.');
      await boardRef.current?.pulseSquare('f7', { color: 'rgba(239, 68, 68, 0.9)', times: 2 });
      await demonstrate('f1', 'c4', '3. Bc4 — the Italian Game, eyeing f7');
      setStatus('Lesson complete. Your move.');
    } finally {
      setBusy(false);
    }
  }, [busy, demonstrate]);

  const previewRandomMove = useCallback(async () => {
    if (busy) return;
    const entries = Array.from(dests.entries()).filter(([, tos]) => tos.length > 0);
    if (entries.length === 0) return;
    const [from, tos] = entries[Math.floor(Math.random() * entries.length)];
    const to = tos[Math.floor(Math.random() * tos.length)];
    setBusy(true);
    setStatus(`Ghost preview: ${from} → ${to}. The position is untouched.`);
    try {
      await boardRef.current?.animateMove(from, to, { ghost: true, durationMs: 900 });
    } finally {
      setBusy(false);
    }
  }, [busy, dests]);

  const pulseCentre = useCallback(() => {
    setStatus('Pulse: look at d4 and e4.');
    boardRef.current?.pulseSquare('d4', { times: 2 });
    boardRef.current?.pulseSquare('e4', { color: 'rgba(56, 189, 248, 0.95)', times: 2 });
  }, []);

  const shakeKing = useCallback(() => {
    const board = posRef.current.board;
    const kingIdx = board.kingOf(posRef.current.turn);
    if (kingIdx === undefined) return;
    const file = 'abcdefgh'[kingIdx % 8];
    const rank = Math.floor(kingIdx / 8) + 1;
    setStatus(`Shake: not the king (${file}${rank}).`);
    boardRef.current?.shakePiece(`${file}${rank}`);
  }, []);

  const resetLesson = useCallback(() => {
    boardRef.current?.clearTeachingEffects();
    setPos(createInitialPosition());
    setLastMove(null);
    setStatus('Board reset.');
  }, []);

  return (
    <Workbench
      board={
        <>
          <Plate width={`${boardWidthPct}%`}>
            <ChessiroCanvas
              ref={boardRef}
              position={fen}
              lastMove={lastMove}
              turnColor={turnColor}
              movableColor={turnColor}
              dests={dests}
              onMove={handleMove}
              interactive={!busy}
              theme={theme}
              showAnimations={!instant}
              showNotation
              showMargin
              ghostPieces={showGhosts ? LESSON_GHOSTS : undefined}
            />
          </Plate>
          <Status>{status}</Status>
        </>
      }
      controls={
        <>
          <Panel title="Demonstrations">
            <button onClick={runLesson} disabled={busy} className="btn btn-primary btn-block">
              {busy ? 'Teaching…' : 'Run scripted lesson'}
            </button>
            <button onClick={previewRandomMove} disabled={busy} className="btn btn-block">
              Ghost-preview a legal move
            </button>
            <p className="note">
              <C>animateMove()</C> lifts the piece, glides it and sets it down. With <C>ghost: true</C> a
              translucent copy fades out and the position is untouched.
            </p>
          </Panel>

          <Panel title="Attention & feedback">
            <button onClick={pulseCentre} className="btn btn-block">Pulse the centre</button>
            <button onClick={shakeKing} className="btn btn-block">Shake the king</button>
            <Toggle label="Ghost placement hints" checked={showGhosts} onChange={setShowGhosts} />
            <p className="note">
              Ghost pieces show where a piece belongs — “your knight goes to f3” — without changing the position.
            </p>
          </Panel>

          <Panel title="Resize robustness">
            <Slider label="Container width" value={boardWidthPct} min={45} max={100} step={1} onChange={setBoardWidthPct} format={(v) => `${v}%`} />
            <p className="note">
              Pieces are positioned in percentages, so they stay glued to their squares through any
              resize or reflow — even mid-animation.
            </p>
          </Panel>

          <button onClick={resetLesson} className="btn btn-block">Reset board & effects</button>
        </>
      }
      code={
        <>
          <p className="eyebrow mb-2.5">Teaching API</p>
          <CodeBlock code={TEACHING_CODE} language="tsx" />
        </>
      }
    />
  );
}

/* ═══ Drill 1 — guided move ═══════════════════════════════════════════ */

const DRILL_FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1';

const CONCEPT_ARROWS: Arrow[] = [
  { startSquare: 'f3', endSquare: 'f7', color: 'rgba(34, 197, 94, 0.9)' },
  { startSquare: 'c4', endSquare: 'f7', color: 'rgba(34, 197, 94, 0.9)' },
];

const CONCEPT_LABELS: Record<string, SquareLabel> = {
  f7: { text: '2 v 1', corner: 'center', background: 'rgba(185, 28, 28, 0.92)' },
  f3: { text: 'A', corner: 'topRight', background: 'rgba(21, 128, 61, 0.92)' },
  c4: { text: 'A', corner: 'topRight', background: 'rgba(21, 128, 61, 0.92)' },
  e8: { text: 'D', corner: 'topLeft', background: 'rgba(30, 64, 175, 0.92)' },
};

export function GuidedDrill({ theme }: { theme: BoardTheme }) {
  const boardRef = useRef<ChessiroCanvasRef>(null);
  const [pos, setPos] = useState(() => posFromFen(DRILL_FEN));
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [solved, setSolved] = useState(false);
  const [wrongCount, setWrongCount] = useState(0);
  const [showConcept, setShowConcept] = useState(false);
  const [status, setStatus] = useState('White to move. There is a mate in one — find it.');

  const posRef = useRef(pos);
  posRef.current = pos;

  const fen = useMemo(() => makeFen(pos.toSetup()), [pos]);
  const dests = useMemo(() => chessgroundDests(pos), [pos]);
  const turnColor: PieceColor = pos.turn === 'white' ? 'w' : 'b';

  const handleMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    const move = parseUci(`${from}${to}${promotion ?? ''}`);
    const current = posRef.current;
    if (!move || !current.isLegal(move)) return false;
    const next = current.clone();
    next.play(move);
    setPos(next);
    setLastMove({ from, to });
    setSolved(true);
    setStatus('Qxf7# — Scholar’s Mate. The queen is protected by the bishop on c4.');
    boardRef.current?.pulseSquare('f7', { color: 'rgba(34, 197, 94, 0.95)', times: 2 });
    return true;
  }, []);

  const handleWrongMove = useCallback((from: string, to: string) => {
    setWrongCount((c) => c + 1);
    setStatus(`${from} → ${to} doesn’t mate. Look for the weakest square around the black king.`);
  }, []);

  const showHint = useCallback(async () => {
    setStatus('Hint: watch the ghost piece.');
    await boardRef.current?.animateMove('f3', 'f7', { ghost: true, durationMs: 1000 });
    setStatus('Now play it.');
  }, []);

  const reset = useCallback(() => {
    boardRef.current?.clearTeachingEffects();
    setPos(posFromFen(DRILL_FEN));
    setLastMove(null);
    setSolved(false);
    setWrongCount(0);
    setShowConcept(false);
    setStatus('White to move. There is a mate in one — find it.');
  }, []);

  return (
    <Workbench
      board={
        <>
          <Plate caption="Fig. 1 — Guided move. Only the mating move is accepted; everything else snaps back.">
            <ChessiroCanvas
              ref={boardRef}
              position={fen}
              lastMove={lastMove}
              turnColor={turnColor}
              movableColor={turnColor}
              dests={dests}
              onMove={handleMove}
              expectedMove={solved ? null : { from: 'f3', to: 'f7' }}
              onWrongMove={handleWrongMove}
              interactive={!solved}
              theme={theme}
              showNotation
              showMargin
              arrows={showConcept && !solved ? CONCEPT_ARROWS : undefined}
              squareLabels={showConcept && !solved ? CONCEPT_LABELS : undefined}
            />
          </Plate>
          <Status>{status}</Status>
        </>
      }
      controls={
        <Panel title="Guided mode">
          <p className="note">
            <C>{"expectedMove={{ from: 'f3', to: 'f7' }}"}</C> — every other move is rejected: the piece
            snaps back and shakes, and <C>onWrongMove</C> fires so you can coach.
          </p>
          <p className="field">
            <span>Wrong attempts</span>
            <span className="val">{wrongCount}</span>
          </p>
          <button onClick={showHint} disabled={solved} className="btn btn-block">Ghost hint</button>
          <Toggle label="Explain the concept" checked={showConcept} onChange={setShowConcept} />
          <p className="note">
            <C>squareLabels</C> teaches the counting rule: f7 is attacked twice (A) but defended once (D),
            so the capture wins.
          </p>
          <button onClick={reset} className="btn btn-block">Reset drill</button>
        </Panel>
      }
    />
  );
}

/* ═══ Drill 2 — placement ═════════════════════════════════════════════ */

const FORK_FEN = 'r3k3/8/8/8/8/8/8/4K3 w - - 0 1';
const FORK_SOLVED_FEN = 'r3k3/2N5/8/8/8/8/8/4K3 b - - 0 1';
const FORK_TARGET = 'c7';

export function ForkTrainer({ theme }: { theme: BoardTheme }) {
  const boardRef = useRef<ChessiroCanvasRef>(null);
  const [placed, setPlaced] = useState(false);
  const [fails, setFails] = useState(0);
  const [dragPos, setDragPos] = useState<[number, number] | null>(null);
  const [status, setStatus] = useState('Drag the knight onto the square where it forks both black pieces.');

  const knightSrc = useMemo(() => resolvePieceImageSrc('wN'), []);

  const handlePlacement = useCallback((sq: string) => {
    if (sq === FORK_TARGET) {
      setPlaced(true);
      setStatus('Nc7+ — one knight, two targets: check on e8, and the rook on a8 falls next move.');
      boardRef.current?.pulseSquare('e8', { color: 'rgba(34, 197, 94, 0.95)', times: 2 });
      boardRef.current?.pulseSquare('a8', { color: 'rgba(34, 197, 94, 0.95)', times: 2 });
    } else {
      setFails((f) => f + 1);
      setStatus(`From ${sq} the knight misses either the king or the rook. Try again.`);
      boardRef.current?.pulseSquare(sq, { color: 'rgba(239, 68, 68, 0.9)', times: 1 });
    }
  }, []);

  const startPaletteDrag = useCallback((e: React.PointerEvent) => {
    if (placed) return;
    e.preventDefault();
    setDragPos([e.clientX, e.clientY]);
    const move = (ev: PointerEvent) => setDragPos([ev.clientX, ev.clientY]);
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setDragPos(null);
      const sq = boardRef.current?.getSquareAtPoint(ev.clientX, ev.clientY);
      if (!sq) {
        setStatus('Drop the knight on the board.');
        return;
      }
      handlePlacement(sq);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }, [placed, handlePlacement]);

  const reset = useCallback(() => {
    boardRef.current?.clearTeachingEffects();
    setPlaced(false);
    setFails(0);
    setStatus('Drag the knight onto the square where it forks both black pieces.');
  }, []);

  const ghostHints = useMemo<GhostPiece[] | undefined>(() => {
    if (placed || fails < 2) return undefined;
    return [{ square: FORK_TARGET, piece: 'wN', opacity: 0.3 }];
  }, [placed, fails]);

  return (
    <Workbench
      board={
        <>
          <Plate caption="Fig. 2 — Placement. The drop square is resolved with getSquareAtPoint, so the tray lives outside the board.">
            <ChessiroCanvas
              ref={boardRef}
              position={placed ? FORK_SOLVED_FEN : FORK_FEN}
              interactive={false}
              theme={theme}
              showNotation
              showMargin
              ghostPieces={ghostHints}
              squareLabels={placed ? {
                e8: { text: '+', corner: 'center', background: 'rgba(21,128,61,0.92)' },
                a8: { text: '✖', corner: 'center', background: 'rgba(185,28,28,0.92)' },
              } : undefined}
            />
          </Plate>
          <Status>{status}</Status>
        </>
      }
      controls={
        <Panel title="Piece tray">
          <div
            className="flex items-center justify-center p-4 min-h-24"
            style={{ border: '1px dashed var(--color-rule-2)', background: 'var(--color-paper-2)' }}
          >
            {placed ? (
              <span className="caption" style={{ color: 'var(--color-sage)' }}>Placed. Nc7+ forks e8 and a8.</span>
            ) : (
              <img
                src={knightSrc}
                alt="White knight — drag onto the board"
                draggable={false}
                onPointerDown={startPaletteDrag}
                className="w-14 h-14 cursor-grab active:cursor-grabbing"
                style={{ touchAction: 'none' }}
              />
            )}
          </div>
          <p className="note">
            Built from <C>ref.getSquareAtPoint(x, y)</C> and <C>resolvePieceImageSrc('wN')</C> — track your
            own drag from any palette and resolve the drop square on release. After two misses a
            <C>ghostPieces</C> hint appears.
          </p>
          <p className="field">
            <span>Misses</span>
            <span className="val">{fails}</span>
          </p>
          <button onClick={reset} className="btn btn-block">Reset drill</button>
        </Panel>
      }
    />
  );
}

/* ═══ Cinematics ══════════════════════════════════════════════════════ */

const CINEMATIC_FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1';
const PROMO_FEN = 'k7/4P3/8/8/8/8/8/4K3 w - - 0 1';
const PROMO_DONE_FEN = 'k3Q3/8/8/8/8/8/8/4K3 b - - 0 1';
const ENPASSANT_FEN = '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1';
const ENPASSANT_DONE_FEN = '4k3/8/3P4/8/8/8/8/4K3 b - - 0 1';
const CASTLE_FEN = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
const CASTLE_DONE_FEN = 'r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1';

export function CinematicStudio({ theme }: { theme: BoardTheme }) {
  const boardRef = useRef<ChessiroCanvasRef>(null);
  const [pos, setPos] = useState(() => posFromFen(CINEMATIC_FEN));
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [instant, setInstant] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Idle — pick a cinematic. The board is non-interactive, like a replay screen.');
  const driftRef = useRef<{ stop: () => void } | null>(null);

  const posRef = useRef(pos);
  posRef.current = pos;

  const fen = useMemo(() => makeFen(pos.toSetup()), [pos]);

  // Commit with animations suppressed for a tick so the position update
  // doesn't animate on top of the cinematic landing.
  const commitInstant = useCallback((from: string, to: string) => {
    const move = parseUci(`${from}${to}`);
    const current = posRef.current;
    if (!move || !current.isLegal(move)) return;
    const next = current.clone();
    next.play(move);
    setInstant(true);
    setPos(next);
    setLastMove({ from, to });
    window.setTimeout(() => setInstant(false), 80);
  }, []);

  const resetTo = useCallback((factory: () => ReturnType<typeof posFromFen>) => {
    driftRef.current?.stop();
    driftRef.current = null;
    boardRef.current?.clearCinematics();
    setPos(factory());
    setLastMove(null);
  }, []);

  const commitFen = useCallback((f: string, move?: { from: string; to: string }) => {
    setInstant(true);
    setPos(posFromFen(f));
    if (move) setLastMove(move);
    window.setTimeout(() => setInstant(false), 80);
  }, []);

  const playBrilliant = useCallback(async () => {
    if (busy || !boardRef.current) return;
    setBusy(true);
    setStatus('Qxf7!! — the camera zooms in, the queen flies with 1.5 spins and lands with sparkles.');
    try {
      resetTo(() => posFromFen(CINEMATIC_FEN));
      await sleep(400);
      const playback = boardRef.current.playCinematic([
        { type: 'camera', action: 'zoomTo', square: 'f7', options: { scale: 1.5 } },
        { type: 'move', from: 'f3', to: 'f7', options: { style: 'brilliant', badge: '!!' } },
        { type: 'call', fn: () => commitInstant('f3', 'f7') },
        { type: 'wait', ms: 400 },
        { type: 'camera', action: 'zoomOut' },
      ]);
      await playback.finished;
      setStatus('Scholar’s Mate: the pawn blasts away and the camera shakes the instant the queen drops.');
    } finally {
      setBusy(false);
    }
  }, [busy, resetTo, commitInstant]);

  const playSlam = useCallback(async () => {
    if (busy || !boardRef.current) return;
    setBusy(true);
    setStatus('Slam: the knight rises toward the viewer, hangs, then slams down with a shockwave.');
    try {
      resetTo(createInitialPosition);
      await sleep(400);
      const playback = boardRef.current.playCinematic([
        { type: 'move', from: 'g1', to: 'f3', options: { style: 'slam' } },
        { type: 'call', fn: () => commitInstant('g1', 'f3') },
      ]);
      await playback.finished;
      setStatus('Nf3, slammed — flash, shockwave and camera shake all fire on the contact frame.');
    } finally {
      setBusy(false);
    }
  }, [busy, resetTo, commitInstant]);

  const playMeteor = useCallback(async () => {
    if (busy || !boardRef.current) return;
    setBusy(true);
    setStatus('Meteor: a fiery arc with a ghost trail — the f7 pawn is blasted off the board on contact.');
    try {
      resetTo(() => posFromFen(CINEMATIC_FEN));
      await sleep(400);
      const playback = boardRef.current.playCinematic([
        { type: 'camera', action: 'zoomTo', square: 'f7', options: { scale: 1.35 } },
        { type: 'move', from: 'c4', to: 'f7', options: { style: 'meteor', badge: '!' } },
        { type: 'call', fn: () => commitInstant('c4', 'f7') },
        { type: 'wait', ms: 400 },
        { type: 'camera', action: 'zoomOut' },
      ]);
      await playback.finished;
      setStatus('Bxf7+, meteor style: trail, flash, victim blast and a hard shake at touchdown.');
    } finally {
      setBusy(false);
    }
  }, [busy, resetTo, commitInstant]);

  const playSmoothReplay = useCallback(async () => {
    if (busy || !boardRef.current) return;
    setBusy(true);
    setStatus('Smooth replay: gentle arcs, no landing effects — for the non-highlight moves.');
    try {
      resetTo(createInitialPosition);
      await sleep(400);
      const moves: Array<[Square, Square]> = [['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3']];
      const playback = boardRef.current.playCinematic(
        moves.flatMap<CinematicStep>(([from, to]) => [
          { type: 'move', from, to, options: { style: 'smooth' } },
          { type: 'call', fn: () => commitInstant(from, to) },
          { type: 'wait', ms: 120 },
        ]),
      );
      await playback.finished;
      setStatus('Three smooth replay moves, sequenced with playCinematic.');
    } finally {
      setBusy(false);
    }
  }, [busy, resetTo, commitInstant]);

  const playCheckmate = useCallback(async () => {
    if (busy || !boardRef.current) return;
    setBusy(true);
    setStatus('Checkmate finale: banner, confetti rain and fireworks, all board-relative overlays.');
    try {
      const playback = boardRef.current.playCinematic([
        {
          type: 'parallel',
          steps: [
            { type: 'banner', options: { text: 'CHECKMATE' } },
            { type: 'celebrate', options: { kind: 'both' } },
          ],
        },
      ]);
      await playback.finished;
      setStatus('celebrate() and popBanner() also work as one-off calls.');
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const playPromotion = useCallback(async () => {
    if (busy || !boardRef.current) return;
    setBusy(true);
    setStatus('Promotion: the pawn advances, then a pillar of light morphs it into a queen.');
    try {
      resetTo(() => posFromFen(PROMO_FEN));
      await sleep(400);
      const playback = boardRef.current.playCinematic([
        { type: 'camera', action: 'zoomTo', square: 'e8', options: { scale: 1.6 } },
        { type: 'move', from: 'e7', to: 'e8', options: { style: 'smooth' } },
        { type: 'call', fn: () => commitFen(PROMO_DONE_FEN, { from: 'e7', to: 'e8' }) },
        { type: 'promotionBeam', square: 'e8', options: { fromPiece: 'wP', piece: 'wQ' } },
        { type: 'badge', square: 'e8', options: { text: '=Q' } },
        { type: 'wait', ms: 300 },
        { type: 'camera', action: 'zoomOut' },
      ]);
      await playback.finished;
      setStatus('e8=Q — promotionBeam() shoots a pillar of light and spins the new queen into being.');
    } finally {
      setBusy(false);
    }
  }, [busy, resetTo, commitFen]);

  const playEnPassant = useCallback(async () => {
    if (busy || !boardRef.current) return;
    setBusy(true);
    setStatus('En passant: the captured pawn is pulled into a vortex as the pawn slides past.');
    try {
      resetTo(() => posFromFen(ENPASSANT_FEN));
      await sleep(400);
      const playback = boardRef.current.playCinematic([
        { type: 'camera', action: 'zoomTo', square: 'd6', options: { scale: 1.7 } },
        {
          type: 'parallel',
          steps: [
            { type: 'move', from: 'e5', to: 'd6', options: { style: 'great' } },
            { type: 'implode', square: 'd5' },
          ],
        },
        { type: 'call', fn: () => commitFen(ENPASSANT_DONE_FEN, { from: 'e5', to: 'd6' }) },
        { type: 'wait', ms: 300 },
        { type: 'camera', action: 'zoomOut' },
      ]);
      await playback.finished;
      setStatus('exd6 e.p. — implode() collapses the d5 pawn into a swirling vortex on contact.');
    } finally {
      setBusy(false);
    }
  }, [busy, resetTo, commitFen]);

  const playCastle = useCallback(async () => {
    if (busy || !boardRef.current) return;
    setBusy(true);
    setStatus('Castling: king and rook lift, spin in 3D and swap places at once.');
    try {
      resetTo(() => posFromFen(CASTLE_FEN));
      await sleep(400);
      const playback = boardRef.current.playCinematic([
        { type: 'castleSwap', kingFrom: 'e1', kingTo: 'g1', rookFrom: 'h1', rookTo: 'f1' },
        { type: 'call', fn: () => commitFen(CASTLE_DONE_FEN, { from: 'e1', to: 'g1' }) },
        { type: 'burst', square: 'g1', options: { kind: 'sparkles', color: '#8fd0ff' } },
      ]);
      await playback.finished;
      setStatus('O-O — castleSwap() flies both pieces at once; the rook arcs lower so they never collide.');
    } finally {
      setBusy(false);
    }
  }, [busy, resetTo, commitFen]);

  const playThreatVision = useCallback(async () => {
    if (busy || !boardRef.current) return;
    setBusy(true);
    setStatus('Threat vision: spotlight the mating net, then trace the bishop’s path to f7.');
    try {
      resetTo(() => posFromFen(CINEMATIC_FEN));
      await sleep(400);
      const b = boardRef.current;
      const spot = b.spotlight(['c4', 'f3', 'f7'], { radius: 0.85 });
      await b.drawLaser('c4', 'f7', { persist: true, durationMs: 550 });
      await b.drawLaser('f3', 'f7', { color: '#ffd65a', persist: true, durationMs: 550 });
      await b.popBadge('f7', { text: '#', background: '#ff3b3b' });
      await sleep(900);
      await spot.clear();
      b.clearCinematics();
      setStatus('spotlight() dims all but the key squares; drawLaser() animates a glowing threat beam.');
    } finally {
      setBusy(false);
    }
  }, [busy, resetTo]);

  const playKingTopple = useCallback(async () => {
    if (busy || !boardRef.current) return;
    setBusy(true);
    setStatus('Checkmate: the queen lands, then the black king tips over on its base.');
    try {
      resetTo(() => posFromFen(CINEMATIC_FEN));
      await sleep(400);
      const playback = boardRef.current.playCinematic([
        { type: 'move', from: 'f3', to: 'f7', options: { style: 'brilliant', badge: '#' } },
        { type: 'call', fn: () => commitInstant('f3', 'f7') },
        { type: 'wait', ms: 200 },
        { type: 'checkmate', square: 'e8' },
      ]);
      await playback.finished;
      setStatus('Qxf7# — checkmate() topples the king, dims the board and announces the result.');
    } finally {
      setBusy(false);
    }
  }, [busy, resetTo, commitInstant]);

  const playAnnotations = useCallback(async () => {
    if (busy || !boardRef.current) return;
    setBusy(true);
    setStatus('annotate(): live text pinned to squares — evaluations, counts, callouts.');
    try {
      resetTo(() => posFromFen(CINEMATIC_FEN));
      await sleep(300);
      const b = boardRef.current;
      const evalTag = b.annotate('f3', '+0.4', { corner: 'topRight', background: '#1f6f43' });
      const target = b.annotate('f7', 'weak', { corner: 'center', background: '#9b2226' });
      b.annotate('c4', 'A', { corner: 'topLeft', background: '#1e40af' });
      await sleep(900);
      // setText updates in place — no re-animation, so a running eval doesn't flicker.
      evalTag.setText('+3.1');
      target.setText('2 v 1');
      setStatus('setText() swaps the text in place, without replaying the entry animation.');
      await sleep(1400);
      b.annotate('f7', 'Fork!', { durationMs: 1200, enter: 'rise', corner: 'bottomRight' });
      await sleep(1600);
      b.clearCinematics();
      setStatus('Annotations persist until cleared; the rising one dismissed itself.');
    } finally {
      setBusy(false);
    }
  }, [busy, resetTo]);

  const playSparkles = useCallback(() => {
    setStatus('squareBurst: sparkles and a shockwave on e4.');
    boardRef.current?.squareBurst('e4', { kind: 'both' });
  }, []);

  const playBadge = useCallback(() => {
    setStatus('popBadge: a “!!” annotation on f7.');
    boardRef.current?.popBadge('f7', { text: '!!' });
  }, []);

  const playTiltDrift = useCallback(async () => {
    if (!boardRef.current) return;
    setStatus('camera.tilt then camera.drift: a 3D tilt, then a slow Ken Burns wander until reset.');
    driftRef.current?.stop();
    await boardRef.current.camera.tilt({ rotateX: 18 });
    driftRef.current = boardRef.current.camera.drift();
  }, []);

  const resetAll = useCallback(() => {
    resetTo(() => posFromFen(CINEMATIC_FEN));
    setStatus('Reset: cinematics cancelled, camera restored, position back to the start.');
  }, [resetTo]);

  return (
    <Workbench
      board={
        <>
          <Plate width="92%">
            <ChessiroCanvas
              ref={boardRef}
              position={fen}
              lastMove={lastMove}
              interactive={false}
              theme={theme}
              showAnimations={!instant}
              showNotation
              showMargin
            />
          </Plate>
          <Status>{status}</Status>
        </>
      }
      controls={
        <>
          <Panel title="Scripted sequences">
            <button onClick={playBrilliant} disabled={busy} className="btn btn-primary btn-block">
              {busy ? 'Playing…' : 'Brilliant move (Qxf7!!)'}
            </button>
            <button onClick={playSlam} disabled={busy} className="btn btn-block">Slam (Nf3)</button>
            <button onClick={playMeteor} disabled={busy} className="btn btn-block">Meteor smash (Bxf7+)</button>
            <button onClick={playSmoothReplay} disabled={busy} className="btn btn-block">Smooth replay</button>
            <button onClick={playCheckmate} disabled={busy} className="btn btn-block">Checkmate finale</button>
            <p className="note">
              Scripts are arrays of steps: <C>move</C>, <C>camera</C>, <C>burst</C>, <C>badge</C>,{' '}
              <C>banner</C>, <C>celebrate</C>, <C>wait</C>, <C>parallel</C> and <C>call</C> — the last one
              commits your position after a move lands. Impact effects fire on the exact contact frame.
            </p>
          </Panel>

          <Panel title="Special moves">
            <button onClick={playPromotion} disabled={busy} className="btn btn-block">Promotion (e8=Q)</button>
            <button onClick={playEnPassant} disabled={busy} className="btn btn-block">En passant (exd6)</button>
            <button onClick={playCastle} disabled={busy} className="btn btn-block">Castling (O-O)</button>
            <button onClick={playThreatVision} disabled={busy} className="btn btn-block">Threat vision</button>
            <p className="note">
              <C>promotionBeam</C>, <C>implode</C>, <C>castleSwap</C>, <C>spotlight</C> and <C>drawLaser</C> —
              board-relative overlays, usable as script steps or one-off calls.
            </p>
          </Panel>

          <Panel title="Learning & endgame">
            <button onClick={playKingTopple} disabled={busy} className="btn btn-block">
              Checkmate (king topples)
            </button>
            <button onClick={playAnnotations} disabled={busy} className="btn btn-block">
              Annotate squares with text
            </button>
            <p className="note">
              <C>checkmate()</C> tips the king over on its base, the gesture a player makes when
              they resign, then dims the board and announces. <C>annotate()</C> pins live text to a
              square — evaluations, attacker counts, callouts — and <C>setText</C> updates it in
              place without replaying the animation.
            </p>
          </Panel>

          <Panel title="Primitives">
            <button onClick={playSparkles} className="btn btn-block">Sparkles</button>
            <button onClick={playBadge} className="btn btn-block">Badge</button>
            <button onClick={playTiltDrift} className="btn btn-block">Tilt & drift</button>
            <p className="note">
              Effects run on the compositor via the Web Animations API — transform, opacity and filter
              only, with no React state per frame. <C>prefers-reduced-motion</C> degrades flights to a
              plain glide.
            </p>
          </Panel>

          <button onClick={resetAll} className="btn btn-block">Reset & cancel</button>
        </>
      }
      code={
        <>
          <p className="eyebrow mb-2.5">Cinematic API</p>
          <CodeBlock code={CINEMATIC_CODE} language="tsx" />
        </>
      }
    />
  );
}
