import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ChessiroCanvas } from 'chessiro-canvas';
import { chessgroundDests } from 'chessops/compat';
import { makeFen } from 'chessops/fen';
import { parseUci } from 'chessops/util';

import { createInitialPosition } from './chess';
import {
  BOARD_ONLY_CODE,
  CHESSOPS_QUICKSTART_CODE,
  CHESS_JS_CODE,
  CUSTOM_PIECES_CODE,
  FACTS,
  PROP_GROUPS,
  REF_GROUPS,
  SECTIONS,
  SQUARE_VISUALS_CODE,
  THEMES,
  UI_VISUALS_CODE,
  type SectionId,
} from './content';
import {
  ArrowPremoveStudio,
  CinematicStudio,
  ForkTrainer,
  GuidedDrill,
  TeachingStudio,
} from './studios';
import { C, Choice, CodeBlock, Panel, Plate, Toggle, Workbench, cn } from './ui';

const REPO = 'https://github.com/Bot-Rakshit/chessiro-canvas';
const NPM = 'https://www.npmjs.com/package/chessiro-canvas';

/* ── Page furniture ───────────────────────────────────────────────── */

function Section({
  id,
  index,
  title,
  lede,
  children,
}: {
  id: SectionId;
  index: number;
  title: string;
  lede?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-10 pt-16 first:pt-0">
      <header className="mb-9">
        <div className="flex items-baseline gap-4 sm:gap-6">
          <span className="folio">{String(index).padStart(2, '0')}</span>
          <h2 className="display-2">{title}</h2>
        </div>
        {lede && <p className="lede measure mt-4">{lede}</p>}
        <hr className="rule mt-7" />
      </header>
      {children}
    </section>
  );
}

