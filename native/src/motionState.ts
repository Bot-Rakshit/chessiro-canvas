// Piece bookkeeping for the native board: which pieces are on screen, under
// which stable id, and which motion track each one is playing. Pure data —
// the tracks come from the shared core and are played on the UI thread by
// `PieceView`. Planning mirrors the web renderer so both boards move alike.

import {
  EASINGS,
  computeAnimPlan,
  moveDurationMs,
  planAppearTrack,
  planCaptureTrack,
  planFlipFadeTrack,
  planLandingTrack,
  planMoveTrack,
  sampleTrack,
  squareToPoint,
  staggerRank,
} from './core';
import type {
  BoardPoint,
  MotionKeyframe,
  MotionTrack,
  Orientation,
  PieceCode,
  Pieces,
  ResolvedMoveAnimation,
  Square,
} from './core';

export interface PieceEntry {
  /** Stable React key; a moving piece keeps its id from square to square. */
  id: number;
  code: PieceCode;
  /** Resting square (for an exiting piece: the square it is leaving). */
  square: Square;
  /** Motion to play, in board squares. Null = rest on `square`. */
  track: MotionTrack | null;
  /** Changes whenever `track` is replaced, restarting playback. */
  trackKey: number;
  /** When the track started (ms, `Date.now()`), used to sample interrupted flights. */
  startedAt: number;
  /** A captured piece playing its exit; removed when the track ends. */
  exiting: boolean;
}

/** Whole-layer rotation for the 'rotate' flip, sampled like a track. */
export interface SpinPlan {
  key: number;
  durationMs: number;
  offsets: number[];
  angles: number[];
}

export interface MotionState {
  placement: string;
  pieces: Pieces;
  orientation: Orientation;
  entries: PieceEntry[];
  spin: SpinPlan | null;
}

/** A move the user already carried to its square by dragging. */
export interface DropHint {
  from: string;
  to: string;
  at: number;
}

const DROP_HINT_TTL_MS = 5000;

let lastId = 0;
let lastKey = 0;
export const nextTrackKey = (): number => ++lastKey;

const codeOf = (p: { color: string; role: string }) => `${p.color}${p.role}` as PieceCode;

export function initialMotionState(placement: string, pieces: Pieces, orientation: Orientation): MotionState {
  const entries: PieceEntry[] = [];
  for (const [square, piece] of pieces) {
    entries.push({ id: ++lastId, code: codeOf(piece), square, track: null, trackKey: 0, startedAt: 0, exiting: false });
  }
  return { placement, pieces, orientation, entries, spin: null };
}

/** Where an entry is drawn right now (board squares, `orientation` space). */
export function currentPoint(e: PieceEntry, orientation: Orientation, now: number): BoardPoint {
  if (e.track) {
    const f = sampleTrack(e.track, now - e.startedAt);
    return [f.x, f.y];
  }
  return squareToPoint(e.square, orientation);
}

function withTrack(e: PieceEntry, track: MotionTrack | null, now: number, patch?: Partial<PieceEntry>): PieceEntry {
  return { ...e, ...patch, track, trackKey: track ? nextTrackKey() : e.trackKey, startedAt: now };
}

function lastFrame(t: MotionTrack): MotionKeyframe {
  return t.frames[t.frames.length - 1];
}

/**
 * Advance to a new position and/or orientation. Returns the next state with
 * tracks planned for every piece that has to move, appear or leave.
 */
