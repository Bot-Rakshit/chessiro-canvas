import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ChessiroCanvas,
  DEFAULT_ARROW_BRUSHES,
  type ArrowVisuals,
  type ArrowHeadShape,
  type ArrowBrushes,
  type BoardTheme,
  type Arrow,
  type PieceColor,
  type SquareVisuals,
} from 'chessiro-canvas';
import { Chess } from 'chessops/chess';
import { chessgroundDests } from 'chessops/compat';
import { parseFen, makeFen } from 'chessops/fen';
import { parseUci } from 'chessops/util';
import { Copy, Check, ChevronDown, Code2, Sparkles, Zap, Layers } from 'lucide-react';

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function createInitialPosition() {
  return Chess.fromSetup(parseFen(STARTING_FEN).unwrap()).unwrap();
}

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
  { id: 'studio', label: 'Arrows & Premove Studio' },
  { id: 'quick-start', label: 'Quick Start' },
  { id: 'customization', label: 'Customization' },
  { id: 'props', label: 'Props' },
  { id: 'integrations', label: 'Integrations' },
] as const;

const BOARD_ONLY_CODE = `import { useState } from 'react';
import { ChessiroCanvas, INITIAL_FEN } from 'chessiro-canvas';

export function Board() {
  const [fen, setFen] = useState(INITIAL_FEN);

  return (
    <div style={{ width: 520 }}>
      <ChessiroCanvas
        position={fen}
        onMove={(from, to) => {
          return true;
        }}
      />
    </div>
  );
}`;

const CHESSOPS_QUICKSTART_CODE = `import { useMemo, useState } from 'react';
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

const PROMPTS = {
  board: `Build a React + TypeScript component named BoardOnly.tsx with chessiro-canvas.

Requirements:
- Use npm install command: npm i chessiro-canvas
- Render <ChessiroCanvas /> inside a container width of 520px
- Start from INITIAL_FEN and keep state in useState
- Implement onMove(from, to, promotion?) and return true
- No chess engine in this version (UI only)
- Export the component

Return only code (no explanation).`,
  chessops: `Build a React + TypeScript component named LegalBoard.tsx with chessiro-canvas + chessops.

Requirements:
- Use npm install command: npm i chessops chessiro-canvas
- Initialize chessops position from INITIAL_GAME_FEN
- Compute FEN using makeFen(pos.toSetup())
- Compute legal destinations with chessgroundDests(pos)
- In onMove: parse UCI, validate with pos.isLegal(move), then clone/play/update state
- Pass turnColor + movableColor so only side-to-move can move
- Keep code production ready and concise

Return only code (imports + component).`,
};

type PromptKey = keyof typeof PROMPTS;

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
  }}
/>`;

