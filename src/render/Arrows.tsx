import { memo, useMemo } from 'react';
import type { Arrow, Orientation, ArrowVisuals, ArrowHeadShape } from '../types';

interface ArrowsProps {
  arrows: Arrow[];
  orientation: Orientation;
  boardWidth: number;
  boardHeight: number;
  visuals?: Partial<ArrowVisuals>;
}

// Chessground-style normalized coordinate system:
// viewBox="-4 -4 8 8", square centers at -3.5..3.5
function pos2user(
  fileIdx: number,
  rankIdx: number,
  asWhite: boolean,
  boardWidth: number,
  boardHeight: number,
): [number, number] {
  const f = asWhite ? fileIdx : 7 - fileIdx;
  const r = asWhite ? rankIdx : 7 - rankIdx;
  const xScale = Math.min(1, boardWidth / boardHeight);
  const yScale = Math.min(1, boardHeight / boardWidth);
  return [(f - 3.5) * xScale, (3.5 - r) * yScale];
}

function squareToFileRank(sq: string): [number, number] | null {
  if (sq.length !== 2) return null;
  const f = sq.charCodeAt(0) - 97;
  const r = parseInt(sq[1]) - 1;
  if (f < 0 || f > 7 || r < 0 || r > 7) return null;
  return [f, r];
}

interface HeadPaths {
  /** Closed path used for the filled body of the arrowhead. */
  fill: string;
  /**
   * Open path for stroke passes (outline). Deliberately SKIPS the edge(s) that touch the
   * shaft-meeting vertex, so the junction between head and shaft stays visually untouched.
   */
  stroke: string;
  /** True for shapes with no fill (V-shape). */
  isOpen: boolean;
}

type Pt = [number, number];

function fmt(p: Pt): string {
  return `${p[0].toFixed(4)},${p[1].toFixed(4)}`;
}

/**
 * Builds a path for a closed polygon with rounded corners (CSS border-radius style).
 * `roundness` ∈ [0, 1]: 0 = sharp polygon; 1 = every corner rounded to the max possible radius
 * (half of the shortest adjacent edge). Uses quadratic beziers with the vertex as the control
 * point — smooth and cheap, and scales continuously from triangle to a fully-rounded blob.
 *
 * Returns both a closed `fill` path and an open `stroke` path that omits the edges touching
 * `skipIndex` (the shaft-meeting vertex), so stroke-based outlines don't cross the shaft.
 */
function buildRoundedPolygon(
  V: Pt[],
  roundness: number,
  skipIndex?: number,
): { fill: string; stroke: string } {
  const n = V.length;
  const t = Math.max(0, Math.min(1, roundness));

  const edgeLen: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = V[i];
    const b = V[(i + 1) % n];
    edgeLen.push(Math.hypot(b[0] - a[0], b[1] - a[1]));
  }

  const offset: number[] = [];
  for (let i = 0; i < n; i++) {
    const prevLen = edgeLen[(i - 1 + n) % n];
    const nextLen = edgeLen[i];
    offset.push((Math.min(prevLen, nextLen) / 2) * t);
  }

  const entries: Pt[] = [];
  const exits: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const prev = V[(i - 1 + n) % n];
    const curr = V[i];
    const next = V[(i + 1) % n];
    const r = offset[i];
    const dxP = prev[0] - curr[0], dyP = prev[1] - curr[1];
    const dxN = next[0] - curr[0], dyN = next[1] - curr[1];
    const lP = Math.hypot(dxP, dyP) || 1;
    const lN = Math.hypot(dxN, dyN) || 1;
    entries.push([curr[0] + (dxP / lP) * r, curr[1] + (dyP / lP) * r]);
    exits.push([curr[0] + (dxN / lN) * r, curr[1] + (dyN / lN) * r]);
  }

  // Closed fill path: M exits[0] L entries[1] Q V[1] exits[1] L entries[2] Q V[2] exits[2] … Z
  const fillParts: string[] = [`M${fmt(exits[0])}`];
  for (let i = 1; i <= n; i++) {
    const idx = i % n;
    fillParts.push(`L${fmt(entries[idx])}`);
    if (offset[idx] > 1e-4) {
      fillParts.push(`Q${fmt(V[idx])} ${fmt(exits[idx])}`);
    } else {
      fillParts.push(`L${fmt(V[idx])}`);
    }
  }
  fillParts.push('Z');

  // Open stroke path: traverses the non-shaft edges only. Walks the polygon starting at
  // skipIndex+1's entry and ending at (skipIndex-1+n)%n's exit, skipping the two edges that
  // touch skipIndex. Used by the outline pass so the base/shaft junction stays unstroked.
  let strokePath = '';
  if (skipIndex === undefined) {
    strokePath = fillParts.slice(0, -1).join(' ');
  } else {
    const startAfter = (skipIndex + 1) % n;
    // From exits[startAfter] through the polygon corners, stopping at entries[skipIndex] (i.e. just before the skip vertex).
    const parts: string[] = [`M${fmt(exits[startAfter])}`];
    let i = startAfter;
    while (true) {
      const nextIdx = (i + 1) % n;
      if (nextIdx === skipIndex) {
        parts.push(`L${fmt(entries[skipIndex])}`);
        break;
      }
      parts.push(`L${fmt(entries[nextIdx])}`);
      if (offset[nextIdx] > 1e-4) {
        parts.push(`Q${fmt(V[nextIdx])} ${fmt(exits[nextIdx])}`);
      } else {
        parts.push(`L${fmt(V[nextIdx])}`);
      }
      i = nextIdx;
    }
    strokePath = parts.join(' ');
  }

  return { fill: fillParts.join(' '), stroke: strokePath };
}

