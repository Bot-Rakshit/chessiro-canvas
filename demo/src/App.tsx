import { useState, useCallback, useMemo } from 'react';
import { ChessiroCanvas, type Arrow, type BoardTheme, type Dests, type TextOverlay } from 'chessiro-canvas';
import { computeDests, applyMove } from './chess-logic';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// Mid-game position for testing highlights/arrows
const MIDGAME_FEN = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';

// Promotion test
const PROMO_FEN = '8/P7/8/8/8/8/p7/8 w - - 0 1';

const THEMES: BoardTheme[] = [
  { id: 'chessiro', name: 'Chessiro', darkSquare: '#785E45', lightSquare: '#DFC29A', margin: '#66503B', lastMoveHighlight: '#DFAA4E', selectedPiece: '#B57340' },
  { id: 'lichess', name: 'Lichess Brown', darkSquare: '#b58863', lightSquare: '#f0d9b5', margin: '#9a7650', lastMoveHighlight: '#9bc700', selectedPiece: '#14551e' },
  { id: 'blue', name: 'Ice Blue', darkSquare: '#4682B4', lightSquare: '#B0C4DE', margin: '#34628a', lastMoveHighlight: '#6CB4EE', selectedPiece: '#2E5090' },
  { id: 'green', name: 'Forest', darkSquare: '#769656', lightSquare: '#eeeed2', margin: '#5f7a44', lastMoveHighlight: '#bbcc44', selectedPiece: '#567d2e' },
];