const UI_VISUALS_CODE = `<ChessiroCanvas
  position={fen}
  arrowVisuals={{ lineWidth: 0.2, opacity: 1 }}
  notationVisuals={{ fontFamily: 'JetBrains Mono', fontSize: '11px' }}
  promotionVisuals={{ panelColor: 'rgba(20, 24, 36, 0.98)' }}
  overlayVisuals={{ background: 'rgba(2, 6, 23, 0.85)', borderRadius: '6px' }}
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
import { ChessiroCanvas, INITIAL_GAME_FEN } from 'chessiro-canvas';

export function ChessopsBoard() {
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

const PROPS: { prop: string; type: string; defaultValue: string; notes: string }[] = [
  { prop: 'position', type: 'string', defaultValue: 'INITIAL_FEN', notes: 'FEN string for board position.' },
  { prop: 'orientation', type: "'white' | 'black'", defaultValue: "'white'", notes: 'Board orientation.' },
  { prop: 'interactive', type: 'boolean', defaultValue: 'true', notes: 'Enable move interactions.' },
  { prop: 'turnColor', type: "'w' | 'b'", defaultValue: 'undefined', notes: 'Current side to move.' },
  { prop: 'movableColor', type: "'w' | 'b' | 'both'", defaultValue: 'undefined', notes: 'Restricts movable side.' },
  { prop: 'onMove', type: '(from, to, promotion?) => boolean', defaultValue: 'undefined', notes: 'Move callback, return true to accept.' },
  { prop: 'dests', type: 'Map<Square, Square[]>', defaultValue: 'undefined', notes: 'Legal move destinations.' },
  { prop: 'lastMove', type: '{ from; to } | null', defaultValue: 'undefined', notes: 'Last move highlight.' },
  { prop: 'theme', type: 'BoardTheme', defaultValue: 'built-in', notes: 'Board color palette.' },
  { prop: 'pieceSet', type: 'PieceSet', defaultValue: 'embedded', notes: 'Custom piece set path.' },
  { prop: 'showMargin', type: 'boolean', defaultValue: 'true', notes: 'Show outer margin frame.' },
  { prop: 'showNotation', type: 'boolean', defaultValue: 'true', notes: 'Show file/rank labels.' },
  { prop: 'squareVisuals', type: 'Partial<SquareVisuals>', defaultValue: 'undefined', notes: 'Legal/premove hints, marks.' },
  { prop: 'arrowVisuals', type: 'Partial<ArrowVisuals>', defaultValue: 'undefined', notes: 'Arrow styling.' },
  { prop: 'promotionVisuals', type: 'Partial<PromotionVisuals>', defaultValue: 'undefined', notes: 'Promotion modal style.' },
  { prop: 'showAnimations', type: 'boolean', defaultValue: 'true', notes: 'Piece animation toggle.' },
  { prop: 'className', type: 'string', defaultValue: 'undefined', notes: 'Wrapper class name.' },
];

export function App() {
  const [pos, setPos] = useState(createInitialPosition);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [themeIndex, setThemeIndex] = useState(0);
  const [showAnimations, setShowAnimations] = useState(true);
  const [showNotation, setShowNotation] = useState(true);
  const [showMargin, setShowMargin] = useState(true);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [promptDropdownOpen, setPromptDropdownOpen] = useState(false);
  const [copiedPrompts, setCopiedPrompts] = useState<Record<PromptKey, 'idle' | 'copied'>>({ board: 'idle', chessops: 'idle' });
  const [activeSection, setActiveSection] = useState<(typeof SECTION_LINKS)[number]['id']>('overview');

  const theme = THEMES[themeIndex];
  const fen = useMemo(() => makeFen(pos.toSetup()), [pos]);
  const dests = useMemo(() => chessgroundDests(pos), [pos]);
  const turnColor = pos.turn === 'white' ? 'w' : 'b';

  const handleMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      const promo = promotion?.toLowerCase();
      const move = parseUci(`${from}${to}${promo ?? ''}`);
      if (!move || !pos.isLegal(move)) return false;
      const next = pos.clone();
      next.play(move);
      setPos(next);
      setLastMove({ from, to });
      return true;
    },
    [pos],
  );

  const resetBoard = useCallback(() => {
    setPos(createInitialPosition());
    setLastMove(null);
  }, []);

  const copyInstallCommand = useCallback(async () => {
    try {
      await navigator.clipboard.writeText('npm i chessiro-canvas');
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('error');
      window.setTimeout(() => setCopyState('idle'), 2000);
    }
  }, []);

  const copyPrompt = useCallback(async (key: PromptKey) => {
    try {
      await navigator.clipboard.writeText(PROMPTS[key]);
      setCopiedPrompts((prev) => ({ ...prev, [key]: 'copied' }));
      window.setTimeout(() => {
        setCopiedPrompts((prev) => ({ ...prev, [key]: 'idle' }));
        setPromptDropdownOpen(false);
      }, 1500);
    } catch {
      setCopiedPrompts((prev) => ({ ...prev, [key]: 'idle' }));
    }
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible[0]) {
          setActiveSection(visible[0].target.id as (typeof SECTION_LINKS)[number]['id']);
        }
      },
      { rootMargin: '-20% 0px -65% 0px' },
    );
    for (const section of SECTION_LINKS) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0e17] text-slate-100">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-sky-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative flex">
        <aside className="fixed left-0 top-0 w-64 h-screen border-r border-slate-800/50 bg-[#0a0e17]/80 backdrop-blur-xl p-6 flex flex-col">
          <div className="mb-8">
            <p className="text-xs font-medium text-amber-500 uppercase tracking-wider mb-1">Chess UI Toolkit</p>
            <h1 className="text-2xl font-bold text-white">chessiro-canvas</h1>
            <p className="text-sm text-slate-400 mt-1">Lightweight, controlled React chessboard</p>
          </div>

          <nav className="flex-1 space-y-1">
            {SECTION_LINKS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className={cn(
                  'block px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  activeSection === section.id
                    ? 'bg-amber-500/10 text-amber-500'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                )}
              >
                {section.label}
              </a>
            ))}
          </nav>

          <div className="flex gap-2 flex-wrap">
            <span className="px-2 py-1 rounded-md bg-slate-800/50 text-xs text-slate-400">14.8 KB</span>
            <span className="px-2 py-1 rounded-md bg-slate-800/50 text-xs text-slate-400">TypeScript</span>
            <span className="px-2 py-1 rounded-md bg-slate-800/50 text-xs text-slate-400">No deps</span>
          </div>
        </aside>

        <main className="ml-64 flex-1 p-8 max-w-4xl">
          <section id="overview" className="mb-16">
            <p className="text-amber-500 font-medium mb-2">Overview</p>
            <h2 className="text-4xl font-bold text-white mb-4">Professional chessboard UI for React</h2>
            <p className="text-slate-400 text-lg mb-6 max-w-2xl">
              High-performance canvas-based chessboard with controlled state, flexible visuals, 
              and seamless integration with chess logic libraries.
            </p>

            <div className="flex flex-wrap gap-3 mb-8">
              <button
                onClick={copyInstallCommand}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold transition-colors"
              >
                {copyState === 'copied' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copyState === 'copied' ? 'Copied!' : copyState === 'error' ? 'Failed' : 'npm i chessiro-canvas'}
              </button>
              <a href="#quick-start" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 transition-colors">
                Quick Start
              </a>
              <a href="#props" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 transition-colors">
                Props Reference
              </a>

              <div className="relative">
                <button
                  onClick={() => setPromptDropdownOpen(!promptDropdownOpen)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Copy prompt
                  <ChevronDown className={cn("w-4 h-4 transition-transform", promptDropdownOpen && "rotate-180")} />
                </button>
                {promptDropdownOpen && (
                  <div className="absolute top-full mt-2 left-0 w-56 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                    <button
                      onClick={() => copyPrompt('board')}
                      className="w-full px-4 py-3 text-left text-sm hover:bg-slate-800 flex items-center justify-between"
                    >
                      <span>Board only</span>
                      {copiedPrompts.board === 'copied' && <Check className="w-4 h-4 text-green-500" />}
                    </button>
                    <button
                      onClick={() => copyPrompt('chessops')}
                      className="w-full px-4 py-3 text-left text-sm hover:bg-slate-800 flex items-center justify-between"
                    >
                      <span>Board + chessops</span>
                      {copiedPrompts.chessops === 'copied' && <Check className="w-4 h-4 text-green-500" />}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="inline-flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Zap className="w-5 h-5 text-amber-500" />
              <span className="text-sm">
                <strong className="text-amber-500">Recommended:</strong> Pair with{' '}
                <code className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-400">chessops</code> for complete 
                legal-move validation, castling, en passant, and promotions in just 20 lines.
              </span>
            </div>
          </section>

          <section id="playground" className="mb-16">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Live Playground</h2>
              <p className="text-slate-400">Test interactions exactly as users will experience them.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="aspect-square rounded-xl overflow-hidden border border-slate-800 bg-slate-900/50">
                <ChessiroCanvas
                  position={fen}
                  lastMove={lastMove}
                  turnColor={turnColor}
                  movableColor={turnColor}
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

              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
                  <h3 className="text-sm font-medium text-slate-400 mb-3">Theme</h3>
                  <div className="flex gap-2">
                    {THEMES.map((t, i) => (
                      <button
                        key={t.id}
                        onClick={() => setThemeIndex(i)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
                          themeIndex === i
                            ? "border-amber-500 bg-amber-500/10"
                            : "border-slate-700 hover:border-slate-600"
                        )}
                      >
                        <span
                          className="w-5 h-5 rounded"
                          style={{ background: `linear-gradient(135deg, ${t.lightSquare} 50%, ${t.darkSquare} 50%)` }}
                        />
                        <span className="text-sm">{t.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
                  <h3 className="text-sm font-medium text-slate-400 mb-3">Board</h3>
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setOrientation('white')}
                      className={cn("px-3 py-1.5 rounded text-sm border", orientation === 'white' ? "border-amber-500 bg-amber-500/10" : "border-slate-700")}
                    >
                      White
                    </button>
                    <button
                      onClick={() => setOrientation('black')}
                      className={cn("px-3 py-1.5 rounded text-sm border", orientation === 'black' ? "border-amber-500 bg-amber-500/10" : "border-slate-700")}
                    >
                      Black
                    </button>
                    <button
                      onClick={resetBoard}
                      className="px-3 py-1.5 rounded text-sm border border-slate-700 hover:bg-slate-800"
                    >
                      Reset
                    </button>
                  </div>
                  <div className="space-y-3">
                    <Toggle label="Animations" checked={showAnimations} onChange={setShowAnimations} />
                    <Toggle label="Notation" checked={showNotation} onChange={setShowNotation} />
                    <Toggle label="Margin" checked={showMargin} onChange={setShowMargin} />
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
                  <span className="text-xs text-slate-500">Current FEN</span>
                  <code className="block mt-1 text-xs text-amber-400 break-all">{fen}</code>
                </div>
              </div>
            </div>
          </section>

          <section id="studio" className="mb-16">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Arrows & Premove Studio</h2>
              <p className="text-slate-400">
                Tune the default arrow look, simulate touch-drag behaviour, and try premoves. Every prop shown here is a
                first-class API — copy the JSON into your own app.
              </p>
            </div>
            <ArrowPremoveStudio theme={theme} />
          </section>

          <section id="quick-start" className="mb-16">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Quick Start</h2>
              <p className="text-slate-400">Choose your setup path.</p>
            </div>

            <div className="space-y-8">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Code2 className="w-5 h-5 text-slate-400" />
                  <h3 className="text-lg font-semibold text-white">Board only (UI scaffold)</h3>
                </div>
                <CodeBlock code="npm i chessiro-canvas" language="bash" />
                <CodeBlock code={BOARD_ONLY_CODE} language="tsx" />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="w-5 h-5 text-amber-500" />
                  <h3 className="text-lg font-semibold text-white">Board + chessops (recommended)</h3>
                </div>
                <CodeBlock code="npm i chessops chessiro-canvas" language="bash" />
                <CodeBlock code={CHESSOPS_QUICKSTART_CODE} language="tsx" />
                <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-slate-300">
                  For production gameplay, use chessops. It prevents illegal moves and handles castling, en passant, and promotions correctly.
                </div>
              </div>
            </div>
          </section>

          <section id="customization" className="mb-16">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Customization</h2>
              <p className="text-slate-400">Customize board visuals without forking the library.</p>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-3">Custom piece set</h3>
                <CodeBlock code={CUSTOM_PIECES_CODE} language="tsx" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-3">Legal and premove indicators</h3>
                <CodeBlock code={SQUARE_VISUALS_CODE} language="tsx" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-3">Arrows, notation, promotion, overlays</h3>
                <CodeBlock code={UI_VISUALS_CODE} language="tsx" />
              </div>
            </div>
          </section>

          <section id="props" className="mb-16">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Props Reference</h2>
              <p className="text-slate-400">Complete ChessiroCanvas API.</p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/50">
                  <tr>
                    <th className="text-left p-3 font-medium text-slate-400">Prop</th>
                    <th className="text-left p-3 font-medium text-slate-400">Type</th>
                    <th className="text-left p-3 font-medium text-slate-400">Default</th>
                    <th className="text-left p-3 font-medium text-slate-400">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {PROPS.map((row) => (
                    <tr key={row.prop} className="hover:bg-slate-900/30">
                      <td className="p-3"><code className="text-amber-400">{row.prop}</code></td>
                      <td className="p-3"><code className="text-slate-300">{row.type}</code></td>
                      <td className="p-3"><code className="text-slate-500">{row.defaultValue}</code></td>
                      <td className="p-3 text-slate-400">{row.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="integrations" className="mb-16">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Engine Integrations</h2>
              <p className="text-slate-400">Use your preferred rules engine. chessops is recommended.</p>
            </div>

            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-500">Recommended</span>
                  <h3 className="text-lg font-semibold text-white">chessops</h3>
                </div>
                <CodeBlock code="npm i chessops chessiro-canvas" language="bash" />
                <CodeBlock code={CHESSOPS_CODE} language="tsx" />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-3">chess.js</h3>
                <CodeBlock code="npm i chess.js chessiro-canvas" language="bash" />
                <CodeBlock code={CHESS_JS_CODE} language="tsx" />
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

const STUDIO_FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 3';

function createStudioPos() {
  return Chess.fromSetup(parseFen(STUDIO_FEN).unwrap()).unwrap();
}

const DEFAULT_PRESET_ARROWS: Arrow[] = [
  { startSquare: 'f3', endSquare: 'e5', color: DEFAULT_ARROW_BRUSHES.green, brush: 'green' },
  { startSquare: 'c4', endSquare: 'f7', color: DEFAULT_ARROW_BRUSHES.red, brush: 'red' },
  { startSquare: 'd1', endSquare: 'h5', color: DEFAULT_ARROW_BRUSHES.blue, brush: 'blue' },
];

type PremoveMode = 'off' | 'waiting';

function ArrowPremoveStudio({ theme }: { theme: BoardTheme }) {
  const [pos, setPos] = useState(createStudioPos);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [userArrows, setUserArrows] = useState<Arrow[]>(DEFAULT_PRESET_ARROWS);

  // Arrow visual controls
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
  const [brushes, setBrushes] = useState<ArrowBrushes>({ ...DEFAULT_ARROW_BRUSHES });

  // Touch-drag controls
  const [touchDragScale, setTouchDragScale] = useState(1.9);
  const [touchDragLiftSquares, setTouchDragLiftSquares] = useState(0.6);
  const [dragScale, setDragScale] = useState(1);
  const [dragLiftSquares, setDragLiftSquares] = useState(0);

  // Premove controls
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
      lineWidth,
      opacity,
      margin,
      startOffset,
      headLength,
      headWidth,
      headShape,
      headCornerRadius,
      lineCap,
      lineJoin,
      dashArray: dashed ? dashArray : undefined,
      dashOffset: dashed ? dashOffset : undefined,
      outlineWidth,
      outlineColor,
    }),
    [lineWidth, opacity, margin, startOffset, headLength, headWidth, headShape, headCornerRadius, lineCap, lineJoin, dashed, dashArray, dashOffset, outlineWidth, outlineColor],
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
    setPos(createStudioPos());
    setLastMove(null);
    setUserArrows(DEFAULT_PRESET_ARROWS);
    setCurrentPremove(null);
  }, []);

  const resetArrowDefaults = useCallback(() => {
    setLineWidth(0.086);
    setOpacity(0.85);
    setHeadLength(3.2);
    setHeadWidth(3.5);
    setMargin(0.18);
    setStartOffset(0);
    setLineCap('round');
    setLineJoin('miter');
    setHeadShape('classic');
    setHeadCornerRadius(0);
    setDashed(false);
    setDashArray('0.22 0.16');
    setDashOffset(0);
    setOutlineWidth(0);
    setOutlineColor('rgba(0,0,0,0.45)');
    setBrushes({ ...DEFAULT_ARROW_BRUSHES });
  }, []);

  const addPresetArrows = useCallback(() => {
    setUserArrows(
      DEFAULT_PRESET_ARROWS.map((a) => ({
        ...a,
        color: a.brush ? brushes[a.brush] : a.color,
      })),
    );
  }, [brushes]);

  const snippet = useMemo(() => {
    const arrowObj: Record<string, unknown> = {
      lineWidth: round(lineWidth, 3),
      opacity: round(opacity, 2),
      margin: round(margin, 2),
      startOffset: round(startOffset, 2),
      headLength: round(headLength, 2),
      headWidth: round(headWidth, 2),
      headShape,
      lineCap,
      lineJoin,
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
  arrowVisuals={${JSON.stringify(arrowObj, null, 2).replace(/\n/g, '\n  ')}}
  arrowBrushes={${JSON.stringify(brushes, null, 2).replace(/\n/g, '\n  ')}}
  dragScale={${dragScale}}
  touchDragScale={${touchDragScale}}
  dragLiftSquares={${dragLiftSquares}}
  touchDragLiftSquares={${touchDragLiftSquares}}
/>`;
  }, [lineWidth, opacity, margin, startOffset, headLength, headWidth, headShape, headCornerRadius, lineCap, lineJoin, dashed, dashArray, dashOffset, outlineWidth, outlineColor, brushes, dragScale, touchDragScale, dragLiftSquares, touchDragLiftSquares]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
      <div className="space-y-4">
        <div className="aspect-square rounded-xl overflow-hidden border border-slate-800 bg-slate-900/50">
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
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={resetStudio} className="px-3 py-1.5 rounded text-sm border border-slate-700 hover:bg-slate-800">
            Reset board
          </button>
          <button onClick={addPresetArrows} className="px-3 py-1.5 rounded text-sm border border-slate-700 hover:bg-slate-800">
            Re-add preset arrows
          </button>
          <button onClick={() => setUserArrows([])} className="px-3 py-1.5 rounded text-sm border border-slate-700 hover:bg-slate-800">
            Clear arrows
          </button>
          <button onClick={resetArrowDefaults} className="px-3 py-1.5 rounded text-sm border border-slate-700 hover:bg-slate-800">
            Reset arrow style
          </button>
        </div>
        <div className="text-xs text-slate-500">
          Tip: right-click-drag on the board to draw more arrows. Shift/Alt/Ctrl + right-drag picks a different brush.
        </div>
      </div>

      <div className="space-y-4">
        <ControlCard title="Arrow geometry">
          <Slider label="Line width" value={lineWidth} min={0.02} max={0.25} step={0.005} onChange={setLineWidth} format={(v) => v.toFixed(3)} />
          <Slider label="Opacity" value={opacity} min={0.1} max={1} step={0.05} onChange={setOpacity} format={(v) => v.toFixed(2)} />
          <Slider label="Head length" value={headLength} min={1.5} max={6} step={0.1} onChange={setHeadLength} format={(v) => v.toFixed(1)} />
          <Slider label="Head width" value={headWidth} min={1.5} max={6} step={0.1} onChange={setHeadWidth} format={(v) => v.toFixed(1)} />
          <Slider label="Tip margin" value={margin} min={0} max={0.5} step={0.01} onChange={setMargin} format={(v) => v.toFixed(2)} />
          <Slider label="Start offset" value={startOffset} min={0} max={0.5} step={0.01} onChange={setStartOffset} format={(v) => v.toFixed(2)} />
        </ControlCard>

        <ControlCard title="Head & line style">
          <Slider
            label="Head roundness"
            value={headCornerRadius}
            min={0}
            max={1}
            step={0.02}
            onChange={setHeadCornerRadius}
            format={(v) => (v === 0 ? 'triangle' : v === 1 ? 'circle' : v.toFixed(2))}
          />
          <p className="text-xs text-slate-500">
            Morphs the arrowhead from a sharp triangle (0) into a rounded bullet/circle (1). The base edge where the shaft meets stays straight and untouched.
          </p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Head shape</span>
            <div className="flex gap-1 flex-wrap justify-end">
              {(['classic', 'open', 'concave', 'diamond'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setHeadShape(s)}
                  className={cn(
                    'px-2 py-1 rounded text-xs border',
                    headShape === s ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-slate-700 text-slate-400',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Line cap</span>
            <div className="flex gap-1">
              {(['round', 'butt', 'square'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setLineCap(c)}
                  className={cn(
                    'px-2 py-1 rounded text-xs border',
                    lineCap === c ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-slate-700 text-slate-400',
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Line join</span>
            <div className="flex gap-1">
              {(['round', 'miter', 'bevel'] as const).map((j) => (
                <button
                  key={j}
                  onClick={() => setLineJoin(j)}
                  className={cn(
                    'px-2 py-1 rounded text-xs border',
                    lineJoin === j ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-slate-700 text-slate-400',
                  )}
                >
                  {j}
                </button>
              ))}
            </div>
          </div>
        </ControlCard>

        <ControlCard title="Dashing">
          <Toggle label="Dashed shaft" checked={dashed} onChange={setDashed} />
          <label className="block">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-slate-300">Dash pattern</span>
              <code className="text-xs text-amber-400">{dashArray}</code>
            </div>
            <input
              type="text"
              value={dashArray}
              onChange={(e) => setDashArray(e.target.value)}
              disabled={!dashed}
              placeholder="0.22 0.16"
              className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-slate-200 font-mono disabled:opacity-40"
            />
          </label>
          <Slider
            label="Dash offset"
            value={dashOffset}
            min={0}
            max={1}
            step={0.02}
            onChange={setDashOffset}
            format={(v) => v.toFixed(2)}
          />
        </ControlCard>

        <ControlCard title="Outline">
          <Slider label="Outline width" value={outlineWidth} min={0} max={0.06} step={0.002} onChange={setOutlineWidth} format={(v) => v.toFixed(3)} />
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Outline color</span>
            <input
              type="color"
              value={toHex(outlineColor)}
              onChange={(e) => setOutlineColor(e.target.value)}
              className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
            />
          </div>
          <p className="text-xs text-slate-500">
            Wraps shaft and arrowhead with a crisp border for legibility on busy boards. Set to 0 to disable.
          </p>
        </ControlCard>

        <ControlCard title="Brushes">
          {(['green', 'red', 'blue', 'yellow'] as const).map((brush) => (
            <div key={brush} className="flex items-center justify-between">
              <span className="text-sm text-slate-300 capitalize">{brush}</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={toHex(brushes[brush])}
                  onChange={(e) => setBrushes((prev) => ({ ...prev, [brush]: e.target.value }))}
                  className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
                />
                <code className="text-xs text-slate-500 w-20 text-right">{toHex(brushes[brush])}</code>
              </div>
            </div>
          ))}
        </ControlCard>

        <ControlCard title="Touch-drag lift (mobile)">
          <Slider label="Touch scale" value={touchDragScale} min={1} max={2.5} step={0.05} onChange={setTouchDragScale} format={(v) => `${v.toFixed(2)}×`} />
          <Slider label="Touch lift (squares)" value={touchDragLiftSquares} min={0} max={1.5} step={0.05} onChange={setTouchDragLiftSquares} format={(v) => v.toFixed(2)} />
          <div className="border-t border-slate-800 my-2" />
          <Slider label="Mouse scale" value={dragScale} min={1} max={2} step={0.05} onChange={setDragScale} format={(v) => `${v.toFixed(2)}×`} />
          <Slider label="Mouse lift (squares)" value={dragLiftSquares} min={0} max={1} step={0.05} onChange={setDragLiftSquares} format={(v) => v.toFixed(2)} />
          <p className="text-xs text-slate-500">
            Touch values only apply when dragging via touch events. Set <code className="text-amber-400">dragScale</code> &gt; 1 to preview on desktop.
          </p>
        </ControlCard>

        <ControlCard title="Premove">
          <div className="flex gap-2">
            <button
              onClick={() => setPremoveMode('off')}
              className={cn('flex-1 px-3 py-1.5 rounded text-sm border', premoveMode === 'off' ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-slate-700 text-slate-400')}
            >
              Your turn
            </button>
            <button
              onClick={() => setPremoveMode('waiting')}
              className={cn('flex-1 px-3 py-1.5 rounded text-sm border', premoveMode === 'waiting' ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-slate-700 text-slate-400')}
            >
              Opponent thinking
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Switch to &ldquo;Opponent thinking&rdquo; to queue a premove, then back to &ldquo;Your turn&rdquo; to see it fire.
          </p>
          <Toggle label="Show premove destinations" checked={showPremoveDests} onChange={setShowPremoveDests} />
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Dest dot</span>
            <input
              type="color"
              value={toHex(premoveColor)}
              onChange={(e) => setPremoveColor(e.target.value)}
              className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Capture ring</span>
            <input
              type="color"
              value={toHex(premoveRingColor)}
              onChange={(e) => setPremoveRingColor(e.target.value)}
              className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Queued highlight</span>
            <input
              type="color"
              value={toHex(premoveCurrentColor)}
              onChange={(e) => setPremoveCurrentColor(e.target.value)}
              className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
            />
          </div>
          <div className="border-t border-slate-800 my-2" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Queued style</span>
            <div className="flex gap-1">
              {(['fill', 'dashed', 'both'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setPremoveCurrentStyle(s)}
                  className={cn(
                    'px-2 py-1 rounded text-xs border',
                    premoveCurrentStyle === s ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-slate-700 text-slate-400',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          {(premoveCurrentStyle === 'dashed' || premoveCurrentStyle === 'both') && (
            <>
              <Slider
                label="Dash border width"
                value={premoveBorderWidth}
                min={1}
                max={8}
                step={0.5}
                onChange={setPremoveBorderWidth}
                format={(v) => `${v}px`}
              />
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Dash color</span>
                <input
                  type="color"
                  value={toHex(premoveBorderColor)}
                  onChange={(e) => setPremoveBorderColor(e.target.value)}
                  className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
                />
              </div>
            </>
          )}
          <div className="text-xs text-slate-500">
            Queued: <code className="text-amber-400">{currentPremove ? `${currentPremove[0]} → ${currentPremove[1]}` : 'none'}</code>
          </div>
        </ControlCard>

        <ControlCard title="Capture ring (kill square)">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Shape</span>
            <div className="flex gap-1">
              {(['square', 'circle'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setCaptureRingShape(s)}
                  className={cn(
                    'px-2 py-1 rounded text-xs border',
                    captureRingShape === s ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-slate-700 text-slate-400',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <Slider
            label="Ring width"
            value={captureRingWidth}
            min={1}
            max={10}
            step={0.5}
            onChange={setCaptureRingWidth}
            format={(v) => `${v}px`}
          />
          {captureRingShape === 'square' && (
            <Slider
              label="Corner radius"
              value={captureRingCornerRadius}
              min={0}
              max={50}
              step={1}
              onChange={setCaptureRingCornerRadius}
              format={(v) => `${v}%`}
            />
          )}
          <p className="text-xs text-slate-500">
            The thin ring painted on squares you can capture on. Also applies to premove captures.
          </p>
        </ControlCard>
      </div>

      <div className="lg:col-span-2">
        <h3 className="text-sm font-medium text-slate-400 mb-3">Copy-paste the current config</h3>
        <CodeBlock code={snippet} language="tsx" />
      </div>
    </div>
  );
}

function ControlCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800 space-y-3">
      <h3 className="text-sm font-medium text-slate-400">{title}</h3>
      {children}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-slate-300">{label}</span>
        <code className="text-xs text-amber-400">{format ? format(value) : value}</code>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-amber-500"
      />
    </label>
  );
}

function round(v: number, digits: number) {
  const f = Math.pow(10, digits);
  return Math.round(v * f) / f;
}

function toHex(color: string): string {
  // Accept either hex or rgba()/rgb(); return a 7-char hex for <input type="color">.
  if (color.startsWith('#')) {
    if (color.length === 7) return color;
    if (color.length === 4) {
      return '#' + color.slice(1).split('').map((c) => c + c).join('');
    }
  }
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) {
    const [r, g, b] = [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
    return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
  }
  return '#000000';
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-slate-300">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative w-10 h-5 rounded-full transition-colors",
          checked ? "bg-amber-500" : "bg-slate-700"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform",
            checked && "translate-x-5"
          )}
        />
      </button>
    </label>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="rounded-lg border border-slate-800 overflow-hidden mb-3">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 border-b border-slate-800">
        <span className="text-xs text-slate-500 uppercase">{language}</span>
        <button
          onClick={copy}
          className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 bg-slate-950 overflow-x-auto">
        <code className="text-xs text-slate-300 font-mono">{code}</code>
      </pre>
    </div>
  );
}