function computeHeadPath(
  shape: ArrowHeadShape,
  hl: number,
  hw: number,
  roundness: number,
): HeadPaths {
  const h = hw / 2;

  switch (shape) {
    case 'classic':
    default: {
      // V0 top-back, V1 tip, V2 bottom-back. Traversal V0→V1→V2 is clockwise in SVG y-down,
      // so Q with the vertex as the control point bulges each corner outward.
      const vertices: Pt[] = [[0, 0], [hl, h], [0, hw]];
      const { fill, stroke } = buildRoundedPolygon(vertices, roundness);
      return { fill, stroke, isOpen: false };
    }
    case 'open': {
      // V-shape polyline. Keep tip as a joint (linejoin handles the rounding via stroke).
      const d = `M0,0 L${hl},${h} L0,${hw}`;
      return { fill: d, stroke: d, isOpen: true };
    }
    case 'concave': {
      // Four-vertex shape with notch at (hl*0.28, h).
      const nx = hl * 0.28;
      const vertices: Pt[] = [[0, 0], [hl, h], [0, hw], [nx, h]];
      const { fill, stroke } = buildRoundedPolygon(vertices, roundness);
      return { fill, stroke, isOpen: false };
    }
    case 'diamond': {
      // Shaft enters at V0=(0,h). Round all four corners.
      const cx = hl / 2;
      const vertices: Pt[] = [[0, h], [cx, 0], [hl, h], [cx, hw]];
      const { fill, stroke } = buildRoundedPolygon(vertices, roundness);
      return { fill, stroke, isOpen: false };
    }
  }
}

function markerKey(
  prefix: string,
  color: string,
  shape: ArrowHeadShape,
  variant: string,
): string {
  const safe = color.replace(/[^a-zA-Z0-9]/g, '');
  return `cc-${prefix}-${shape}-${variant}-${safe}`;
}

