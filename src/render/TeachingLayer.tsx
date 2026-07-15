import {
  memo,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type {
  Orientation, Pieces, PieceSet, PieceRenderer, Square,
  AnimateMoveOptions, PulseSquareOptions,
} from '../types';
import { PieceGlyph } from './PieceGlyph';

export interface TeachingLayerRef {
  animateMove: (from: string, to: string, options?: AnimateMoveOptions) => Promise<void>;
  pulseSquare: (square: string, options?: PulseSquareOptions) => Promise<void>;
  shakePiece: (square: string) => Promise<void>;
  clearEffects: () => void;
}

interface TeachingLayerProps {
  orientation: Orientation;
  pieces: Pieces;
  pieceSet?: PieceSet;
  customPieces?: PieceRenderer;
  flipPieces?: boolean;
  getPieceElement: (square: string) => HTMLDivElement | null;
}

interface DemoEntry {
  id: number;
  pieceKey: string;
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
  durationMs: number;
  liftScale: number;
  ghost: boolean;
  ghostOpacity: number;
  hiddenSquare: string | null;
}

interface PulseEntry {
  id: number;
  col: number;
  row: number;
  color: string;
  durationMs: number;
  times: number;
}

const DEFAULT_DEMO_DURATION_MS = 900;
const DEFAULT_LIFT_SCALE = 1.18;
const DEFAULT_PULSE_COLOR = 'rgba(255, 188, 66, 0.95)';
const DEFAULT_PULSE_DURATION_MS = 700;
const DEFAULT_PULSE_TIMES = 2;

function squareColRow(sq: string, asWhite: boolean): [number, number] {
  const f = sq.charCodeAt(0) - 97;
  const r = sq.charCodeAt(1) - 49;
  return [asWhite ? f : 7 - f, asWhite ? 7 - r : r];
}

function isValidSquare(sq: string): sq is Square {
  return typeof sq === 'string' && /^[a-h][1-8]$/.test(sq);
}

function canAnimate(el: Element): el is HTMLElement & { animate: Element['animate'] } {
  return typeof (el as HTMLElement).animate === 'function';
}

/**
 * Imperative teaching effects layered over the board:
 * - animateMove: slowly "picks up" a piece, glides it to a target square and
 *   sets it down — a coach demonstrating a move without a human hand.
 * - pulseSquare: attention pulse ("look at this square").
 * - shakePiece: quick head-shake on a piece ("not that one / wrong move").
 */
export const TeachingLayer = memo(forwardRef<TeachingLayerRef, TeachingLayerProps>(function TeachingLayer({
  orientation,
  pieces,
  pieceSet,
  customPieces,
  flipPieces = false,
  getPieceElement,
}, ref) {
  const asWhite = orientation === 'white';

  const [demos, setDemos] = useState<DemoEntry[]>([]);
  const [pulses, setPulses] = useState<PulseEntry[]>([]);
  const demosRef = useRef<DemoEntry[]>(demos);
  demosRef.current = demos;

  const idRef = useRef(0);
  const piecesRef = useRef(pieces);
  piecesRef.current = pieces;
  const asWhiteRef = useRef(asWhite);
  asWhiteRef.current = asWhite;

  const demoResolversRef = useRef<Map<number, () => void>>(new Map());
  const demoAnimationsRef = useRef<Map<number, Animation>>(new Map());
  const startedRef = useRef<Set<number>>(new Set());
  const finishedRef = useRef<Set<number>>(new Set());
  const getPieceElementRef = useRef(getPieceElement);
  getPieceElementRef.current = getPieceElement;

  const finishDemo = useCallback((entry: DemoEntry) => {
    if (finishedRef.current.has(entry.id)) return;
    finishedRef.current.add(entry.id);

    // Resolve first so callers can commit the real move while the demo piece
    // (fill: forwards) still covers the destination square; cleanup happens a
    // couple of frames later, avoiding a flash of the piece back at origin.
    const resolve = demoResolversRef.current.get(entry.id);
    demoResolversRef.current.delete(entry.id);
    resolve?.();

    const cleanup = () => {
      demoAnimationsRef.current.delete(entry.id);
      startedRef.current.delete(entry.id);
      finishedRef.current.delete(entry.id);
      if (entry.hiddenSquare) {
        const orig = getPieceElementRef.current(entry.hiddenSquare);
        if (orig) orig.style.opacity = '';
      }
      setDemos(prev => prev.filter(d => d.id !== entry.id));
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(cleanup));
    } else {
      cleanup();
    }
  }, []);

  const startDemoAnimation = useCallback((el: HTMLDivElement, entry: DemoEntry) => {
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);

    if (!canAnimate(el)) {
      finishDemo(entry);
      return;
    }

    const fromT = `translate(${entry.fromCol * 100}%, ${entry.fromRow * 100}%)`;
    const toT = `translate(${entry.toCol * 100}%, ${entry.toRow * 100}%)`;
    const lift = entry.liftScale;

    const glide = el.animate(
      [
        { transform: `${fromT} scale(1)` },
        { transform: `${fromT} scale(${lift})`, offset: 0.15 },
        { transform: `${toT} scale(${lift})`, offset: 0.85 },
        { transform: `${toT} scale(1)` },
      ],
      { duration: Math.max(50, entry.durationMs), easing: 'ease-in-out', fill: 'forwards' },
    );
    demoAnimationsRef.current.set(entry.id, glide);

    glide.oncancel = () => finishDemo(entry);
    glide.onfinish = () => {
      if (entry.ghost) {
        const fade = el.animate(
          [{ opacity: String(entry.ghostOpacity) }, { opacity: '0' }],
          { duration: 200, easing: 'ease-out', fill: 'forwards' },
        );
        demoAnimationsRef.current.set(entry.id, fade);
        fade.onfinish = () => finishDemo(entry);
        fade.oncancel = () => finishDemo(entry);
      } else {
        finishDemo(entry);
      }
    };
  }, [finishDemo]);

  const animateMove = useCallback((from: string, to: string, options?: AnimateMoveOptions): Promise<void> => {
    if (!isValidSquare(from) || !isValidSquare(to) || from === to) {
      return Promise.resolve();
    }

    const existing = piecesRef.current.get(from);
    const pieceKey = options?.piece
      ?? (existing ? `${existing.color}${existing.role.toUpperCase()}` : undefined);
    if (!pieceKey) return Promise.resolve();

    const ghost = options?.ghost ?? false;
    const hideOriginal = !ghost && (options?.hideOriginal ?? true) && !!existing;

    const white = asWhiteRef.current;
    const [fromCol, fromRow] = squareColRow(from, white);
    const [toCol, toRow] = squareColRow(to, white);

    const entry: DemoEntry = {
      id: ++idRef.current,
      pieceKey,
      fromCol,
      fromRow,
      toCol,
      toRow,
      durationMs: options?.durationMs ?? DEFAULT_DEMO_DURATION_MS,
      liftScale: options?.liftScale ?? DEFAULT_LIFT_SCALE,
      ghost,
      ghostOpacity: ghost ? 0.6 : 1,
      hiddenSquare: hideOriginal ? from : null,
    };

    if (entry.hiddenSquare) {
      const orig = getPieceElementRef.current(entry.hiddenSquare);
      if (orig) orig.style.opacity = '0';
    }

    return new Promise<void>((resolve) => {
      demoResolversRef.current.set(entry.id, resolve);
      setDemos(prev => [...prev, entry]);
    });
  }, []);

  const pulseSquare = useCallback((square: string, options?: PulseSquareOptions): Promise<void> => {
    if (!isValidSquare(square)) return Promise.resolve();
    const [col, row] = squareColRow(square, asWhiteRef.current);
    const entry: PulseEntry = {
      id: ++idRef.current,
      col,
      row,
      color: options?.color ?? DEFAULT_PULSE_COLOR,
      durationMs: options?.durationMs ?? DEFAULT_PULSE_DURATION_MS,
      times: Math.max(1, options?.times ?? DEFAULT_PULSE_TIMES),
    };
    return new Promise<void>((resolve) => {
      demoResolversRef.current.set(entry.id, resolve);
      setPulses(prev => [...prev, entry]);
    });
  }, []);

  const finishPulse = useCallback((id: number) => {
    startedRef.current.delete(id);
    const resolve = demoResolversRef.current.get(id);
    demoResolversRef.current.delete(id);
    setPulses(prev => prev.filter(p => p.id !== id));
    resolve?.();
  }, []);

  const startPulseAnimation = useCallback((el: HTMLDivElement, entry: PulseEntry) => {
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);

    if (!canAnimate(el)) {
      finishPulse(entry.id);
      return;
    }

    const anim = el.animate(
      [
        { opacity: '0', transform: 'scale(0.55)' },
        { opacity: '1', transform: 'scale(0.92)', offset: 0.35 },
        { opacity: '0', transform: 'scale(1.28)' },
      ],
      {
        duration: Math.max(150, entry.durationMs),
        iterations: entry.times,
        easing: 'ease-out',
      },
    );
    anim.onfinish = () => finishPulse(entry.id);
    anim.oncancel = () => finishPulse(entry.id);
  }, [finishPulse]);

  const shakePiece = useCallback((square: string): Promise<void> => {
    if (!isValidSquare(square)) return Promise.resolve();
    const outer = getPieceElementRef.current(square);
    const inner = outer?.firstElementChild;
    if (!inner || !canAnimate(inner)) return Promise.resolve();

    return new Promise<void>((resolve) => {
      const anim = inner.animate(
        [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-9%)' },
          { transform: 'translateX(9%)' },
          { transform: 'translateX(-6%)' },
          { transform: 'translateX(6%)' },
          { transform: 'translateX(-3%)' },
          { transform: 'translateX(0)' },
        ],
        { duration: 420, easing: 'ease-in-out' },
      );
      anim.onfinish = () => resolve();
      anim.oncancel = () => resolve();
    });
  }, []);

  const clearEffects = useCallback(() => {
    for (const anim of Array.from(demoAnimationsRef.current.values())) {
      anim.cancel();
    }
    for (const entry of demosRef.current) {
      if (entry.hiddenSquare) {
        const orig = getPieceElementRef.current(entry.hiddenSquare);
        if (orig) orig.style.opacity = '';
      }
    }
    const resolvers = Array.from(demoResolversRef.current.values());
    demoResolversRef.current.clear();
    demoAnimationsRef.current.clear();
    startedRef.current.clear();
    setDemos([]);
    setPulses([]);
    for (const resolve of resolvers) resolve();
  }, []);

  useImperativeHandle(ref, () => ({
    animateMove,
    pulseSquare,
    shakePiece,
    clearEffects,
  }), [animateMove, pulseSquare, shakePiece, clearEffects]);

  useEffect(() => {
    return () => {
      for (const anim of demoAnimationsRef.current.values()) {
        anim.cancel();
      }
      for (const resolve of demoResolversRef.current.values()) resolve();
      demoResolversRef.current.clear();
    };
  }, []);

  if (demos.length === 0 && pulses.length === 0) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 9 }}>
      {pulses.map((p) => (
        <div
          key={`pulse-${p.id}`}
          style={{
            position: 'absolute',
            width: '12.5%',
            height: '12.5%',
            transform: `translate(${p.col * 100}%, ${p.row * 100}%)`,
            pointerEvents: 'none',
          }}
        >
          <div
            ref={(el) => { if (el) startPulseAnimation(el as HTMLDivElement, p); }}
            style={{
              position: 'absolute',
              inset: '6%',
              borderRadius: '50%',
              border: `3px solid ${p.color}`,
              boxShadow: `0 0 12px 1px ${p.color}`,
              opacity: 0,
            }}
          />
        </div>
      ))}
      {demos.map((d) => (
        <div
          key={`demo-${d.id}`}
          ref={(el) => { if (el) startDemoAnimation(el, d); }}
          style={{
            position: 'absolute',
            width: '12.5%',
            height: '12.5%',
            transform: `translate(${d.fromCol * 100}%, ${d.fromRow * 100}%)`,
            opacity: d.ghost ? d.ghostOpacity : 1,
            willChange: 'transform',
            pointerEvents: 'none',
            filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.28))',
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              transform: flipPieces ? 'rotate(180deg)' : undefined,
              transformOrigin: 'center center',
            }}
          >
            <PieceGlyph pieceKey={d.pieceKey} pieceSet={pieceSet} customPieces={customPieces} />
          </div>
        </div>
      ))}
    </div>
  );
}));
