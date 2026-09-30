import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { squareToPoint } from './core';
import type { MotionTrack, Orientation } from './core';
import type { PieceEntry } from './motionState';
import { PieceArt } from './PieceArt';
import type { PieceRenderFn } from './types';

/** A track flattened into parallel number arrays a worklet can capture cheaply. */
export interface TrackArrays {
  offsets: number[];
  x: number[];
  y: number[];
  sx: number[];
  sy: number[];
  rot: number[];
  op: number[];
}

export function toArrays(t: MotionTrack): TrackArrays {
  const a: TrackArrays = { offsets: [], x: [], y: [], sx: [], sy: [], rot: [], op: [] };
  let last = -Infinity;
  for (const f of t.frames) {
    // Keep offsets strictly increasing so every segment has a width.
    const o = f.offset > last ? f.offset : last + 1e-6;
    last = o;
    a.offsets.push(o);
    a.x.push(f.x);
    a.y.push(f.y);
    a.sx.push(f.scaleX);
    a.sy.push(f.scaleY);
    a.rot.push(f.rotate);
    a.op.push(f.opacity);
  }
  return a;
}

/**
 * Segment of `offsets` containing `p`, and the blend factor within it.
 * One search per frame serves every channel (x, y, scale, rotate, opacity) —
 * the same linear blend `interpolate()` would do, without six searches.
 */
export function segmentAt(p: number, offsets: number[]): [number, number] {
  'worklet';
  const n = offsets.length;
  if (p <= offsets[0]) return [0, 0];
  if (p >= offsets[n - 1]) return [n - 2, 1];
  let i = 1;
  while (i < n - 1 && offsets[i] < p) i++;
  const a = offsets[i - 1];
  return [i - 1, (p - a) / (offsets[i] - a)];
}

export function lerpAt(values: number[], seg: [number, number]): number {
  'worklet';
  const i = seg[0];
  return values[i] + (values[i + 1] - values[i]) * seg[1];
}

const EMPTY: number[] = [0, 1];

interface PieceViewProps {
  entry: PieceEntry;
  orientation: Orientation;
  size: number;
  renderPiece?: PieceRenderFn;
  flipPieces: boolean;
  /** Entry id of the piece being dragged (-1: none). */
  dragId: SharedValue<number>;
  /** Screen index (row * 8 + col) where a dropped piece is parked (-1: none). */
  dropIdx: SharedValue<number>;
  originOpacity: number;
  onExitDone: (id: number) => void;
}

/**
 * One piece. Its pose is computed on the UI thread from a progress value
 * running 0 → 1 (linear) through the track's pre-eased keyframes, so springs,
 * bounces and arcs cost nothing on the JS thread. React only re-renders a
 * piece when its square, track or artwork changes.
 */
export const PieceView = memo(function PieceView({
  entry,
  orientation,
  size,
  renderPiece,
  flipPieces,
  dragId,
  dropIdx,
  originOpacity,
  onExitDone,
}: PieceViewProps) {
  const { id, track, trackKey, exiting } = entry;
  const s = size / 8;
  const [col, row] = squareToPoint(entry.square, orientation);
  const baseX = col * s;
  const baseY = row * s;
  const myIdx = row * 8 + col;

  const progress = useSharedValue(1);
  // Key of the track `progress` currently belongs to. Until the effect below
  // restarts playback, a freshly planned track renders its first frame — never
  // the stale progress of the previous track (which would flash its end pose).
  const activeKey = useSharedValue(-1);

  const arrays = useMemo(() => (track ? toArrays(track) : null), [track]);
  const hasTrack = arrays !== null;
  const offsets = arrays?.offsets ?? EMPTY;
  const xs = arrays?.x ?? EMPTY;
  const ys = arrays?.y ?? EMPTY;
  const sxs = arrays?.sx ?? EMPTY;
  const sys = arrays?.sy ?? EMPTY;
  const rots = arrays?.rot ?? EMPTY;
  const ops = arrays?.op ?? EMPTY;

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    let x = baseX;
    let y = baseY;
    let scaleX = 1;
    let scaleY = 1;
    let rotate = 0;
    let opacity = 1;
    if (hasTrack) {
      const p = activeKey.value === trackKey ? progress.value : 0;
      const seg = segmentAt(p, offsets);
      x = lerpAt(xs, seg) * s;
      y = lerpAt(ys, seg) * s;
      scaleX = lerpAt(sxs, seg);
      scaleY = lerpAt(sys, seg);
      rotate = lerpAt(rots, seg);
      opacity = lerpAt(ops, seg);
    }
    // The dragged piece leaves a faint copy on its square; once the move is
    // committed and the piece rests where it was dropped, it shows fully.
    if (dragId.value === id && dropIdx.value !== myIdx) opacity *= originOpacity;
    return {
      opacity,
      transform: [
        { translateX: x },
        { translateY: y },
        { scaleX },
        { scaleY },
        { rotate: `${rotate}deg` },
      ],
    };
  }, [hasTrack, trackKey, baseX, baseY, s, id, myIdx, originOpacity, offsets, xs, ys, sxs, sys, rots, ops, progress, activeKey, dragId, dropIdx]);

  useEffect(() => {
    if (!track) return;
    cancelAnimation(progress);
    progress.value = 0;
    activeKey.value = trackKey;
    progress.value = withDelay(
      track.delayMs,
      withTiming(1, { duration: Math.max(1, track.durationMs), easing: Easing.linear }),
    );
    // The planner stamped `startedAt` at render time; playback starts now.
    // Keep the stamp honest so interrupted flights are sampled accurately.
    entry.startedAt = Date.now();
    if (!exiting) return;
    const timer = setTimeout(() => onExitDone(id), track.delayMs + track.durationMs + 34);
    return () => clearTimeout(timer);
    // Restart only when a new track is planned.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey]);

  useEffect(() => () => cancelAnimation(progress), [progress]);

  return (
    <Animated.View
      testID={`${exiting ? 'exiting' : 'piece'}-${entry.square}`}
      style={[styles.piece, { width: s, height: s, zIndex: exiting ? 1 : track ? 3 : 2 }, animatedStyle]}
    >
      <View style={flipPieces ? styles.flipped : undefined}>
        <PieceArt code={entry.code} size={s} renderPiece={renderPiece} />
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  piece: { position: 'absolute', left: 0, top: 0, pointerEvents: 'none' },
  flipped: { transform: [{ rotate: '180deg' }] },
});