export function transition(
  prev: MotionState,
  placement: string,
  pieces: Pieces,
  orientation: Orientation,
  m: ResolvedMoveAnimation,
  drop: DropHint | null,
  now: number,
): MotionState {
  const positionChanged = prev.placement !== placement;
  const flipped = prev.orientation !== orientation;
  const base: MotionState = { placement, pieces, orientation, entries: prev.entries, spin: null };
  if (!positionChanged && !flipped) return prev;

  if (!positionChanged) return planFlip(prev, base, m, now);

  const plan = computeAnimPlan(prev.pieces, pieces);
  const live = new Map<string, PieceEntry>();
  const next: PieceEntry[] = [];
  for (const e of prev.entries) {
    if (e.exiting) {
      // Exits already under way finish where they are (unless the board
      // turned or motion is off).
      if (!flipped && m.enabled) next.push(e);
    } else {
      live.set(e.square, e);
    }
  }
  const take = (sq: string, code: PieceCode): PieceEntry => {
    const e = live.get(sq);
    if (e) {
      live.delete(sq);
      return e;
    }
    return { id: ++lastId, code, square: sq as Square, track: null, trackKey: 0, startedAt: 0, exiting: false };
  };
  const at = (sq: string) => squareToPoint(sq, orientation);
  const freshDrop = drop && now - drop.at < DROP_HINT_TTL_MS ? drop : null;

  if (!m.enabled) {
    for (const mv of plan.moves) next.push({ ...take(mv.from, codeOf(mv.piece)), square: mv.to, track: null });
    for (const cap of plan.captures) live.delete(cap.square);
    for (const ap of plan.appears) next.push({ ...take('--', codeOf(ap.piece)), square: ap.square });
    for (const e of live.values()) next.push(e.track ? { ...e, track: null } : e);
    return { ...base, entries: next };
  }

  // Where a piece is on screen right now, so an interrupted flight continues
  // from its visible pose instead of jumping back to its old square.
  const origin = (sq: string): BoardPoint => {
    const e = live.get(sq);
    return e ? currentPoint(e, prev.orientation, now) : squareToPoint(sq, prev.orientation);
  };

  // Cascade order for multi-piece changes: nearest the viewer first, left to right.
  const byRank = (a: string, b: string) => {
    const [ax, ay] = at(a);
    const [bx, by] = at(b);
    return staggerRank(ax, ay) - staggerRank(bx, by);
  };
  const moves = plan.moves.length > 1 && m.stagger > 0 ? [...plan.moves].sort((a, b) => byRank(a.to, b.to)) : plan.moves;
  const appears = plan.appears.length > 1 && m.stagger > 0 ? [...plan.appears].sort((a, b) => byRank(a.square, b.square)) : plan.appears;
  const count = plan.moves.length + plan.appears.length;
  // Keep a full-board cascade under ~0.45s however many pieces take part.
  const step = count > 2 ? Math.min(m.stagger, 450 / count) : 0;

  const arrivals = new Map<string, { from: BoardPoint; to: BoardPoint; arriveMs: number }>();
  let order = 0;
  for (const mv of moves) {
    const to = at(mv.to);
    if (freshDrop && freshDrop.from === mv.from && freshDrop.to === mv.to) {
      // The user already carried this piece here; just land it.
      arrivals.set(mv.to, { from: to, to, arriveMs: 0 });
      next.push(withTrack(take(mv.from, codeOf(mv.piece)), planLandingTrack(to, m), now, { square: mv.to }));
      continue;
    }
    const from = origin(mv.from);
    const t = planMoveTrack(from, to, m, { delayMs: step * order++ });
    arrivals.set(mv.to, { from, to, arriveMs: t.delayMs + moveDurationMs(Math.hypot(to[0] - from[0], to[1] - from[1]), m) });
    next.push(withTrack(take(mv.from, codeOf(mv.piece)), t, now, { square: mv.to }));
  }

  for (const cap of plan.captures) {
    const e = take(cap.square, codeOf(cap.piece));
    // The dragged piece's origin is already empty on screen.
    if (freshDrop && cap.square === freshDrop.from) continue;
    const from = origin(cap.square);
    const pos: BoardPoint = flipped ? at(cap.square) : from;
    // The capturer is whoever lands here — or, for en passant, the nearest arrival.
    let hit = arrivals.get(cap.square);
    if (!hit) {
      let best = Infinity;
      for (const a of arrivals.values()) {
        const d = Math.hypot(a.to[0] - pos[0], a.to[1] - pos[1]);
        if (d < best && d < 1.5) {
          best = d;
          hit = a;
        }
      }
    }
    const t = planCaptureTrack(pos, m, {
      arriveMs: hit ? hit.arriveMs : m.durationMs,
      push: hit ? [hit.to[0] - hit.from[0], hit.to[1] - hit.from[1]] : undefined,
    });
    if (t) next.push(withTrack(e, t, now, { exiting: true }));
  }

  for (const ap of appears) {
    const e = take('--', codeOf(ap.piece));
    const t = planAppearTrack(at(ap.square), m, step * order++);
    next.push(t ? withTrack(e, t, now, { square: ap.square }) : { ...e, square: ap.square });
  }

  for (const e of live.values()) {
    if (!e.track) {
      next.push(e);
    } else if (flipped) {
      // Position and orientation changed together: resting pieces jump (as on the web).
      next.push({ ...e, track: null });
    } else {
      // Still in flight towards this square: let it finish. A track parked
      // elsewhere (an uncommitted `animateMove` demo) glides home instead.
      const end = lastFrame(e.track);
      const home = at(e.square);
      const off = Math.abs(end.x - home[0]) + Math.abs(end.y - home[1]) > 1e-3;
      next.push(off ? withTrack(e, planMoveTrack(currentPoint(e, orientation, now), home, m), now) : e);
    }
  }
  return { ...base, entries: next };
}