export const ArrowsLayer = memo(function ArrowsLayer({
  arrows,
  orientation,
  boardWidth,
  boardHeight,
  visuals = {},
}: ArrowsProps) {
  const asWhite = orientation === 'white';

  // ── Defaults ──
  const lineWidth = visuals.lineWidth ?? 0.086;
  const margin = visuals.margin ?? 0.18;
  const startOffset = visuals.startOffset ?? 0;
  const lineOpacity = visuals.opacity ?? 0.85;
  const lineCap = visuals.lineCap ?? 'round';
  const lineJoin = visuals.lineJoin ?? 'miter';
  const dashArray = visuals.dashArray ?? visuals.dash;
  const dashOffset = visuals.dashOffset ?? 0;

  const headLength = visuals.headLength ?? visuals.markerWidth ?? 3.2;
  const headWidth = visuals.headWidth ?? visuals.markerHeight ?? 3.5;
  const headShape: ArrowHeadShape = visuals.headShape ?? 'classic';
  const headRoundness = Math.max(0, Math.min(1, visuals.headCornerRadius ?? 0));

  const outlineColor = visuals.outlineColor ?? 'rgba(0,0,0,0.45)';
  const outlineWidth = visuals.outlineWidth ?? 0;
  const hasOutline = outlineWidth > 0;

  // Marker stroke width for outline, expressed in marker units (strokeWidth-scaled).
  // Marker internal coords are in multiples of the line's strokeWidth (markerUnits default),
  // so converting board-unit outlineWidth to marker units divides by lineWidth.
  const markerOutlineWidth = hasOutline && lineWidth > 0 ? outlineWidth / lineWidth : 0;

  const headPaths = useMemo(
    () => computeHeadPath(headShape, headLength, headWidth, headRoundness),
    [headShape, headLength, headWidth, headRoundness],
  );
  const { fill: headFillPath, stroke: headStrokePath, isOpen: isOpenHead } = headPaths;

  // Marker variant key — any change to head geometry must yield a fresh marker id so browsers
  // cannot reuse a stale marker render. Rounded to 3 decimals to keep ids short + stable.
  const markerVariant = useMemo(
    () =>
      [
        headLength.toFixed(2),
        headWidth.toFixed(2),
        headRoundness.toFixed(3),
        hasOutline ? `o${outlineWidth.toFixed(3)}` : '0',
        lineJoin,
      ].join('_'),
    [headLength, headWidth, headRoundness, hasOutline, outlineWidth, lineJoin],
  );

  // Tip anchor: for closed shapes the base sits at the line end; for diamond we center along length.
  const markerRefX =
    visuals.markerRefX ?? (headShape === 'diamond' ? headLength / 2 : 0);
  const markerRefY = visuals.markerRefY ?? headWidth / 2;

  // Extra forward extent of the head past the line endpoint, in board-units.
  // Used to land the visible tip at `dest - margin`.
  const headForwardExtent = useMemo(() => {
    switch (headShape) {
      case 'diamond':
        return (headLength / 2) * lineWidth;
      case 'open':
      case 'concave':
      case 'classic':
      default:
        return headLength * lineWidth;
    }
  }, [headShape, headLength, lineWidth]);

  const uniqueColors = useMemo(() => {
    const set = new Set<string>();
    for (const a of arrows) set.add(a.color);
    return [...set];
  }, [arrows]);

  if (arrows.length === 0 || boardWidth === 0) return null;

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex: 5,
      }}
      viewBox="-4 -4 8 8"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        {uniqueColors.map((color) => {
          const mainId = markerKey('h', color, headShape, markerVariant);
          return (
            <marker
              key={mainId}
              id={mainId}
              orient="auto"
              overflow="visible"
              markerWidth={headLength}
              markerHeight={headWidth}
              refX={markerRefX}
              refY={markerRefY}
            >
              {isOpenHead ? (
                <path
                  d={headStrokePath}
                  fill="none"
                  stroke={color}
                  strokeWidth={Math.max(0.45, headWidth * 0.2)}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : (
                <>
                  {/* Outline pass (only when enabled). Traces the non-base edges so the
                      shaft-meeting base stays unstroked — junction untouched. */}
                  {hasOutline && (
                    <path
                      d={headStrokePath}
                      fill="none"
                      stroke={outlineColor}
                      strokeWidth={markerOutlineWidth}
                      strokeLinejoin={lineJoin}
                      strokeLinecap="butt"
                    />
                  )}
                  <path d={headFillPath} fill={color} />
                </>
              )}
            </marker>
          );
        })}
      </defs>

      {arrows.map((arrow, i) => {
        const fromFR = squareToFileRank(arrow.startSquare);
        const toFR = squareToFileRank(arrow.endSquare);
        if (!fromFR || !toFR) return null;

        const from = pos2user(fromFR[0], fromFR[1], asWhite, boardWidth, boardHeight);
        const to = pos2user(toFR[0], toFR[1], asWhite, boardWidth, boardHeight);

        const dx = to[0] - from[0];
        const dy = to[1] - from[1];
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return null;

        const ux = dx / dist;
        const uy = dy / dist;

        // Shaft origin: pushed forward by startOffset from source center.
        const startX = from[0] + ux * startOffset;
        const startY = from[1] + uy * startOffset;

        // Shaft end: triangle sits in front of the line, so the head tip lands at (to - margin * dir).
        const lineShorten = margin + headForwardExtent;
        const endX = to[0] - ux * lineShorten;
        const endY = to[1] - uy * lineShorten;

        const markerUrl = `url(#${markerKey('h', arrow.color, headShape, markerVariant)})`;
        const keyBase = `${arrow.startSquare}-${arrow.endSquare}-${arrow.color}-${i}`;

        return (
          <g key={keyBase} opacity={lineOpacity}>
            {hasOutline && (
              <line
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke={outlineColor}
                strokeWidth={lineWidth + outlineWidth * 2}
                strokeLinecap={lineCap}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
              />
            )}
            <line
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke={arrow.color}
              strokeWidth={lineWidth}
              strokeLinecap={lineCap}
              strokeLinejoin={lineJoin}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              markerEnd={markerUrl}
            />
          </g>
        );
      })}
    </svg>
  );
});
