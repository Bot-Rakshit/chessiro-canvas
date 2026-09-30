import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChessiroCanvas,
  MOVE_ANIMATION_PRESETS,
  type AppearAnimation,
  type BoardTheme,
  type CaptureAnimation,
  type ChessiroCanvasRef,
  type EasingName,
  type FlipAnimation,
  type LandingAnimation,
  type MoveAnimationOptions,
  type MoveAnimationPreset,
} from 'chessiro-canvas';
import { chessgroundDests } from 'chessops/compat';
import { makeFen } from 'chessops/fen';
import { parseUci } from 'chessops/util';

import { createInitialPosition } from './chess';
import { Choice, CodeBlock, Panel, Plate, Slider, Status, Toggle, Workbench, cn, sleep } from './ui';

const PRESETS: MoveAnimationPreset[] = ['classic', 'snappy', 'smooth', 'playful', 'arcade', 'elegant', 'minimal'];
const EASING_NAMES: EasingName[] = [
  'easeInOut', 'ease', 'easeOut', 'snappy', 'smooth', 'backOut', 'anticipate', 'spring', 'bounce', 'elastic', 'linear',
];
const CAPTURES: CaptureAnimation[] = ['fade', 'shrink', 'poof', 'knockout', 'sink', 'none'];
const LANDINGS: LandingAnimation[] = ['none', 'squash', 'bounce', 'settle'];
const APPEARS: AppearAnimation[] = ['none', 'fade', 'pop', 'drop', 'rise'];
const FLIPS: FlipAnimation[] = ['none', 'rotate', 'fade'];

// The Fried Liver: knight hops, a pawn trade, a piece sacrifice on f7 and a
// king walk — every kind of motion in thirteen moves.
const MINIATURE = 'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 f3g5 d7d5 e4d5 f6d5 g5f7 e8f7 d1f3'.split(' ');
const EMPTY_BOARD = '8/8/8/8/8/8/8/8';

interface Knobs {
  easing?: EasingName;
  arc?: number;
  knightArc?: number;
  liftScale?: number;
  capture?: CaptureAnimation;
  landing?: LandingAnimation;
  appear?: AppearAnimation;
  flip?: FlipAnimation;
  stagger?: number;
}

/** Native select styled like the segmented controls, for long option lists. */
function Select<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select className="seg" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

