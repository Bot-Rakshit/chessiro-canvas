import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { squareToPoint } from './core';
import type { Orientation, PieceCode, PieceColor, PromotionPiece } from './core';
import { ALL_PIECE_CODES, PieceArt } from './PieceArt';
import { lerpAt, segmentAt } from './PieceView';
import type { PieceRenderFn } from './types';

// ── Drag ghost ─────────────────────────────────────────────────────

/** Shared values the pan gesture drives on the UI thread. */
export interface DragValues {
  /** Entry id of the dragged piece, -1 when idle. */
  dragId: SharedValue<number>;
  /** Index into ALL_PIECE_CODES of the dragged piece. */
  dragCode: SharedValue<number>;
  /** Finger position, board-local px. */
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  /** 0 → 1 as the piece is picked up. */
  lift: SharedValue<number>;
  /** Screen index where a released piece is parked while the move commits. */
  dropIdx: SharedValue<number>;
  /** Screen index under the finger (-1: none / origin). */
  hoverIdx: SharedValue<number>;
  /** Snap-back playback: progress and frames (board squares). */
  snapP: SharedValue<number>;
  snapping: SharedValue<boolean>;
  snapFrames: SharedValue<{ offsets: number[]; x: number[]; y: number[] }>;
}

interface GhostArtProps {
  code: PieceCode;
  index: number;
  size: number;
  dragCode: SharedValue<number>;
  renderPiece?: PieceRenderFn;
}

// Every artwork is mounted once, stacked, and the dragged one is revealed by
// an opacity switch on the UI thread — so a lift never waits for a JS render.
const GhostArt = memo(function GhostArt({ code, index, size, dragCode, renderPiece }: GhostArtProps) {
  const style = useAnimatedStyle(() => {
    'worklet';
    return { opacity: dragCode.value === index ? 1 : 0 };
  }, [index, dragCode]);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <PieceArt code={code} size={size} renderPiece={renderPiece} />
    </Animated.View>
  );
});

interface DragGhostProps {
  size: number;
  drag: DragValues;
  dragScale: number;
  liftSquares: number;
  flipPieces: boolean;
  renderPiece?: PieceRenderFn;
}

/** The piece under the finger. Follows the gesture without touching React. */
export const DragGhost = memo(function DragGhost({ size, drag, dragScale, liftSquares, flipPieces, renderPiece }: DragGhostProps) {
  const s = size / 8;
  const { dragId, dragX, dragY, lift, dropIdx, snapP, snapping, snapFrames } = drag;
  const style = useAnimatedStyle(() => {
    'worklet';
    if (dragId.value < 0) return { opacity: 0, transform: [{ translateX: -4 * s }, { translateY: -4 * s }, { scale: 1 }] };
    const k = lift.value;
    const scale = 1 + (dragScale - 1) * k;
    let x: number;
    let y: number;
    if (snapping.value) {
      const f = snapFrames.value;
      const seg = segmentAt(snapP.value, f.offsets);
      x = lerpAt(f.x, seg) * s;
      y = lerpAt(f.y, seg) * s;
    } else if (dropIdx.value >= 0) {
      x = (dropIdx.value % 8) * s;
      y = Math.floor(dropIdx.value / 8) * s;
    } else {
      x = dragX.value - s / 2;
      y = dragY.value - s / 2 - liftSquares * s * k;
    }
    return { opacity: 1, transform: [{ translateX: x }, { translateY: y }, { scale }] };
  }, [s, dragScale, liftSquares, dragId, dragX, dragY, lift, dropIdx, snapP, snapping, snapFrames]);

  return (
    <Animated.View style={[styles.ghost, { width: s, height: s }, style]}>
      <View style={[StyleSheet.absoluteFill, flipPieces ? styles.flipped : null]}>
        {ALL_PIECE_CODES.map((code, i) => (
          <GhostArt key={code} code={code} index={i} size={s} dragCode={drag.dragCode} renderPiece={renderPiece} />
        ))}
      </View>
    </Animated.View>
  );
});

interface HoverSquareProps {
  size: number;
  hoverIdx: SharedValue<number>;
  color: string;
}

/** Tint on the square under a dragged piece; moves only when the square changes. */
export const HoverSquare = memo(function HoverSquare({ size, hoverIdx, color }: HoverSquareProps) {
  const s = size / 8;
  const style = useAnimatedStyle(() => {
    'worklet';
    const i = hoverIdx.value;
    if (i < 0) return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }] };
    return { opacity: 1, transform: [{ translateX: (i % 8) * s }, { translateY: Math.floor(i / 8) * s }] };
  }, [s, hoverIdx]);
  return <Animated.View style={[styles.cell, { width: s, height: s, backgroundColor: color }, style]} />;
});

