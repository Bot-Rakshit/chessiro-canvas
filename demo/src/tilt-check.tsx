import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChessiroCanvas, type ChessiroCanvasRef, type Square } from 'chessiro-canvas';

// Légal's mate: black king on e8 is mated by the queen on f7.
const MATE = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR';

const row: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 };
const btn: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 8, border: '1px solid #57534e',
  background: '#292524', color: '#e7e5e4', cursor: 'pointer', font: '13px system-ui',
};
const box: React.CSSProperties = {
  padding: '5px 7px', borderRadius: 6, border: '1px solid #57534e',
  background: '#1c1917', color: '#e7e5e4', font: '13px system-ui',
};

/**
 * A slider and a typed box driving the same number: drag for a quick sweep,
 * click into the box and type (or arrow-key) for an exact value. The box keeps
 * its own draft string so half-finished input like '' or '-' isn't parsed into
 * a jump, and normalises to the clamped value on blur / Enter.
 */
function NumberField({ label, value, min, max, step = 1, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const typing = useRef(false);

  // Follow the value when it moves from anywhere else (the slider, a preset).
  useEffect(() => {
    if (!typing.current) setDraft(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const n = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(n)) return;
    onChange(Math.min(max, Math.max(min, n)));
  };

  return (
    <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <span style={{ opacity: 0.75 }}>{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => { typing.current = false; onChange(+e.target.value); }}
      />
      <input
        type="number" style={{ ...box, width: 74 }} min={min} max={max} step={step} value={draft}
        onFocus={() => { typing.current = true; }}
        onChange={(e) => { setDraft(e.target.value); commit(e.target.value); }}
        onBlur={() => { typing.current = false; setDraft(String(value)); }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      />
    </label>
  );
}

function App() {
  const plain = useRef<ChessiroCanvasRef>(null);
  const flipped = useRef<ChessiroCanvasRef>(null);
  const [angle, setAngle] = useState(84);
  const [durationMs, setDurationMs] = useState(600);
  const [direction, setDirection] = useState<'left' | 'right' | 'auto'>('right');
  const [holdMode, setHoldMode] = useState<'forever' | 'timed' | 'spring'>('forever');
  const [holdMs, setHoldMs] = useState(1000);
  const [square, setSquare] = useState('e8');
  const [pivot, setPivot] = useState('');

  const both = (fn: (b: ChessiroCanvasRef) => unknown) => {
    if (plain.current) fn(plain.current);
    if (flipped.current) fn(flipped.current);
  };

  return (
    <div style={{ font: '13px system-ui', color: '#e7e5e4' }}>
      <div style={{ ...row, flexWrap: 'wrap', gap: 18 }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ opacity: 0.75 }}>square</span>
          <input style={{ ...box, width: 44 }} value={square} onChange={(e) => setSquare(e.target.value.trim())} />
        </label>
        <NumberField label="angle°" value={angle} min={-180} max={180} onChange={setAngle} />
        <NumberField label="durationMs" value={durationMs} min={0} max={3000} step={50} onChange={setDurationMs} />
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ opacity: 0.75 }}>pivot</span>
          <input
            style={{ ...box, width: 110 }} value={pivot} placeholder="50% 50%"
            onChange={(e) => setPivot(e.target.value)}
          />
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ opacity: 0.75 }}>direction</span>
          <select style={box} value={direction} onChange={(e) => setDirection(e.target.value as typeof direction)}>
            <option value="right">right</option>
            <option value="left">left</option>
            <option value="auto">auto</option>
          </select>
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ opacity: 0.75 }}>hold</span>
          <select style={box} value={holdMode} onChange={(e) => setHoldMode(e.target.value as typeof holdMode)}>
            <option value="forever">forever (hold: true)</option>
            <option value="timed">for holdMs, then up</option>
            <option value="spring">spring back (hold: false)</option>
          </select>
        </label>
        {holdMode === 'timed' && (
          <NumberField label="holdMs" value={holdMs} min={0} max={10000} step={50} onChange={setHoldMs} />
        )}
      </div>
      <div style={row}>
        <button
          style={btn}
          onClick={() => both((b) => b.tiltPiece(square, {
            angle, durationMs, direction, force: true,
            ...(holdMode === 'timed' ? { holdMs } : { hold: holdMode === 'forever' }),
            // Empty box means "use the library default" (the piece centre).
            ...(pivot.trim() ? { pivot: pivot.trim() } : {}),
          }))}
        >
          tiltPiece
        </button>
        <button style={btn} onClick={() => both((b) => b.resetPieceTilt(square))}>resetPieceTilt(square)</button>
        <button style={btn} onClick={() => both((b) => b.resetPieceTilt())}>resetPieceTilt() all</button>
        <button style={btn} onClick={() => both((b) => b.clearTeachingEffects())}>clearTeachingEffects</button>
        <button style={btn} onClick={() => both((b) => b.checkmate(square as Square, { force: true }))}>
          checkmate cinematic (compare)
        </button>
      </div>
      <div style={{ display: 'flex', gap: 24 }}>
        <div>
          <div style={{ marginBottom: 6, opacity: 0.7 }}>white orientation</div>
          <div style={{ width: 400 }}>
            <ChessiroCanvas ref={plain} position={MATE} interactive={false} check="e8" />
          </div>
        </div>
        <div>
          <div style={{ marginBottom: 6, opacity: 0.7 }}>black orientation + flipPieces</div>
          <div style={{ width: 400 }}>
            <ChessiroCanvas ref={flipped} position={MATE} interactive={false} orientation="black" flipPieces />
          </div>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
