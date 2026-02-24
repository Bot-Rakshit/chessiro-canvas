import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ChessiroCanvas, type BoardTheme } from 'chessiro-canvas';
import { computeDests, applyMove } from './chess-logic';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const THEMES: BoardTheme[] = [
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

const QUICK_START_CODE = `import { useState } from 'react';
import { ChessiroCanvas, INITIAL_FEN } from 'chessiro-canvas';

export function Board() {
  const [fen, setFen] = useState(INITIAL_FEN);

  return (
    <div style={{ width: 520 }}>
      <ChessiroCanvas
        position={fen}
        onMove={(from, to) => {
          // validate + apply in your game logic
          return true;
        }}
      />
    </div>
  );
}`;

const CUSTOM_PIECES_CODE = `<ChessiroCanvas
  position={fen}
  pieceSet={{
    id: 'alpha',
    name: 'Alpha',
    path: '/pieces/alpha',
  }}
/>`;

const CHESS_JS_CODE = `import { useMemo, useState } from 'react';
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
}`;

const CHESSOPS_CODE = `import { useMemo, useState } from 'react';
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
        const uci = from + to + (promotion ?? '');
        const move = parseUci(uci);
        if (!move || !pos.isLegal(move)) return false;
        const next = pos.clone();
        next.play(move);
        setPos(next);
        return true;
      }}
    />
  );
}`;

export function App() {
  const [fen, setFen] = useState(STARTING_FEN);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [themeIndex, setThemeIndex] = useState(0);
  const [showAnimations, setShowAnimations] = useState(true);
  const [showNotation, setShowNotation] = useState(true);
  const [showMargin, setShowMargin] = useState(true);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  const theme = THEMES[themeIndex];
  const dests = useMemo(() => computeDests(fen), [fen]);

  const handleMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      const nextFen = applyMove(fen, from, to, promotion);
      if (nextFen === fen) return false;
      setFen(nextFen);
      setLastMove({ from, to });
      return true;
    },
    [fen],
  );

  const resetBoard = useCallback(() => {
    setFen(STARTING_FEN);
    setLastMove(null);
  }, []);

  const copyInstallCommand = useCallback(async () => {
    try {
      await navigator.clipboard.writeText('npm i chessiro-canvas');
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1400);
    } catch {
      setCopyState('error');
      window.setTimeout(() => setCopyState('idle'), 1400);
    }
  }, []);

  return (
    <div className="docs-root">
      <div className="bg-glow bg-glow-amber" />
      <div className="bg-glow bg-glow-sky" />

      <header className="hero panel reveal">
        <p className="eyebrow">Chess UI Toolkit</p>
        <h1>chessiro-canvas Documentation</h1>
        <p className="hero-copy">
          Lightweight React chessboard focused on smooth interaction, low bundle footprint,
          and practical control for analysis and coaching interfaces.
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={copyInstallCommand}>
            {copyState === 'copied' && 'Copied'}
            {copyState === 'error' && 'Copy failed'}
            {copyState === 'idle' && 'Copy install command'}
          </button>
          <a className="btn btn-ghost" href="#quick-start">Quick Start</a>
          <a className="btn btn-ghost" href="#playground">Live Playground</a>
          <a className="btn btn-ghost" href="#integrations">Engine Integrations</a>
        </div>
        <div className="stat-strip">
          <span>14.8 KB gzip</span>
          <span>TypeScript-first API</span>
          <span>Embedded default pieces</span>
        </div>
      </header>

      <main className="docs-main">
        <section id="playground" className="panel reveal delay-1">
          <div className="section-head">
            <h2>Live Playground</h2>
            <p>Test interactions exactly as users will experience them.</p>
          </div>

          <div className="playground-grid">
            <div className="board-shell">
              <ChessiroCanvas
                position={fen}
                lastMove={lastMove}
                dests={dests}
                onMove={handleMove}
                interactive
                orientation={orientation}
                theme={theme}
                showAnimations={showAnimations}
                showNotation={showNotation}
                showMargin={showMargin}
              />
            </div>

            <div className="control-shell">
              <ControlGroup label="Theme">
                <div className="theme-grid">
                  {THEMES.map((candidate, index) => (
                    <button
                      key={candidate.id}
                      className={`chip ${themeIndex === index ? 'chip-active' : ''}`}
                      onClick={() => setThemeIndex(index)}
                    >
                      <span
                        className="swatch"
                        style={{
                          background: `linear-gradient(135deg, ${candidate.lightSquare} 0%, ${candidate.darkSquare} 100%)`,
                        }}
                      />
                      {candidate.name}
                    </button>
                  ))}
                </div>
              </ControlGroup>

              <ControlGroup label="Board">
                <div className="control-row">
                  <button className="btn btn-ghost" onClick={() => setOrientation('white')}>White</button>
                  <button className="btn btn-ghost" onClick={() => setOrientation('black')}>Black</button>
                  <button className="btn btn-ghost" onClick={resetBoard}>Reset</button>
                </div>

                <Toggle label="Animations" checked={showAnimations} onChange={setShowAnimations} />
                <Toggle label="Notation" checked={showNotation} onChange={setShowNotation} />
                <Toggle label="Margin" checked={showMargin} onChange={setShowMargin} />
              </ControlGroup>

              <div className="fen-box">
                <span>Current FEN</span>
                <code>{fen}</code>
              </div>
            </div>
          </div>
        </section>

        <section id="quick-start" className="panel reveal delay-2">
          <div className="section-head">
            <h2>Quick Start</h2>
            <p>Install and render the board in under a minute.</p>
          </div>

          <CodeBlock code="npm i chessiro-canvas" language="bash" />
          <CodeBlock code={QUICK_START_CODE} language="tsx" />

          <div className="info-box">
            Default Chessiro pieces are embedded and render automatically. No static file setup required.
          </div>
        </section>

        <section className="panel reveal delay-3">
          <div className="section-head">
            <h2>Custom Piece Sets</h2>
            <p>Override with your own hosted SVG set when needed.</p>
          </div>
          <CodeBlock code={CUSTOM_PIECES_CODE} language="tsx" />
        </section>

        <section className="panel reveal delay-4">
          <div className="section-head">
            <h2>Core Capabilities</h2>
            <p>What ships out of the box.</p>
          </div>

          <div className="feature-grid">
            <FeatureCard title="Interaction">
              Drag and click move, right-click arrows, marks, promotion chooser, and keyboard callbacks.
            </FeatureCard>
            <FeatureCard title="State Control">
              Controlled props for legal destinations, highlights, arrows, overlays, and orientation.
            </FeatureCard>
            <FeatureCard title="Performance">
              Lightweight render path, low overhead updates, and animation controls for your use case.
            </FeatureCard>
            <FeatureCard title="Styling">
              Theme and piece customization, custom renderers, and clean integration in any React app.
            </FeatureCard>
          </div>
        </section>

        <section id="integrations" className="panel reveal delay-5">
          <div className="section-head">
            <h2>Engine Integrations</h2>
            <p>Use your preferred rules engine and keep the board fully controlled.</p>
          </div>

          <h3 className="integration-heading">chess.js</h3>
          <CodeBlock language="bash" code="npm i chess.js chessiro-canvas" />
          <CodeBlock language="tsx" code={CHESS_JS_CODE} />

          <h3 className="integration-heading">chessops</h3>
          <CodeBlock language="bash" code="npm i chessops chessiro-canvas" />
          <CodeBlock language="tsx" code={CHESSOPS_CODE} />
        </section>
      </main>
    </div>
  );
}

function ControlGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="control-group">
      <h3>{label}</h3>
      {children}
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <button
        type="button"
        aria-pressed={checked}
        className={`toggle ${checked ? 'toggle-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-knob" />
      </button>
    </label>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <div className="code-block">
      <div className="code-head">{language}</div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function FeatureCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="feature-card">
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  );
}
