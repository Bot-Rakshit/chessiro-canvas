import { useState, useCallback, useMemo } from 'react';
import { ChessiroCanvas, type Arrow, type BoardTheme, type Dests, type TextOverlay } from 'chessiro-canvas';
import { computeDests, applyMove } from './chess-logic';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// A sample game: Italian Game opening (pre-computed FENs and moves)
const SAMPLE_GAME: { fen: string; lastMove: { from: string; to: string } | null }[] = [
  { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', lastMove: null },
  { fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', lastMove: { from: 'e2', to: 'e4' } },
  { fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2', lastMove: { from: 'e7', to: 'e5' } },
  { fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2', lastMove: { from: 'g1', to: 'f3' } },
  { fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', lastMove: { from: 'b8', to: 'c6' } },
  { fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3', lastMove: { from: 'f1', to: 'c4' } },
  { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', lastMove: { from: 'g8', to: 'f6' } },
  { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R b KQkq - 0 4', lastMove: { from: 'd2', to: 'd3' } },
  { fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 5', lastMove: { from: 'f8', to: 'c5' } },
  { fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R b KQkq - 2 5', lastMove: { from: 'b1', to: 'c3' } },
  { fen: 'r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQ - 3 6', lastMove: { from: 'e8', to: 'g8' } },
];

const THEMES: BoardTheme[] = [
  { id: 'chessiro', name: 'Chessiro', darkSquare: '#785E45', lightSquare: '#DFC29A', margin: '#66503B', lastMoveHighlight: '#DFAA4E', selectedPiece: '#B57340' },
  { id: 'lichess', name: 'Lichess Brown', darkSquare: '#b58863', lightSquare: '#f0d9b5', margin: '#9a7650', lastMoveHighlight: '#9bc700', selectedPiece: '#14551e' },
  { id: 'blue', name: 'Ice Blue', darkSquare: '#4682B4', lightSquare: '#B0C4DE', margin: '#34628a', lastMoveHighlight: '#6CB4EE', selectedPiece: '#2E5090' },
  { id: 'green', name: 'Forest', darkSquare: '#769656', lightSquare: '#eeeed2', margin: '#5f7a44', lastMoveHighlight: '#bbcc44', selectedPiece: '#567d2e' },
];

export function App() {
  // === Game replay state ===
  const [plyIndex, setPlyIndex] = useState(0);
  const currentGame = SAMPLE_GAME[plyIndex];

  // === Interactive play state ===
  const [playFen, setPlayFen] = useState(STARTING_FEN);
  const [playLastMove, setPlayLastMove] = useState<{ from: string; to: string } | null>(null);

  const [mode, setMode] = useState<'replay' | 'play'>('replay');
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [themeIdx, setThemeIdx] = useState(0);
  const [showMargin, setShowMargin] = useState(true);
  const [showNotation, setShowNotation] = useState(true);
  const [showAnimations, setShowAnimations] = useState(true);
  const [animDuration, setAnimDuration] = useState(200);
  const [arrows, setArrows] = useState<Arrow[]>([]);

  const theme = THEMES[themeIdx];

  // Replay navigation
  const goNext = useCallback(() => {
    setPlyIndex(i => Math.min(i + 1, SAMPLE_GAME.length - 1));
  }, []);
  const goPrev = useCallback(() => {
    setPlyIndex(i => Math.max(i - 1, 0));
  }, []);
  const goFirst = useCallback(() => { setPlyIndex(0); }, []);
  const goLast = useCallback(() => { setPlyIndex(SAMPLE_GAME.length - 1); }, []);

  // Interactive play
  const playDests = useMemo(() => computeDests(playFen), [playFen]);
  const handlePlayMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    const newFen = applyMove(playFen, from, to, promotion);
    if (newFen === playFen) return false;
    setPlayFen(newFen);
    setPlayLastMove({ from, to });
    return true;
  }, [playFen]);

  const handleFlip = useCallback(() => {
    setOrientation(o => o === 'white' ? 'black' : 'white');
  }, []);

  // Current board props based on mode
  const boardPosition = mode === 'replay' ? currentGame.fen : playFen;
  const boardLastMove = mode === 'replay' ? currentGame.lastMove : playLastMove;
  const boardDests = mode === 'replay' ? undefined : playDests;
  const boardInteractive = mode === 'play';

  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', padding: 20 }}>
      {/* Board */}
      <div style={{ width: 'min(500px, 90vw)', flexShrink: 0 }}>
        <ChessiroCanvas
          position={boardPosition}
          orientation={orientation}
          theme={theme}
          pieceSet={{ id: 'cases', name: 'Cases', path: '/pieces/cases' }}
          interactive={boardInteractive}
          allowDragging={mode === 'play'}
          allowDrawingArrows={true}
          showMargin={showMargin}
          showNotation={showNotation}
          showAnimations={showAnimations}
          animationDurationMs={animDuration}
          dests={boardDests}
          lastMove={boardLastMove}
          arrows={arrows}
          onArrowsChange={setArrows}
          onMove={mode === 'play' ? handlePlayMove : undefined}
          onFlipBoard={handleFlip}
          onPrevious={mode === 'replay' ? goPrev : undefined}
          onNext={mode === 'replay' ? goNext : undefined}
          onFirst={mode === 'replay' ? goFirst : undefined}
          onLast={mode === 'replay' ? goLast : undefined}
        />

        {/* Replay controls */}
        {mode === 'replay' && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'center' }}>
            <NavBtn onClick={goFirst} disabled={plyIndex === 0}>|&lt;</NavBtn>
            <NavBtn onClick={goPrev} disabled={plyIndex === 0}>&lt;</NavBtn>
            <span style={{ padding: '8px 16px', color: '#ccc', fontSize: 14, fontFamily: 'monospace' }}>
              {plyIndex} / {SAMPLE_GAME.length - 1}
            </span>
            <NavBtn onClick={goNext} disabled={plyIndex === SAMPLE_GAME.length - 1}>&gt;</NavBtn>
            <NavBtn onClick={goLast} disabled={plyIndex === SAMPLE_GAME.length - 1}>&gt;|</NavBtn>
          </div>
        )}

        {/* FEN display */}
        <div style={{ marginTop: 8, fontSize: 11, color: '#666', fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {boardPosition}
        </div>
        {mode === 'replay' && currentGame.lastMove && (
          <div style={{ marginTop: 2, fontSize: 11, color: '#888' }}>
            Last move: {currentGame.lastMove.from} → {currentGame.lastMove.to}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 240 }}>
        <Section title="Mode">
          <Btn onClick={() => { setMode('replay'); setPlyIndex(0); }} active={mode === 'replay'}>
            Game Replay (arrow keys)
          </Btn>
          <Btn onClick={() => { setMode('play'); setPlayFen(STARTING_FEN); setPlayLastMove(null); }} active={mode === 'play'}>
            Interactive Play
          </Btn>
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
          <Toggle label="Margin" value={showMargin} onChange={setShowMargin} />
          <Toggle label="Notation" value={showNotation} onChange={setShowNotation} />
          <Toggle label="Animations" value={showAnimations} onChange={setShowAnimations} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ color: '#999' }}>Speed</span>
            <input
              type="range" min={50} max={500} step={50}
              value={animDuration}
              onChange={e => setAnimDuration(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ color: '#ccc', minWidth: 40 }}>{animDuration}ms</span>
          </div>
        </Section>

        {mode === 'replay' && (
          <Section title="Replay Info">
            <div style={{ fontSize: 12, color: '#999', lineHeight: 1.6 }}>
              <b>Italian Game</b> (10 moves)<br />
              Use <b>arrow keys</b> or buttons to navigate.<br />
              Watch the animation direction carefully.
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function NavBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '8px 16px',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 6,
        background: disabled ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.08)',
        color: disabled ? '#444' : '#ccc',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 16,
        fontWeight: 700,
      }}
    >
      {children}
    </button>
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
          width: 36, height: 20, borderRadius: 10,
          background: value ? '#785E45' : 'rgba(255,255,255,0.1)',
          position: 'relative', transition: 'background 150ms', flexShrink: 0,
        }}
      >
        <div style={{
          width: 16, height: 16, borderRadius: 8,
          background: value ? '#DFC29A' : '#666',
          position: 'absolute', top: 2, left: value ? 18 : 2,
          transition: 'left 150ms',
        }} />
      </div>
      {label}
    </label>
  );
}