// ── Pulse ──────────────────────────────────────────────────────────

export interface PulseSpec {
  key: number;
  square: string;
  color: string;
  durationMs: number;
  times: number;
}

export const Pulse = memo(function Pulse({ spec, size, orientation }: { spec: PulseSpec; size: number; orientation: Orientation }) {
  const s = size / 8;
  const [col, row] = squareToPoint(spec.square, orientation);
  const t = useSharedValue(0);
  useEffect(() => {
    const half = spec.durationMs / 2;
    const ease = Easing.inOut(Easing.quad);
    t.value = withRepeat(
      withSequence(withTiming(1, { duration: half, easing: ease }), withTiming(0, { duration: half, easing: ease })),
      spec.times,
      false,
    );
  }, [spec, t]);
  const style = useAnimatedStyle(() => {
    'worklet';
    return { opacity: t.value };
  }, [t]);
  return (
    <Animated.View
      style={[styles.cell, { width: s, height: s, left: col * s, top: row * s, backgroundColor: spec.color }, style]}
    />
  );
});

// ── Promotion chooser ──────────────────────────────────────────────

const PROMOTION_ORDER: PromotionPiece[] = ['q', 'n', 'r', 'b'];

interface PromotionProps {
  size: number;
  orientation: Orientation;
  square: string;
  color: PieceColor;
  renderPiece?: PieceRenderFn;
  onSelect: (piece: PromotionPiece) => void;
  onDismiss: () => void;
}

/** Chessground-style chooser: four pieces in a column over the promotion file. */
export const PromotionChooser = memo(function PromotionChooser({
  size,
  orientation,
  square,
  color,
  renderPiece,
  onSelect,
  onDismiss,
}: PromotionProps) {
  const s = size / 8;
  const [col, row] = squareToPoint(square, orientation);
  // Grow from the promotion square toward the board centre.
  const down = row < 4;
  const appear = useSharedValue(0);
  useEffect(() => {
    appear.value = withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic) });
  }, [appear]);
  const backdrop = useAnimatedStyle(() => {
    'worklet';
    return { opacity: appear.value };
  }, [appear]);
  const column = useAnimatedStyle(() => {
    'worklet';
    const k = appear.value;
    return {
      opacity: k,
      transform: [{ translateY: (down ? -1 : 1) * (1 - k) * s * 0.35 }, { scale: 0.85 + 0.15 * k }],
    };
  }, [appear, down, s]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Cancel promotion" />
      </Animated.View>
      <Animated.View
        style={[
          styles.column,
          { left: col * s, top: down ? row * s : (row - 3) * s, width: s, height: 4 * s, borderRadius: s * 0.12 },
          column,
        ]}
      >
        {(down ? PROMOTION_ORDER : [...PROMOTION_ORDER].reverse()).map((role) => (
          <Pressable
            key={role}
            onPress={() => onSelect(role)}
            accessibilityRole="button"
            accessibilityLabel={`Promote to ${ROLE_NAMES[role]}`}
            style={({ pressed }) => [styles.option, { width: s, height: s }, pressed && styles.optionPressed]}
          >
            <View style={[styles.optionDisc, { borderRadius: s / 2 }]} />
            <View style={{ transform: [{ scale: 0.86 }] }}>
              <PieceArt code={`${color}${role}` as PieceCode} size={s} renderPiece={renderPiece} />
            </View>
          </Pressable>
        ))}
      </Animated.View>
    </View>
  );
});

const ROLE_NAMES: Record<PromotionPiece, string> = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight' };

const styles = StyleSheet.create({
  ghost: { position: 'absolute', left: 0, top: 0, zIndex: 20, pointerEvents: 'none' },
  flipped: { transform: [{ rotate: '180deg' }] },
  cell: { position: 'absolute', left: 0, top: 0, pointerEvents: 'none' },
  backdrop: { backgroundColor: 'rgba(15, 18, 25, 0.35)' },
  column: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  option: { alignItems: 'center', justifyContent: 'center' },
  optionPressed: { backgroundColor: 'rgba(15, 23, 42, 0.1)' },
  optionDisc: { ...StyleSheet.absoluteFillObject, margin: '8%', backgroundColor: 'rgba(15, 23, 42, 0.06)' },
});
