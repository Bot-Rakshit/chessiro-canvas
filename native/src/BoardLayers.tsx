import { memo, useMemo } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { DEFAULT_ARROW_BRUSHES, squareToPoint } from './core';
import type { Arrow, ArrowBrushes, BoardTheme, Orientation } from './core';
import type { NativeSquareVisuals } from './types';

// All board layers draw in pixels (not a 0..8 viewBox): sub-pixel font sizes
// and stroke widths scaled up by a viewBox render inconsistently on Android.

type Theme = BoardTheme & { lastMoveHighlight: string; selectedPiece: string };

function isSquare(s: string | null | undefined): s is string {
  return !!s && s.length === 2 && s[0] >= 'a' && s[0] <= 'h' && s[1] >= '1' && s[1] <= '8';
}

// ── Static board: squares + coordinates ────────────────────────────

interface BoardSquaresProps {
  size: number;
  orientation: Orientation;
  theme: Theme;
  showCoordinates: boolean;
}

/** 64 squares as two SVG nodes (a light backdrop and one dark path). */
export const BoardSquares = memo(function BoardSquares({ size, orientation, theme, showCoordinates }: BoardSquaresProps) {
  const s = size / 8;
  const darkPath = useMemo(() => {
    let d = '';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 1) d += `M${col * s} ${row * s}h${s}v${s}h${-s}z`;
      }
    }
    return d;
  }, [s]);

  const asWhite = orientation === 'white';
  const labels: ReactNode[] = [];
  if (showCoordinates) {
    const fs = Math.max(8, s * 0.2);
    for (let i = 0; i < 8; i++) {
      const file = 'abcdefgh'[asWhite ? i : 7 - i];
      const rank = String(asWhite ? 8 - i : i + 1);
      // Labels take the color of the opposite square so they read on both.
      const fileColor = (7 + i) % 2 === 1 ? theme.lightSquare : theme.darkSquare;
      const rankColor = i % 2 === 1 ? theme.lightSquare : theme.darkSquare;
      labels.push(
        <SvgText key={`f${i}`} x={(i + 0.95) * s} y={8 * s - s * 0.07} fontSize={fs} fontWeight="600" fill={fileColor} textAnchor="end">
          {file}
        </SvgText>,
        <SvgText key={`r${i}`} x={s * 0.05} y={i * s + fs * 1.02} fontSize={fs} fontWeight="600" fill={rankColor}>
          {rank}
        </SvgText>,
      );
    }
  }

  return (
    <Svg width={size} height={size} style={styles.layer}>
      <Rect x={0} y={0} width={size} height={size} fill={theme.lightSquare} />
      <Path d={darkPath} fill={theme.darkSquare} />
      {labels}
    </Svg>
  );
});

// ── Square overlay: highlights and move hints (under the pieces) ──

interface SquareOverlayProps {
  size: number;
  orientation: Orientation;
  theme: Theme;
  visuals: Required<NativeSquareVisuals>;
  lastMove?: { from: string; to: string } | null;
  check?: string | null;
  highlightedSquares?: Record<string, string>;
  markedSquares?: string[];
  selected: string | null;
  legal: readonly string[];
  premoveDests: readonly string[];
  premoveCurrent: readonly [string, string] | null;
  /** Squares holding a piece: hints there draw as capture rings. */
  occupied: ReadonlySet<string>;
  gradientId: string;
}