export function MotionStudio({ theme }: { theme: BoardTheme }) {
  const board = useRef<ChessiroCanvasRef>(null);
  const [pos, setPos] = useState(createInitialPosition);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [preset, setPreset] = useState<MoveAnimationPreset>('playful');
  const [baseMs, setBaseMs] = useState(200);
  const [knobs, setKnobs] = useState<Knobs>({});
  const [snapBack, setSnapBack] = useState(true);
  const [busy, setBusy] = useState(false);
  // Shown instead of the game position (an empty board isn't a legal game).
  const [displayFen, setDisplayFen] = useState<string | null>(null);
  const [status, setStatus] = useState('Pick a preset, then play a move, run the miniature or flip the board.');
  const cancelRef = useRef(false);

  const fen = useMemo(() => makeFen(pos.toSetup()), [pos]);
  const dests = useMemo(() => chessgroundDests(pos), [pos]);
  const turnColor = pos.turn === 'white' ? 'w' : 'b';

  // Knob defaults shown in the controls come from the preset itself, so the
  // sliders always tell the truth about what's playing.
  const base = preset === 'none' ? MOVE_ANIMATION_PRESETS.classic : MOVE_ANIMATION_PRESETS[preset];
  const eff = {
    easing: knobs.easing ?? base.easing,
    arc: knobs.arc ?? base.arc,
    knightArc: knobs.knightArc ?? base.knightArc,
    liftScale: knobs.liftScale ?? base.liftScale,
    capture: knobs.capture ?? base.capture,
    landing: knobs.landing ?? base.landing,
    appear: knobs.appear ?? base.appear,
    flip: knobs.flip ?? base.flip,
    stagger: knobs.stagger ?? base.stagger,
  };
  const setKnob = <K extends keyof Knobs>(key: K) => (value: Knobs[K]) => setKnobs((k) => ({ ...k, [key]: value }));

  const moveAnimation = useMemo<MoveAnimationOptions>(
    () => ({ preset, ...knobs, snapBack }),
    [preset, knobs, snapBack],
  );

  const code = useMemo(() => {
    const overrides = Object.entries(knobs)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `    ${k}: ${typeof v === 'string' ? `'${v}'` : v},`);
    if (!snapBack) overrides.push('    snapBack: false,');
    const anim = overrides.length === 0
      ? `moveAnimation="${preset}"`
      : `moveAnimation={{\n    preset: '${preset}',\n${overrides.join('\n')}\n  }}`;
    return `<ChessiroCanvas\n  position={fen}\n  animationDurationMs={${baseMs}}\n  ${anim}\n/>`;
  }, [preset, knobs, snapBack, baseMs]);

  const handleMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    const move = parseUci(`${from}${to}${promotion?.toLowerCase() ?? ''}`);
    if (!move || !pos.isLegal(move)) {
      setStatus('Illegal — watch it glide home.');
      return false;
    }
    const next = pos.clone();
    next.play(move);
    setPos(next);
    setLastMove({ from, to });
    setStatus(`${from} → ${to}`);
    return true;
  }, [pos]);

  useEffect(() => () => { cancelRef.current = true; }, []);

  const playMiniature = useCallback(async () => {
    setBusy(true);
    cancelRef.current = false;
    let p = createInitialPosition();
    setPos(p);
    setLastMove(null);
    setStatus('The Fried Liver Attack…');
    await sleep(500);
    for (const uci of MINIATURE) {
      if (cancelRef.current) return;
      const move = parseUci(uci);
      if (!move) break;
      p = p.clone();
      p.play(move);
      setPos(p);
      setLastMove({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
      await sleep(Math.max(650, baseMs * 3.2));
    }
    setStatus('13. Qf3+ — the king is in the open.');
    setBusy(false);
  }, [baseMs]);

  const newGame = useCallback(async () => {
    setBusy(true);
    setDisplayFen(EMPTY_BOARD);
    setLastMove(null);
    await sleep(350);
    setPos(createInitialPosition());
    setDisplayFen(null);
    setStatus(`New game — appear: ${eff.appear}, stagger ${Math.round(eff.stagger)} ms.`);
    await sleep(700);
    setBusy(false);
  }, [eff.appear, eff.stagger]);

  const exportPng = useCallback(async () => {
    const blob = await board.current?.toImage({ size: 1080 });
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chessiro-position.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(`Exported a ${Math.round(blob.size / 1024)} KB PNG with ref.toImage().`);
  }, []);

  return (
    <Workbench
      board={
        <Plate caption={<Status>{status}</Status>}>
          <ChessiroCanvas
            ref={board}
            position={displayFen ?? fen}
            lastMove={lastMove}
            orientation={orientation}
            turnColor={turnColor}
            movableColor={turnColor}
            dests={dests}
            onMove={handleMove}
            theme={theme}
            animationDurationMs={baseMs}
            moveAnimation={moveAnimation}
          />
        </Plate>
      }
      controls={
        <>
          <Panel title="Try it">
            <div className="grid grid-cols-2 gap-2">
              <button className="btn" disabled={busy} onClick={playMiniature}>Play a miniature</button>
              <button className="btn" disabled={busy} onClick={newGame}>New game</button>
              <button className="btn" onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}>Flip board</button>
              <button className="btn" onClick={exportPng}>Export PNG</button>
            </div>
          </Panel>

          <Panel title="Preset">
            <div className="flex flex-wrap -space-x-px">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => { setPreset(p); setKnobs({}); }}
                  className={cn('seg', preset === p && 'seg-on')}
                >
                  {p}
                </button>
              ))}
            </div>
            <Slider label="Base duration" value={baseMs} min={80} max={600} step={10} onChange={setBaseMs} format={(v) => `${v} ms`} />
          </Panel>

          <Panel title="Flight">
            <Select label="Easing" value={eff.easing as EasingName} options={EASING_NAMES} onChange={setKnob('easing')} />
            <Slider label="Arc" value={eff.arc} min={0} max={0.8} step={0.02} onChange={setKnob('arc')} format={(v) => `${v.toFixed(2)} sq`} />
            <Slider label="Knight hop" value={eff.knightArc} min={0} max={1} step={0.02} onChange={setKnob('knightArc')} format={(v) => `${v.toFixed(2)} sq`} />
            <Slider label="Lift scale" value={eff.liftScale} min={1} max={1.4} step={0.01} onChange={setKnob('liftScale')} format={(v) => `${v.toFixed(2)}×`} />
          </Panel>

          <Panel title="Effects">
            <Select label="Capture" value={eff.capture} options={CAPTURES} onChange={setKnob('capture')} />
            <Choice label="Landing" options={LANDINGS} value={eff.landing} onChange={setKnob('landing')} />
            <Select label="Appear" value={eff.appear} options={APPEARS} onChange={setKnob('appear')} />
            <Choice label="Flip" options={FLIPS} value={eff.flip} onChange={setKnob('flip')} />
            <Slider label="Stagger" value={eff.stagger} min={0} max={60} step={1} onChange={setKnob('stagger')} format={(v) => `${v} ms`} />
            <Toggle label="Snap back rejected drops" checked={snapBack} onChange={setSnapBack} />
            <button className="btn btn-block" onClick={() => setKnobs({})}>Reset to preset</button>
          </Panel>
        </>
      }
      code={<CodeBlock code={code} language="tsx" />}
    />
  );
}