function planFlip(prev: MotionState, base: MotionState, m: ResolvedMoveAnimation, now: number): MotionState {
  const orientation = base.orientation;
  const resting = prev.entries.filter((e) => !e.exiting);
  if (!m.enabled || m.flip === 'none') {
    return { ...base, entries: resting.map((e) => (e.track ? { ...e, track: null } : e)) };
  }
  if (m.flip === 'fade') {
    const d = Math.max(220, m.durationMs);
    return { ...base, entries: resting.map((e) => withTrack(e, planFlipFadeTrack(squareToPoint(e.square, orientation), d), now)) };
  }
  // 'rotate': the new layout is the old one turned 180°, and square colors are
  // symmetric under that turn — so spinning just the piece layer back from
  // 180° reads as the whole board turning. Each piece counter-rotates on the
  // same sampled curve to stay upright.
  const durationMs = Math.max(420, m.durationMs * 2);
  const steps = 16;
  const offsets: number[] = [];
  const angles: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    offsets.push(u);
    angles.push(180 * (1 - EASINGS.smooth(u)));
  }
  const spin: SpinPlan = { key: nextTrackKey(), durationMs, offsets, angles };
  const entries = resting.map((e) => {
    const [x, y] = squareToPoint(e.square, orientation);
    const t: MotionTrack = {
      delayMs: 0,
      durationMs,
      frames: offsets.map((offset, i) => ({ offset, x, y, scaleX: 1, scaleY: 1, rotate: -angles[i], opacity: 1 })),
    };
    return withTrack(e, t, now);
  });
  return { ...base, entries, spin };
}

/** Replace the track of the resting piece on `square` (shake, demo moves). */
export function retrack(
  state: MotionState,
  square: string,
  make: (e: PieceEntry) => MotionTrack | null,
  now: number,
): MotionState {
  let changed = false;
  const entries = state.entries.map((e) => {
    if (e.exiting || e.square !== square) return e;
    const t = make(e);
    if (!t) return e;
    changed = true;
    return withTrack(e, t, now);
  });
  return changed ? { ...state, entries } : state;
}

export function removeEntry(state: MotionState, id: number): MotionState {
  const entries = state.entries.filter((e) => e.id !== id);
  return entries.length === state.entries.length ? state : { ...state, entries };
}

/** Wrong-move wiggle about the piece's resting point. */
export function shakeTrack(at: BoardPoint, delayMs: number): MotionTrack {
  const [x, y] = at;
  const kicks = [0, 0.09, -0.09, 0.07, -0.05, 0.025, 0];
  return {
    delayMs,
    durationMs: 380,
    frames: kicks.map((k, i) => ({
      offset: i / (kicks.length - 1),
      x: x + k,
      y,
      scaleX: 1,
      scaleY: 1,
      rotate: k * 40,
      opacity: 1,
    })),
  };
}