export const SquareOverlay = memo(function SquareOverlay(props: SquareOverlayProps) {
  const {
    size, orientation, theme, visuals, lastMove, check, highlightedSquares, markedSquares,
    selected, legal, premoveDests, premoveCurrent, occupied, gradientId,
  } = props;
  const s = size / 8;
  const out: ReactNode[] = [];
  const at = (sq: string) => {
    const [c, r] = squareToPoint(sq, orientation);
    return [c * s, r * s] as const;
  };
  const fill = (key: string, sq: string, color: string, opacity?: number) => {
    if (!isSquare(sq)) return;
    const [x, y] = at(sq);
    out.push(<Rect key={key} x={x} y={y} width={s} height={s} fill={color} fillOpacity={opacity} />);
  };

  if (lastMove) {
    fill('lm-f', lastMove.from, theme.lastMoveHighlight, 0.5);
    fill('lm-t', lastMove.to, theme.lastMoveHighlight, 0.5);
  }
  if (highlightedSquares) {
    for (const sq in highlightedSquares) fill(`hl-${sq}`, sq, highlightedSquares[sq]);
  }
  if (markedSquares) for (const sq of markedSquares) fill(`mk-${sq}`, sq, visuals.markOverlay);
  if (premoveCurrent) {
    fill('pc-f', premoveCurrent[0], visuals.premoveCurrent);
    fill('pc-t', premoveCurrent[1], visuals.premoveCurrent);
  }
  if (selected) fill('sel', selected, visuals.selected);
  if (isSquare(check)) {
    const [x, y] = at(check);
    out.push(<Rect key="check" x={x} y={y} width={s} height={s} fill={`url(#${gradientId})`} />);
  }

  const hint = (key: string, sq: string, dot: string, ring: string) => {
    if (!isSquare(sq)) return;
    const [x, y] = at(sq);
    if (occupied.has(sq)) {
      // Capture: an inset ring around the victim, like the web board.
      const w = Math.max(2, s * 0.05);
      if (visuals.legalCaptureRingShape === 'circle') {
        out.push(<Circle key={key} cx={x + s / 2} cy={y + s / 2} r={s / 2 - w / 2} stroke={ring} strokeWidth={w} fill="none" />);
      } else {
        const rx = s * 0.14;
        out.push(<Rect key={key} x={x + w / 2} y={y + w / 2} width={s - w} height={s - w} rx={rx} ry={rx} stroke={ring} strokeWidth={w} fill="none" />);
      }
    } else if (visuals.legalMoveStyle === 'dot') {
      out.push(<Circle key={key} cx={x + s / 2} cy={y + s / 2} r={s * 0.16} fill={dot} />);
    } else {
      // Hollow ring between 17% and 24% of the square, as on the web.
      out.push(<Circle key={key} cx={x + s / 2} cy={y + s / 2} r={s * 0.205} stroke={dot} strokeWidth={s * 0.07} fill="none" />);
    }
  };
  // Sets: move generators list a promotion square once per promotion piece.
  for (const sq of new Set(legal)) hint(`lg-${sq}`, sq, visuals.legalDot, visuals.legalCaptureRing);
  for (const sq of new Set(premoveDests)) hint(`pm-${sq}`, sq, visuals.premoveDot, visuals.premoveCaptureRing);

  if (out.length === 0) return null;
  return (
    <Svg width={size} height={size} style={styles.layer}>
      {isSquare(check) ? (
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#ff0000" stopOpacity={1} />
            <Stop offset="25%" stopColor="#e70000" stopOpacity={1} />
            <Stop offset="89%" stopColor="#a90000" stopOpacity={0} />
            <Stop offset="100%" stopColor="#9e0000" stopOpacity={0} />
          </RadialGradient>
        </Defs>
      ) : null}
      {out}
    </Svg>
  );
});

// ── Arrows (over the pieces) ───────────────────────────────────────

interface ArrowsProps {
  size: number;
  orientation: Orientation;
  arrows: readonly Arrow[];
  brushes?: Partial<ArrowBrushes>;
}

/** Same geometry as the web board and `renderBoardSvg`: L-shaped knight arrows. */
export const Arrows = memo(function Arrows({ size, orientation, arrows, brushes }: ArrowsProps) {
  const s = size / 8;
  const palette = { ...DEFAULT_ARROW_BRUSHES, ...brushes };
  const nodes: ReactNode[] = [];
  for (const a of arrows) {
    if (!isSquare(a.startSquare) || !isSquare(a.endSquare) || a.startSquare === a.endSquare) continue;
    const color = a.color || (a.brush ? palette[a.brush] : palette.green);
    const [sc, sr] = squareToPoint(a.startSquare, orientation);
    const [ec, er] = squareToPoint(a.endSquare, orientation);
    const sx = (sc + 0.5) * s;
    const sy = (sr + 0.5) * s;
    const ex = (ec + 0.5) * s;
    const ey = (er + 0.5) * s;
    const df = Math.abs(ec - sc);
    const dr = Math.abs(er - sr);
    const knight = (df === 1 && dr === 2) || (df === 2 && dr === 1);
    // Knight arrows bend: the long leg first, then the short one.
    const points: Array<[number, number]> = [[sx, sy]];
    if (knight) points.push(Math.abs(ex - sx) > Math.abs(ey - sy) ? [ex, sy] : [sx, ey]);
    const [px, py] = points[points.length - 1];
    const len = Math.hypot(ex - px, ey - py);
    const ux = (ex - px) / len;
    const uy = (ey - py) / len;
    const headLen = 0.42 * s;
    const headHalf = 0.22 * s;
    const tipX = ex - ux * 0.12 * s;
    const tipY = ey - uy * 0.12 * s;
    const baseX = tipX - ux * headLen;
    const baseY = tipY - uy * headLen;
    points.push([baseX + ux * 0.02 * s, baseY + uy * 0.02 * s]);
    const d = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join('');
    const head = `M${tipX} ${tipY}L${baseX - uy * headHalf} ${baseY + ux * headHalf}L${baseX + uy * headHalf} ${baseY - ux * headHalf}Z`;
    nodes.push(
      <G key={a.id ?? `${a.startSquare}-${a.endSquare}-${color}`} opacity={0.85}>
        <Path d={d} fill="none" stroke={color} strokeWidth={0.16 * s} strokeLinecap="round" strokeLinejoin="round" />
        <Path d={head} fill={color} />
      </G>,
    );
  }
  if (nodes.length === 0) return null;
  return (
    <Svg width={size} height={size} style={styles.layer}>
      {nodes}
    </Svg>
  );
});

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, pointerEvents: 'none' },
});