/** A titled block within a section — no card, just a rule and a label. */
function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <h3 className="display-3 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Rail({ active }: { active: SectionId }) {
  return (
    <nav aria-label="Sections" className="min-w-0">
      <ol className="lg:sticky lg:top-10 flex gap-x-5 overflow-x-auto lg:flex-col lg:gap-x-0 lg:overflow-visible">
        {SECTIONS.map((section, i) => (
          <li key={section.id} className="flex-none lg:flex-auto">
            <a
              href={`#${section.id}`}
              className={cn('nav-item whitespace-nowrap', active === section.id && 'nav-on')}
            >
              <span className="nav-num">{String(i + 1).padStart(2, '0')}</span>
              {section.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* ── Page ─────────────────────────────────────────────────────────── */

export function App() {
  const [pos, setPos] = useState(createInitialPosition);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [themeIndex, setThemeIndex] = useState(0);
  const [showAnimations, setShowAnimations] = useState(true);
  const [showNotation, setShowNotation] = useState(true);
  const [showMargin, setShowMargin] = useState(true);
  const [copied, setCopied] = useState(false);
  const [active, setActive] = useState<SectionId>('overview');

  const theme = THEMES[themeIndex];
  const fen = useMemo(() => makeFen(pos.toSetup()), [pos]);
  const dests = useMemo(() => chessgroundDests(pos), [pos]);
  const turnColor = pos.turn === 'white' ? 'w' : 'b';

  const handleMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      const move = parseUci(`${from}${to}${promotion?.toLowerCase() ?? ''}`);
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

  const copyInstall = useCallback(async () => {
    try {
      await navigator.clipboard.writeText('npm i chessiro-canvas');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible[0]) setActive(visible[0].target.id as SectionId);
      },
      { rootMargin: '-20% 0px -65% 0px' },
    );
    for (const section of SECTIONS) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative isolate">
      {/* Masthead — set like the head of a tournament bulletin. */}
      <header className="border-b border-ink">
        <div className="mx-auto max-w-[86rem] px-6 lg:px-10">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 py-5">
            <p className="eyebrow reveal" style={{ ['--i' as string]: 0 }}>
              A React chessboard library
            </p>
            <p className="eyebrow reveal flex gap-4" style={{ ['--i' as string]: 1 }}>
              <span>v0.1.42</span>
              <span aria-hidden>·</span>
              <span>MIT</span>
              <span aria-hidden>·</span>
              <a className="link" href={NPM}>npm</a>
              <a className="link" href={REPO}>GitHub</a>
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[86rem] px-6 lg:px-10">
        <div className="grid gap-x-12 lg:grid-cols-[13rem_minmax(0,1fr)]">
          {/* Rail */}
          <div className="min-w-0 border-b border-rule py-5 lg:border-b-0 lg:border-r lg:border-rule lg:py-14 lg:pr-8">
            <div className="min-w-0 lg:sticky lg:top-10">
              <p className="hidden lg:block eyebrow mb-4">Contents</p>
              <Rail active={active} />
            </div>
          </div>

          {/* Body */}
          <main className="min-w-0 py-14 lg:pl-4 pb-28">
            {/* ── Hero ── */}
            <section id="overview" className="scroll-mt-10">
              <h1
                className="display-1 reveal max-w-[24ch]"
                style={{ ['--i' as string]: 2 }}
              >
                chessiro<span style={{ color: 'var(--color-wood-2)' }}>-canvas</span>
              </h1>

              <p className="lede measure mt-6 reveal" style={{ ['--i' as string]: 3 }}>
                The interaction primitives of a serious chess interface — drag and drop,
                click-to-move, legal-move hints, arrows, premoves, promotion — as one typed
                React component with no runtime dependencies and no opinion about the rules.
              </p>

              <div
                className="mt-8 flex flex-wrap items-center gap-3 reveal"
                style={{ ['--i' as string]: 4 }}
              >
                <button onClick={copyInstall} className="btn btn-primary">
                  <code>{copied ? 'Copied' : 'npm i chessiro-canvas'}</code>
                </button>
                <a href="#start" className="btn">Getting started</a>
                <a href="#api" className="btn">API reference</a>
              </div>

              {/* Facts, set as a ruled specimen line rather than stat cards. */}
              <dl
                className="mt-12 grid grid-cols-2 border-t border-rule sm:grid-cols-4 reveal"
                style={{ ['--i' as string]: 5 }}
              >
                {FACTS.map((fact) => (
                  <div key={fact.label} className="border-b border-rule py-3.5 pr-6 sm:border-b-0">
                    <dt className="eyebrow">{fact.label}</dt>
                    <dd className="font-display text-3xl mt-1 leading-none">{fact.value}</dd>
                  </div>
                ))}
              </dl>

              <p className="note measure-wide mt-5">
                Measured against react-chessboard v5 on the same harness: 77% faster to mount,
                81% faster to update, 13% smaller gzipped. Numbers vary by machine — the harness
                lives in the repository.
              </p>
            </section>

            {/* ── Getting started ── */}
            <Section
              id="start"
              index={2}
              title="Getting started"
              lede={
                <>
                  The board is controlled: you pass a FEN, it reports intent through <C>onMove</C>,
                  and you decide what happens next. It ships no rules engine, so pair it with one.
                </>
              }
            >
              <div className="grid gap-10 lg:grid-cols-2">
                <Block title="Board only">
                  <p className="body-text measure mb-4">
                    Enough for a display board, an editor, or a puzzle you validate yourself.
                    Give the wrapper a width; the board stays square.
                  </p>
                  <div className="space-y-3">
                    <CodeBlock code="npm i chessiro-canvas" language="bash" />
                    <CodeBlock code={BOARD_ONLY_CODE} language="tsx" />
                  </div>
                </Block>

                <Block title="With a rules engine">
                  <p className="body-text measure mb-4">
                    Recommended for real gameplay. <C>chessops</C> handles legality, castling,
                    en passant and promotion, and its <C>chessgroundDests()</C> returns exactly the
                    shape <C>dests</C> expects.
                  </p>
                  <div className="space-y-3">
                    <CodeBlock code="npm i chessops chessiro-canvas" language="bash" />
                    <CodeBlock code={CHESSOPS_QUICKSTART_CODE} language="tsx" />
                  </div>
                </Block>
              </div>
            </Section>

            {/* ── Playground ── */}
            <Section
              id="playground"
              index={3}
              title="Playground"
              lede="A fully legal board, wired to chessops. Drag or click to move; right-drag to draw."
            >
              <Workbench
                board={
                  <Plate>
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
                  </Plate>
                }
                controls={
                  <>
                    <Panel title="Theme">
                      <div className="flex flex-wrap -space-x-px">
                        {THEMES.map((t, i) => (
                          <button
                            key={t.id}
                            onClick={() => setThemeIndex(i)}
                            className={cn('seg flex items-center gap-2', themeIndex === i && 'seg-on')}
                          >
                            <span
                              aria-hidden
                              className="block w-3 h-3"
                              style={{
                                background: `linear-gradient(135deg, ${t.lightSquare} 50%, ${t.darkSquare} 50%)`,
                              }}
                            />
                            {t.name}
                          </button>
                        ))}
                      </div>
                    </Panel>

                    <Panel title="Board">
                      <Choice
                        label="Orientation"
                        options={['white', 'black'] as const}
                        value={orientation}
                        onChange={setOrientation}
                      />
                      <Toggle label="Animations" checked={showAnimations} onChange={setShowAnimations} />
                      <Toggle label="Notation" checked={showNotation} onChange={setShowNotation} />
                      <Toggle label="Margin frame" checked={showMargin} onChange={setShowMargin} />
                      <button onClick={resetBoard} className="btn btn-block">Reset position</button>
                    </Panel>

                    <Panel title="Position">
                      <p className="val break-all leading-relaxed">{fen}</p>
                    </Panel>
                  </>
                }
              />
            </Section>

            {/* ── Arrows & premoves ── */}
            <Section
              id="arrows"
              index={4}
              title="Arrows & premoves"
              lede={
                <>
                  Every arrow knob is a first-class prop. Tune the look here, then copy the
                  configuration straight into your app.
                </>
              }
            >
              <ArrowPremoveStudio theme={theme} />
            </Section>

            {/* ── Teaching ── */}
            <Section
              id="teaching"
              index={5}
              title="Teaching"
              lede={
                <>
                  Coaching gestures without a coach: pick a piece up slowly and set it down,
                  preview an idea as a ghost, pulse a square to direct attention, shake a piece to
                  reject a move. All through the imperative <C>ref</C>.
                </>
              }
            >
              <TeachingStudio theme={theme} />
            </Section>

            {/* ── Drills ── */}
            <Section
              id="drills"
              index={6}
              title="Drills"
              lede={
                <>
                  Two lesson patterns built only from public API: a guided move, where
                  <C>expectedMove</C> rejects everything else, and a placement puzzle driven by
                  <C>getSquareAtPoint</C> and your own drag tray.
                </>
              }
            >
              <div className="space-y-16">
                <GuidedDrill theme={theme} />
                <hr className="rule" />
                <ForkTrainer theme={theme} />
              </div>
            </Section>

            {/* ── Cinematics ── */}
            <Section
              id="cinematics"
              index={7}
              title="Cinematics"
              lede={
                <>
                  Replay primitives for share-game screens: brilliant moves fly with 3D spins,
                  the camera zooms and shakes, sparkles and badges land on contact. Free when
                  unused — no DOM, no listeners, no animation loop while idle.
                </>
              }
            >
              <CinematicStudio theme={theme} />
            </Section>

            {/* ── Styling ── */}
            <Section
              id="styling"
              index={8}
              title="Styling"
              lede="Every layer the board draws is themable from props. Nothing needs a fork or a stylesheet override."
            >
              <div className="space-y-10">
                <Block title="Pieces">
                  <p className="body-text measure mb-4">
                    Default artwork is embedded, so nothing needs hosting. Point <C>pieceSet.path</C> at
                    your own SVGs, or render each piece yourself with <C>pieces</C>.
                  </p>
                  <CodeBlock code={CUSTOM_PIECES_CODE} language="tsx" />
                </Block>
                <Block title="Squares, legal hints and premoves">
                  <CodeBlock code={SQUARE_VISUALS_CODE} language="tsx" />
                </Block>
                <Block title="Frame, notation, promotion and overlays">
                  <CodeBlock code={UI_VISUALS_CODE} language="tsx" />
                </Block>
              </div>
            </Section>

            {/* ── API ── */}
            <Section
              id="api"
              index={9}
              title="API reference"
              lede={
                <>
                  Every prop is optional. The component forwards a <C>ChessiroCanvasRef</C> for the
                  imperative surface.
                </>
              }
            >
              <div className="space-y-12">
                <div>
                  <p className="eyebrow mb-4">Props</p>
                  <div className="space-y-9">
                    {PROP_GROUPS.map((group) => (
                      <div key={group.title}>
                        <h3 className="display-3 mb-3">{group.title}</h3>
                        <div className="overflow-x-auto">
                          <table className="table-api table-props">
                            <thead>
                              <tr>
                                <th>Prop</th>
                                <th>Type</th>
                                <th>Default</th>
                                <th>Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.rows.map((row) => (
                                <tr key={row.prop}>
                                  <td><code className="text-ink font-medium">{row.prop}</code></td>
                                  <td><code style={{ color: 'var(--color-wood)' }}>{row.type}</code></td>
                                  <td><code className="text-ink-3">{row.def}</code></td>
                                  <td>{row.notes}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="eyebrow mb-4">Imperative ref</p>
                  <div className="space-y-9">
                    {REF_GROUPS.map((group) => (
                      <div key={group.title}>
                        <h3 className="display-3 mb-3">{group.title}</h3>
                        <div className="overflow-x-auto">
                          <table className="table-api table-ref">
                            <thead>
                              <tr>
                                <th>Method</th>
                                <th>Signature</th>
                                <th>Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.rows.map((row) => (
                                <tr key={row.name}>
                                  <td><code className="text-ink font-medium">{row.name}</code></td>
                                  <td><code style={{ color: 'var(--color-wood)' }}>{row.sig}</code></td>
                                  <td>{row.notes}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="note measure-wide mt-5">
                    None of the ref methods commit a position — they are pure visuals. Update
                    <C>position</C> yourself when the returned promise resolves.
                  </p>
                </div>
              </div>
            </Section>

            {/* ── Engines ── */}
            <Section
              id="engines"
              index={10}
              title="Engines"
              lede="Bring your own rules. Both popular options drop in cleanly."
            >
              <div className="grid gap-10 lg:grid-cols-2">
                <Block title="chessops">
                  <p className="body-text measure mb-4">
                    Immutable positions and a ready-made <C>dests</C> helper. Recommended.
                  </p>
                  <CodeBlock code={CHESSOPS_QUICKSTART_CODE} language="tsx" />
                </Block>
                <Block title="chess.js">
                  <p className="body-text measure mb-4">
                    Mutates one instance in place, so derive state from <C>fen</C> — never from the
                    <C>chess</C> object reference, which never changes.
                  </p>
                  <CodeBlock code={CHESS_JS_CODE} language="tsx" />
                </Block>
              </div>
            </Section>

            {/* ── Colophon ── */}
            <footer className="mt-24 border-t border-ink pt-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
                <p className="caption">
                  chessiro-canvas is MIT licensed. Built for{' '}
                  <a className="link" href="https://chessiro.com">chessiro.com</a>, free for anyone.
                </p>
                <p className="eyebrow flex gap-4">
                  <a className="link" href={NPM}>npm</a>
                  <a className="link" href={REPO}>Source</a>
                  <a className="link" href={`${REPO}/issues`}>Issues</a>
                </p>
              </div>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