const POSITIONS: { name: string; fen: string }[] = [
  { name: 'Starting', fen: STARTING_FEN },
  { name: 'Italian Game', fen: MIDGAME_FEN },
  { name: 'Promotion Test', fen: PROMO_FEN },
  { name: 'Ruy Lopez', fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3' },
  { name: 'Sicilian Dragon', fen: 'r1bqkb1r/pp2pp1p/2np1np1/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6' },
  { name: 'Endgame', fen: '8/5pk1/6p1/8/3K4/8/6PP/8 w - - 0 40' },
];

export function App() {
  const [fen, setFen] = useState(STARTING_FEN);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [themeIdx, setThemeIdx] = useState(0);
  const [showMargin, setShowMargin] = useState(true);
  const [showNotation, setShowNotation] = useState(true);
  const [showAnimations, setShowAnimations] = useState(true);
  const [animDuration, setAnimDuration] = useState(200);
  const [interactive, setInteractive] = useState(true);
  const [allowDrag, setAllowDrag] = useState(true);
  const [allowArrows, setAllowArrows] = useState(true);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [overlays, setOverlays] = useState<TextOverlay[]>([]);
  const [showBadge, setShowBadge] = useState(false);

  const theme = THEMES[themeIdx];
  const dests = useMemo(() => computeDests(fen), [fen]);

  const handleMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    const newFen = applyMove(fen, from, to, promotion);
    if (newFen === fen) return false;
    setFen(newFen);
    setLastMove({ from, to });
    setMoveHistory(prev => [...prev, `${from}${to}${promotion || ''}`]);

    // Show a disappearing overlay on captures
    const pieces = new Map<string, boolean>();
    const placement = fen.split(' ')[0];
    let rank = 7, file = 0;
    for (const ch of placement) {
      if (ch === '/') { rank--; file = 0; continue; }
      if (ch >= '1' && ch <= '8') { file += parseInt(ch); continue; }
      const sq = String.fromCharCode(97 + file) + (rank + 1);
      pieces.set(sq, true);
      file++;
    }
    if (pieces.has(to)) {
      const id = `capture-${Date.now()}`;
      setOverlays(prev => [...prev, {
        id,
        text: 'Captured!',
        square: to,
        duration: 1200,
        style: { animation: 'fadeUp 1.2s ease forwards' },
      }]);
      setTimeout(() => setOverlays(prev => prev.filter(o => o.id !== id)), 1500);
    }

    return true;
  }, [fen]);

  const handleFlip = useCallback(() => {
    setOrientation(o => o === 'white' ? 'black' : 'white');
  }, []);

  const handleReset = useCallback(() => {
    setFen(STARTING_FEN);
    setLastMove(null);
    setMoveHistory([]);
    setArrows([]);
    setOverlays([]);
  }, []);

  const handleSetPosition = useCallback((newFen: string) => {
    setFen(newFen);
    setLastMove(null);
    setMoveHistory([]);
    setArrows([]);
  }, []);

  const addDemoArrows = useCallback(() => {
    setArrows([
      { startSquare: 'e2', endSquare: 'e4', color: 'rgba(231, 149, 35, 0.85)' },
      { startSquare: 'd2', endSquare: 'd4', color: 'rgba(74, 222, 128, 0.85)' },
      { startSquare: 'g1', endSquare: 'f3', color: 'rgba(239, 68, 68, 0.85)' },
    ]);
  }, []);

  const badge = showBadge && lastMove ? {
    square: lastMove.to as any,
    icon: 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#85C4AF" stroke="white" stroke-width="2"/><text x="20" y="26" text-anchor="middle" fill="white" font-size="18" font-weight="bold">✓</text></svg>`),
    label: 'Best Move',
  } : null;

  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
      <style>{`
        @keyframes fadeUp {
          0% { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        }
      `}</style>

      {/* Board */}
      <div style={{ width: 'min(500px, 90vw)', flexShrink: 0 }}>
        <ChessiroCanvas
          position={fen}
          orientation={orientation}
          theme={theme}
          pieceSet={{ id: 'cases', name: 'Cases', path: '/pieces/cases' }}
          interactive={interactive}
          allowDragging={allowDrag}
          allowDrawingArrows={allowArrows}
          showMargin={showMargin}
          showNotation={showNotation}
          showAnimations={showAnimations}
          animationDurationMs={animDuration}
          dests={dests}
          lastMove={lastMove}
          arrows={arrows}
          onArrowsChange={setArrows}
          onMove={handleMove}
          onFlipBoard={handleFlip}
          moveQualityBadge={badge}
          overlays={overlays}
        />

        {/* Status bar */}
        <div style={{ marginTop: 8, fontSize: 12, color: '#888', fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {fen}
        </div>
        {moveHistory.length > 0 && (
          <div style={{ marginTop: 4, fontSize: 12, color: '#aaa' }}>
            Moves: {moveHistory.join(' ')}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 240 }}>
        <Section title="Positions">
          {POSITIONS.map(p => (
            <Btn key={p.fen} onClick={() => handleSetPosition(p.fen)} active={fen === p.fen}>
              {p.name}
            </Btn>
          ))}
        </Section>

        <Section title="Themes">
          {THEMES.map((t, i) => (
            <Btn key={t.id} onClick={() => setThemeIdx(i)} active={themeIdx === i}>
              <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                <span style={{ width: 14, height: 14, borderRadius: 3, background: t.darkSquare, border: '1px solid rgba(255,255,255,0.2)' }} />
                <span style={{ width: 14, height: 14, borderRadius: 3, background: t.lightSquare, border: '1px solid rgba(255,255,255,0.2)' }} />
                {t.name}
              </span>
            </Btn>
          ))}
        </Section>

        <Section title="Board">
          <Btn onClick={handleFlip}>Flip Board (F)</Btn>
          <Btn onClick={handleReset}>Reset</Btn>
          <Toggle label="Margin" value={showMargin} onChange={setShowMargin} />
          <Toggle label="Notation" value={showNotation} onChange={setShowNotation} />
          <Toggle label="Animations" value={showAnimations} onChange={setShowAnimations} />
          <Toggle label="Interactive" value={interactive} onChange={setInteractive} />
          <Toggle label="Drag & Drop" value={allowDrag} onChange={setAllowDrag} />
          <Toggle label="Draw Arrows" value={allowArrows} onChange={setAllowArrows} />
          <Toggle label="Move Badge" value={showBadge} onChange={setShowBadge} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ color: '#999' }}>Speed</span>
            <input
              type="range"
              min={50}
              max={500}
              step={50}
              value={animDuration}
              onChange={e => setAnimDuration(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ color: '#ccc', minWidth: 40 }}>{animDuration}ms</span>
          </div>
        </Section>

        <Section title="Arrows">
          <Btn onClick={addDemoArrows}>Add Demo Arrows</Btn>
          <Btn onClick={() => setArrows([])}>Clear Arrows</Btn>
          <div style={{ fontSize: 12, color: '#777' }}>
            Right-click drag to draw arrows.
            Right-click a square to mark it.
          </div>
        </Section>

        <Section title="Features">
          <div style={{ fontSize: 12, color: '#999', lineHeight: 1.6 }}>
            <b>Click-to-move:</b> Click piece, then click destination<br />
            <b>Drag-and-drop:</b> Drag piece to destination<br />
            <b>Arrows:</b> Right-click drag between squares<br />
            <b>Marks:</b> Right-click a square<br />
            <b>Keyboard:</b> F=flip, Esc=deselect<br />
            <b>Legal moves:</b> Dots on valid squares<br />
            <b>Captures:</b> Ring on occupied squares<br />
            <b>Promotion:</b> Use the Promotion Test position<br />
            <b>Overlays:</b> Capture shows disappearing text<br />
            <b>Badge:</b> Enable "Move Badge" toggle
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#666', marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {children}
      </div>
    </div>
  );
}

function Btn({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        border: `1px solid ${active ? '#DFC29A' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 6,
        background: active ? 'rgba(223,194,154,0.15)' : 'rgba(255,255,255,0.04)',
        color: active ? '#DFC29A' : '#ccc',
        cursor: 'pointer',
        fontSize: 13,
        textAlign: 'left',
        transition: 'all 150ms',
      }}
    >
      {children}
    </button>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#ccc', cursor: 'pointer' }}>
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          background: value ? '#785E45' : 'rgba(255,255,255,0.1)',
          position: 'relative',
          transition: 'background 150ms',
          flexShrink: 0,
        }}
      >
        <div style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          background: value ? '#DFC29A' : '#666',
          position: 'absolute',
          top: 2,
          left: value ? 18 : 2,
          transition: 'left 150ms',
        }} />
      </div>
      {label}
    </label>
  );
}
