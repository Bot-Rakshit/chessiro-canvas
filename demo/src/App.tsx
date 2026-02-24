import { useCallback, useEffect, useMemo, useState } from 'react';
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

const SECTION_LINKS = [
  { id: 'overview', label: 'Overview' },
  { id: 'playground', label: 'Playground' },
  { id: 'quick-start', label: 'Quick Start' },
  { id: 'customization', label: 'Customization' },
  { id: 'props', label: 'Props' },
  { id: 'integrations', label: 'Integrations' },
] as const;

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

const SQUARE_VISUALS_CODE = `<ChessiroCanvas
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
/>`;

const UI_VISUALS_CODE = `<ChessiroCanvas
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

type PropRow = {
  prop: string;
  type: string;
  defaultValue: string;
  notes: string;
};

const PROPS: PropRow[] = [
  { prop: 'position', type: 'string', defaultValue: 'INITIAL_FEN', notes: 'FEN string (piece placement or full FEN).' },
  { prop: 'orientation', type: "'white' | 'black'", defaultValue: "'white'", notes: 'Board orientation.' },
  { prop: 'interactive', type: 'boolean', defaultValue: 'true', notes: 'Disables move interactions when false.' },
  { prop: 'turnColor', type: "'w' | 'b'", defaultValue: 'undefined', notes: 'Current side to move (for turn-aware behavior).' },
  { prop: 'movableColor', type: "'w' | 'b' | 'both'", defaultValue: 'undefined', notes: 'Restricts which side is movable.' },
  { prop: 'onMove', type: '(from, to, promotion?) => boolean', defaultValue: 'undefined', notes: 'Return true to accept a move.' },
  { prop: 'dests', type: 'Map<Square, Square[]>', defaultValue: 'undefined', notes: 'Legal destinations for move hints and validation.' },
  { prop: 'lastMove', type: '{ from; to } | null', defaultValue: 'undefined', notes: 'Last move highlight.' },
  { prop: 'check', type: 'string | null', defaultValue: 'undefined', notes: 'Square to highlight as king in check.' },
  { prop: 'premovable', type: 'PremoveConfig', defaultValue: 'undefined', notes: 'Enable/store premoves and callbacks.' },
  { prop: 'arrows', type: 'Arrow[]', defaultValue: '[]', notes: 'Controlled arrow list.' },
  { prop: 'onArrowsChange', type: '(arrows) => void', defaultValue: 'undefined', notes: 'Arrow update callback.' },
  { prop: 'arrowBrushes', type: 'Partial<ArrowBrushes>', defaultValue: 'default set', notes: 'Brush color overrides.' },
  { prop: 'arrowVisuals', type: 'Partial<ArrowVisuals>', defaultValue: 'undefined', notes: 'Arrow width, opacity, marker size, and margin.' },
  { prop: 'snapArrowsToValidMoves', type: 'boolean', defaultValue: 'true', notes: 'Snap arrows to queen/knight vectors.' },
  { prop: 'markedSquares', type: 'string[]', defaultValue: 'internal', notes: 'Controlled right-click marks.' },
  { prop: 'onMarkedSquaresChange', type: '(squares) => void', defaultValue: 'undefined', notes: 'Mark update callback.' },
  { prop: 'plyIndex', type: 'number', defaultValue: 'undefined', notes: 'Optional ply index for per-ply overlays.' },
  { prop: 'plyArrows', type: 'Map<number, Arrow[]>', defaultValue: 'undefined', notes: 'Controlled per-ply arrows.' },
  { prop: 'onPlyArrowsChange', type: '(ply, arrows) => void', defaultValue: 'undefined', notes: 'Per-ply arrow update callback.' },
  { prop: 'plyMarks', type: 'Map<number, string[]>', defaultValue: 'undefined', notes: 'Controlled per-ply marks.' },
  { prop: 'onPlyMarksChange', type: '(ply, marks) => void', defaultValue: 'undefined', notes: 'Per-ply mark update callback.' },
  { prop: 'theme', type: 'BoardTheme', defaultValue: 'built-in', notes: 'Board palette and highlight colors.' },
  { prop: 'pieceSet', type: 'PieceSet', defaultValue: 'embedded Chessiro', notes: 'Hosted piece set path override.' },
  { prop: 'pieces', type: 'Record<string, () => ReactNode>', defaultValue: 'undefined', notes: 'Custom piece renderer map.' },
  { prop: 'showMargin', type: 'boolean', defaultValue: 'true', notes: 'Show outer board margin frame.' },
  { prop: 'marginThickness', type: 'number', defaultValue: '24', notes: 'Margin thickness in pixels.' },
  { prop: 'showNotation', type: 'boolean', defaultValue: 'true', notes: 'Show file/rank labels.' },
  { prop: 'notationVisuals', type: 'Partial<NotationVisuals>', defaultValue: 'undefined', notes: 'Notation font, color, opacity, and offsets.' },
  { prop: 'highlightedSquares', type: 'Record<string, string>', defaultValue: '{}', notes: 'Custom square background colors.' },
  { prop: 'squareVisuals', type: 'Partial<SquareVisuals>', defaultValue: 'undefined', notes: 'Legal/premove hints, mark colors, selected outline, check overlay.' },
  { prop: 'moveQualityBadge', type: 'MoveQualityBadge | null', defaultValue: 'undefined', notes: 'Badge icon/label on a square.' },
  { prop: 'allowDragging', type: 'boolean', defaultValue: 'true', notes: 'Enable drag interaction.' },
  { prop: 'allowDrawingArrows', type: 'boolean', defaultValue: 'true', notes: 'Enable right-click arrows/marks.' },
  { prop: 'showAnimations', type: 'boolean', defaultValue: 'true', notes: 'Toggle piece animations.' },
  { prop: 'animationDurationMs', type: 'number', defaultValue: '200', notes: 'Animation duration in ms.' },
  { prop: 'blockTouchScroll', type: 'boolean', defaultValue: 'false', notes: 'Prevent page scroll during touch interaction.' },
  { prop: 'overlays', type: 'TextOverlay[]', defaultValue: '[]', notes: 'Custom text overlays.' },
  { prop: 'overlayRenderer', type: '(overlay) => ReactNode', defaultValue: 'undefined', notes: 'Custom overlay renderer.' },
  { prop: 'overlayVisuals', type: 'Partial<OverlayVisuals>', defaultValue: 'undefined', notes: 'Default bubble style when overlayRenderer is not provided.' },
  { prop: 'promotionVisuals', type: 'Partial<PromotionVisuals>', defaultValue: 'undefined', notes: 'Promotion modal colors, borders, radius, and text styles.' },
  { prop: 'onSquareClick', type: '(square) => void', defaultValue: 'undefined', notes: 'Square click callback.' },
  { prop: 'onClearOverlays', type: '() => void', defaultValue: 'undefined', notes: 'Called when overlays are cleared for current ply.' },
  { prop: 'onPrevious / onNext / onFirst / onLast', type: '() => void', defaultValue: 'undefined', notes: 'Keyboard navigation callbacks.' },
  { prop: 'onFlipBoard / onShowThreat / onDeselect', type: '() => void', defaultValue: 'undefined', notes: 'Additional keyboard callback hooks.' },
  { prop: 'className', type: 'string', defaultValue: 'undefined', notes: 'Wrapper class name.' },
  { prop: 'style', type: 'CSSProperties', defaultValue: 'undefined', notes: 'Wrapper inline style.' },
];

export function App() {
  const [fen, setFen] = useState(STARTING_FEN);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [themeIndex, setThemeIndex] = useState(0);
  const [showAnimations, setShowAnimations] = useState(true);
  const [showNotation, setShowNotation] = useState(true);
  const [showMargin, setShowMargin] = useState(true);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [activeSection, setActiveSection] = useState<(typeof SECTION_LINKS)[number]['id']>('overview');

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

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          setActiveSection(visible[0].target.id as (typeof SECTION_LINKS)[number]['id']);
        }
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: [0.2, 0.35, 0.6] },
    );

    for (const section of SECTION_LINKS) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="docs-root">
      <div className="bg-glow bg-glow-amber" />
      <div className="bg-glow bg-glow-sky" />

      <div className="docs-layout">
        <aside className="docs-sidebar panel">
          <div className="sidebar-brand">
            <p className="eyebrow">Chess UI Toolkit</p>
            <h1>chessiro-canvas</h1>
            <p>Lightweight, controlled React chessboard.</p>
          </div>

          <nav className="sidebar-nav" aria-label="Sections">
            {SECTION_LINKS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className={activeSection === section.id ? 'sidebar-link sidebar-link-active' : 'sidebar-link'}
              >
                {section.label}
              </a>
            ))}
          </nav>

          <div className="sidebar-meta">
            <div className="stat-chip">14.8 KB gzip</div>
            <div className="stat-chip">TypeScript-first</div>
            <div className="stat-chip">Embedded pieces</div>
          </div>
        </aside>

        <main className="docs-main">
          <section id="overview" className="panel reveal">
            <p className="eyebrow">Overview</p>
            <h2>Professional chessboard UI primitives for React</h2>
            <p className="hero-copy">
              chessiro-canvas gives you a high-performance board with controlled state,
              flexible visuals, and practical integrations for real products.
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary" onClick={copyInstallCommand}>
                {copyState === 'copied' && 'Copied'}
                {copyState === 'error' && 'Copy failed'}
                {copyState === 'idle' && 'Copy install command'}
              </button>
              <a className="btn btn-ghost" href="#quick-start">Quick Start</a>
              <a className="btn btn-ghost" href="#props">View Props</a>
            </div>
          </section>

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
                          style={{ background: `linear-gradient(135deg, ${candidate.lightSquare} 0%, ${candidate.darkSquare} 100%)` }}
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

          <section id="customization" className="panel reveal delay-3">
            <div className="section-head">
              <h2>Customization</h2>
              <p>Customize board visuals without forking the library.</p>
            </div>

            <h3 className="integration-heading">Custom piece set</h3>
            <CodeBlock code={CUSTOM_PIECES_CODE} language="tsx" />

            <h3 className="integration-heading">Legal and premove indicators</h3>
            <CodeBlock code={SQUARE_VISUALS_CODE} language="tsx" />

            <h3 className="integration-heading">Arrows, notation, promotion dialog, overlays</h3>
            <CodeBlock code={UI_VISUALS_CODE} language="tsx" />
          </section>

          <section id="props" className="panel reveal delay-4">
            <div className="section-head">
              <h2>Props Reference</h2>
              <p>Complete `ChessiroCanvas` API with defaults and practical notes.</p>
            </div>

            <div className="props-table-wrap">
              <table className="props-table">
                <thead>
                  <tr>
                    <th>Prop</th>
                    <th>Type</th>
                    <th>Default</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {PROPS.map((row) => (
                    <tr key={row.prop}>
                      <td><code>{row.prop}</code></td>
                      <td><code>{row.type}</code></td>
                      <td><code>{row.defaultValue}</code></td>
                      <td>{row.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
