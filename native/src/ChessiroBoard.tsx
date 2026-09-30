import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  DEFAULT_BOARD_THEME,
  INITIAL_FEN,
  planMoveTrack,
  planSnapBackTrack,
  pointToSquare,
  premoveDests,
  readFen,
  resolveMoveAnimation,
  squareToPoint,
} from './core';
import type { BoardPoint, PieceColor, PromotionPiece, Square } from './core';
import { Arrows, BoardSquares, SquareOverlay } from './BoardLayers';
import { initialMotionState, currentPoint, removeEntry, retrack, shakeTrack, transition } from './motionState';
import type { DropHint, MotionState } from './motionState';
import { DragGhost, HoverSquare, PromotionChooser, Pulse } from './Overlays';
import type { DragValues, PulseSpec } from './Overlays';
import { ALL_PIECE_CODES } from './PieceArt';
import { PieceView, lerpAt, segmentAt } from './PieceView';
import type { ChessiroBoardProps, ChessiroBoardRef, NativeSquareVisuals } from './types';

/** Finger travel (px) before a press on a piece becomes a drag. */
const DRAG_THRESHOLD = 6;
/** How long a dropped piece waits on its square for the position to commit. */
const PARK_TTL_MS = 5000;
const EMPTY_SQUARES: string[] = [];
const EMPTY_ARROWS: never[] = [];
const ZERO_TO_ONE = [0, 1];
const NO_ANGLE = [0, 0];

interface BoardSnapshot {
  /** Per screen index (row * 8 + col): entry id, piece-art index, draggable flag. */
  ids: number[];
  codes: number[];
  movable: boolean[];
}

const EMPTY_SNAPSHOT: BoardSnapshot = {
  ids: new Array<number>(64).fill(-1),
  codes: new Array<number>(64).fill(-1),
  movable: new Array<boolean>(64).fill(false),
};

function hexToRgba(hex: string | undefined, alpha: number, fallback: string): string {
  const clean = (hex ?? '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return fallback;
  const n = parseInt(clean, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function sameSquares(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** OS reduce-motion preference, live. */
function useReduceMotionSetting(): boolean {
  // Reanimated reads the setting synchronously at startup; the listener keeps it current.
  const initial = useReducedMotion();
  const [reduced, setReduced] = useState(initial);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => alive && setReduced(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => setReduced(v));
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}

/**
 * Chessboard for React Native. Controlled like the web `ChessiroCanvas`:
 * pass a FEN `position`, answer `onMove`, and update `position` yourself.
 * Drag, snap-back and every move animation run on the UI thread.
 */
export const ChessiroBoard = forwardRef<ChessiroBoardRef, ChessiroBoardProps>(function ChessiroBoard(props, ref) {
  const {
    position,
    orientation = 'white',
    size: sizeProp,
    interactive = true,
    turnColor,
    movableColor,
    dests,
    onMove,
    lastMove,
    check,
    autoPromoteTo,
    premovable,
    expectedMove,
    onWrongMove,
    wrongMoveFeedback = 'shake',
    arrows,
    arrowBrushes,
    highlightedSquares,
    markedSquares,
    theme: themeProp,
    showCoordinates = true,
    squareVisuals,
    flipPieces = false,
    renderPiece,
    moveAnimation,
    animationDurationMs = 200,
    showAnimations = true,
    dragScale = 1.6,
    dragLiftSquares = 0.5,
    onSquarePress,
    onPieceLift,
    onPieceDrop,
    style,
    accessibilityLabel,
    testID,
  } = props;

  // ── Geometry ──
  const [measured, setMeasured] = useState(0);
  const size = sizeProp ?? measured;
  const s = size / 8;
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      if (sizeProp !== undefined) return;
      const w = Math.floor(e.nativeEvent.layout.width);
      setMeasured((prev) => (prev === w ? prev : w));
    },
    [sizeProp],
  );

  // ── Position ──
  const placement = useMemo(() => {
    const p = (position || INITIAL_FEN).trim().split(/\s+/)[0];
    return p === 'start' ? INITIAL_FEN : p;
  }, [position]);
  const pieces = useMemo(() => readFen(placement), [placement]);
  const occupied = useMemo(() => new Set<string>(pieces.keys()), [pieces]);

  // ── Look ──
  // Keyed on the colors, not the object: themes are often inline literals,
  // and a fresh object would re-render the static board on every render.
  const { darkSquare, lightSquare, lastMoveHighlight, selectedPiece } = { ...DEFAULT_BOARD_THEME, ...themeProp };
  const theme = useMemo(
    () => ({
      ...DEFAULT_BOARD_THEME,
      darkSquare,
      lightSquare,
      lastMoveHighlight: lastMoveHighlight ?? '#DFAA4E',
      selectedPiece: selectedPiece ?? '#B57340',
    }),
    [darkSquare, lightSquare, lastMoveHighlight, selectedPiece],
  );
  // Same for arrows: re-draw only when their content changes.
  const arrowsKey = arrows?.map((a) => `${a.id ?? ''}:${a.startSquare}${a.endSquare}:${a.color}:${a.brush ?? ''}`).join('|') ?? '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableArrows = useMemo(() => arrows ?? EMPTY_ARROWS, [arrowsKey]);
  const visuals = useMemo<Required<NativeSquareVisuals>>(
    () => ({
      legalDot: 'rgba(80, 37, 19, 0.65)',
      legalMoveStyle: 'ring',
      legalCaptureRing: 'rgba(80, 37, 19, 0.8)',
      legalCaptureRingShape: 'square',
      premoveDot: 'rgba(20, 85, 30, 0.5)',
      premoveCaptureRing: 'rgba(20, 85, 30, 0.6)',
      premoveCurrent: 'rgba(20, 30, 85, 0.4)',
      markOverlay: 'rgba(235, 64, 52, 0.65)',
      selected: hexToRgba(theme.selectedPiece, 0.5, 'rgba(181, 115, 64, 0.5)'),
      dragOverHighlight: hexToRgba(theme.selectedPiece, 0.35, 'rgba(181, 115, 64, 0.35)'),
      dragOriginOpacity: 0.3,
      ...squareVisuals,
    }),
    [theme.selectedPiece, squareVisuals],
  );
  const gradientId = `cc-check-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  // ── Motion ──
  const reducedMotion = useReduceMotionSetting();
  const motion = useMemo(
    () => resolveMoveAnimation(moveAnimation, { baseDurationMs: animationDurationMs, enabled: showAnimations, reducedMotion }),
    [moveAnimation, animationDurationMs, showAnimations, reducedMotion],
  );
  const motionRef = useRef(motion);
  motionRef.current = motion;

  const dropHintRef = useRef<DropHint | null>(null);
  const [motionState, setMotionState] = useState<MotionState>(() => initialMotionState(placement, pieces, orientation));
  // Derive the next motion plan during render (React's "state from props"
  // pattern): the commit that shows a new position already carries its
  // tracks, so pieces never flash at their destination first.
  let ms = motionState;
  if (ms.placement !== placement || ms.orientation !== orientation) {
    ms = transition(ms, placement, pieces, orientation, motion, dropHintRef.current, Date.now());
    setMotionState(ms);
  }
  const onExitDone = useCallback((id: number) => setMotionState((st) => removeEntry(st, id)), []);

  // ── UI-thread state ──
  const dragId = useSharedValue(-1);
  const dragCode = useSharedValue(-1);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const lift = useSharedValue(0);
  const dropIdx = useSharedValue(-1);
  const hoverIdx = useSharedValue(-1);
  const snapP = useSharedValue(0);
  const snapping = useSharedValue(false);
  const snapFrames = useSharedValue({ offsets: ZERO_TO_ONE, x: ZERO_TO_ONE, y: ZERO_TO_ONE });
  const drag = useMemo<DragValues>(
    () => ({ dragId, dragCode, dragX, dragY, lift, dropIdx, hoverIdx, snapP, snapping, snapFrames }),
    [dragId, dragCode, dragX, dragY, lift, dropIdx, hoverIdx, snapP, snapping, snapFrames],
  );
  // Gesture-side view of the board, so a press resolves to a piece without a JS round trip.
  const snapshot = useSharedValue<BoardSnapshot>(EMPTY_SNAPSHOT);
  // Gesture bookkeeping (UI thread only).
  const candidate = useSharedValue(-1);
  const dragging = useSharedValue(false);
  const leftOrigin = useSharedValue(false);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const parkedRef = useRef(false);
  const parkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapUntilRef = useRef(0);
  const promoDragRef = useRef<{ from: string; to: string; toIdx: number } | null>(null);

  // ── Selection state (JS) ──
  const [selected, setSelected] = useState<string | null>(null);
  const [legal, setLegal] = useState<string[]>(EMPTY_SQUARES);
  const [premoveSquares, setPremoveSquares] = useState<string[]>(EMPTY_SQUARES);
  const [premoveCurrent, setPremoveCurrent] = useState<[string, string] | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string; color: PieceColor } | null>(null);
  const [pulses, setPulses] = useState<PulseSpec[]>([]);
  const pulseKeyRef = useRef(0);

  const freeMode = turnColor === undefined && movableColor === undefined;
  const canMoveColor = useCallback(
    (color: PieceColor): boolean => {
      if (freeMode) return true;
      const effective = movableColor ?? turnColor ?? 'w';
      if (effective === 'both') return true;
      return color === effective && (turnColor === undefined || color === turnColor);
    },
    [freeMode, movableColor, turnColor],
  );
  const canPremoveColor = useCallback(
    (color: PieceColor): boolean => {
      if (freeMode || !premovable?.enabled) return false;
      const effective = movableColor ?? turnColor ?? 'w';
      if (effective === 'both') return false;
      return color === effective && turnColor !== undefined && color !== turnColor;
    },
    [freeMode, movableColor, turnColor, premovable?.enabled],
  );

  // Publish which squares can be picked up, keyed by screen index.
  useEffect(() => {
    const ids = new Array<number>(64).fill(-1);
    const codes = new Array<number>(64).fill(-1);
    const movable = new Array<boolean>(64).fill(false);
    for (const e of ms.entries) {
      if (e.exiting) continue;
      const [c, r] = squareToPoint(e.square, orientation);
      const i = r * 8 + c;
      ids[i] = e.id;
      codes[i] = ALL_PIECE_CODES.indexOf(e.code);
      const color = e.code[0] as PieceColor;
      movable[i] = interactive && (canMoveColor(color) || canPremoveColor(color));
    }
    snapshot.value = { ids, codes, movable };
  }, [ms.entries, orientation, interactive, canMoveColor, canPremoveColor, snapshot]);

  // ── Drag lifecycle (JS side) ──
  const clearDrag = useCallback(() => {
    parkedRef.current = false;
    if (parkTimerRef.current) clearTimeout(parkTimerRef.current);
    parkTimerRef.current = null;
    cancelAnimation(snapP);
    snapping.value = false;
    dropIdx.value = -1;
    hoverIdx.value = -1;
    lift.value = 0;
    dragId.value = -1;
  }, [snapP, snapping, dropIdx, hoverIdx, lift, dragId]);

  /** Keep the released piece on `idx` until the move commits (or times out). */
  const park = useCallback(
    (idx: number) => {
      parkedRef.current = true;
      dropIdx.value = idx;
      lift.value = withTiming(0, { duration: 90 });
      if (parkTimerRef.current) clearTimeout(parkTimerRef.current);
      parkTimerRef.current = setTimeout(() => {
        if (parkedRef.current) clearDrag();
      }, PARK_TTL_MS);
    },
    [dropIdx, lift, clearDrag],
  );

  /** Glide the dragged piece from `release` (squares) back to `home`, then hand it back. */
  const snapBack = useCallback(
    (home: string, release: BoardPoint) => {
      parkedRef.current = false;
      if (parkTimerRef.current) clearTimeout(parkTimerRef.current);
      const m = motionRef.current;
      const homePt = squareToPoint(home, orientation);
      if (!m.enabled || !m.snapBack || Math.hypot(release[0] - homePt[0], release[1] - homePt[1]) < 0.05) {
        clearDrag();
        return;
      }
      const t = planSnapBackTrack(release, homePt);
      snapFrames.value = {
        offsets: t.frames.map((f) => f.offset),
        x: t.frames.map((f) => f.x),
        y: t.frames.map((f) => f.y),
      };
      cancelAnimation(snapP);
      snapP.value = 0;
      snapping.value = true;
      dropIdx.value = -1;
      lift.value = withTiming(0, { duration: t.durationMs });
      snapUntilRef.current = Date.now() + t.durationMs;
      snapP.value = withTiming(1, { duration: t.durationMs, easing: Easing.linear }, (finished) => {
        'worklet';
        if (!finished) return;
        // Hand the piece back in the same UI frame the ghost disappears.
        snapping.value = false;
        dragId.value = -1;
      });
    },
    [orientation, clearDrag, snapFrames, snapP, snapping, dropIdx, lift, dragId],
  );

  // Once the dropped move is on screen, retire the ghost. Child effects (the
  // pieces' new styles) run before this one, so there is no gap between them.
  useEffect(() => {
    dropHintRef.current = null;
    if (parkedRef.current) clearDrag();
  }, [placement, clearDrag]);

  // ── Selection reset on position change (mirrors the web board) ──
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const legalRef = useRef(legal);
  legalRef.current = legal;
  const premoveSquaresRef = useRef(premoveSquares);
  premoveSquaresRef.current = premoveSquares;
  const piecesRef = useRef(pieces);
  piecesRef.current = pieces;

  useEffect(() => {
    const sel = selectedRef.current;
    if (sel !== null) {
      // Keep a selection alive across the opponent's move when it is now our turn.
      const piece = piecesRef.current.get(sel as Square);
      if (piece && canMoveColor(piece.color)) {
        const next = dests?.get(sel as Square) ?? EMPTY_SQUARES;
        if (!sameSquares(legalRef.current, next)) setLegal(next.length === 0 ? EMPTY_SQUARES : [...next]);
        if (premoveSquaresRef.current.length > 0) setPremoveSquares(EMPTY_SQUARES);
        setPendingPromotion(null);
        return;
      }
    }
    setSelected(null);
    setLegal(EMPTY_SQUARES);
    setPremoveSquares(EMPTY_SQUARES);
    setPendingPromotion(null);
  }, [placement, dests, canMoveColor]);

  // ── Moves ──
  const shakeRef = useRef<(square: string) => Promise<void>>(() => Promise.resolve());

  // Guided mode: only the expected move(s) reach onMove.
  const guardedOnMove = useCallback(
    (from: string, to: string, promotion?: PromotionPiece): boolean => {
      if (expectedMove) {
        const ok = (Array.isArray(expectedMove) ? expectedMove : [expectedMove]).some(
          (m) => m.from === from && m.to === to && (m.promotion === undefined || m.promotion === promotion),
        );
        if (!ok) {
          if (wrongMoveFeedback === 'shake') void shakeRef.current(from);
          onWrongMove?.(from, to);
          return false;
        }
      }
      return onMove?.(from, to, promotion) ?? false;
    },
    [expectedMove, onMove, onWrongMove, wrongMoveFeedback],
  );

  const attemptMove = useCallback(
    (from: string, to: string, promotion: PromotionPiece | undefined, viaDrop: boolean): 'pending' | boolean => {
      if (!interactive) return false;
      if (dests && !(dests.get(from as Square) ?? EMPTY_SQUARES).includes(to)) return false;
      const piece = piecesRef.current.get(from as Square);
      if (piece?.role === 'p' && !promotion && (to[1] === '8' || to[1] === '1')) {
        if (!autoPromoteTo) {
          setPendingPromotion({ from, to, color: piece.color });
          return 'pending';
        }
        promotion = autoPromoteTo;
      }
      // Set before onMove: the parent may re-render with the new position
      // before onMove even returns, and that render must see the hint.
      if (viaDrop) dropHintRef.current = { from, to, at: Date.now() };
      const ok = guardedOnMove(from, to, promotion);
      if (!ok && viaDrop) dropHintRef.current = null;
      if (ok) {
        setSelected(null);
        setLegal(EMPTY_SQUARES);
        setPremoveSquares(EMPTY_SQUARES);
      }
      return ok;
    },
    [interactive, dests, autoPromoteTo, guardedOnMove],
  );

  const attemptPremove = useCallback(
    (from: string, to: string) => {
      if (!premovable?.enabled) return;
      setPremoveCurrent([from, to]);
      premovable.events?.set?.(from, to);
      setSelected(null);
      setLegal(EMPTY_SQUARES);
      setPremoveSquares(EMPTY_SQUARES);
    },
    [premovable],
  );

  const clearSelection = useCallback(() => {
    setSelected(null);
    setLegal(EMPTY_SQUARES);
    setPremoveSquares(EMPTY_SQUARES);
    setPendingPromotion(null);
    if (premoveCurrent) {
      setPremoveCurrent(null);
      premovable?.events?.unset?.();
    }
  }, [premoveCurrent, premovable]);

  // Play a queued premove as soon as it is our turn. Layout effect: the
  // opponent's move and our reply never paint as two separate positions.
  useLayoutEffect(() => {
    if (!premoveCurrent || !premovable?.enabled) return;
    const [from, to] = premoveCurrent;
    const piece = piecesRef.current.get(from as Square);
    if (!piece || piece.color !== turnColor) return;
    setPremoveCurrent(null);
    premovable.events?.unset?.();
    if (!dests || (dests.get(from as Square) ?? EMPTY_SQUARES).includes(to as Square)) onMove?.(from, to);
  }, [turnColor, premoveCurrent, premovable, dests, onMove]);

  // Controlled `premovable.current`: the key's presence means controlled.
  useEffect(() => {
    if (!premovable || !Object.prototype.hasOwnProperty.call(premovable, 'current')) return;
    const next = premovable.current ?? null;
    setPremoveCurrent((prev) => (prev === next || (prev && next && prev[0] === next[0] && prev[1] === next[1]) ? prev : next));
    if (next === null) setPremoveSquares((prev) => (prev.length === 0 ? prev : EMPTY_SQUARES));
  }, [premovable]);

  useEffect(() => {
    if (premovable?.enabled) return;
    setPremoveCurrent((prev) => (prev === null ? prev : null));
    setPremoveSquares((prev) => (prev.length === 0 ? prev : EMPTY_SQUARES));
  }, [premovable?.enabled]);

  /** Select `sq` if it holds a movable (or premovable) piece. Returns whether it did. */
  const selectPiece = useCallback(
    (sq: string): boolean => {
      const piece = piecesRef.current.get(sq as Square);
      if (!piece) return false;
      if (canMoveColor(piece.color)) {
        const targets = dests ? dests.get(sq as Square) ?? EMPTY_SQUARES : EMPTY_SQUARES;
        if (targets.length > 0 || !dests) {
          setSelected(sq);
          setLegal((prev) => (sameSquares(prev, targets) ? prev : [...targets]));
          setPremoveSquares(EMPTY_SQUARES);
          return true;
        }
      }
      if (canPremoveColor(piece.color)) {
        const targets = premoveDests(sq as Square, piecesRef.current, piece.color);
        if (targets.length > 0) {
          setSelected(sq);
          setLegal(EMPTY_SQUARES);
          setPremoveSquares(premovable?.showDests === false ? EMPTY_SQUARES : targets);
          return true;
        }
      }
      return false;
    },
    [canMoveColor, canPremoveColor, dests, premovable?.showDests],
  );

  // Tap logic, as on the web board: move to a highlighted square, queue a
  // premove, reselect, or deselect.
  const handleSquare = useCallback(
    (sq: string) => {
      if (!interactive) {
        onSquarePress?.(sq);
        return;
      }
      const sel = selectedRef.current;
      if (premoveCurrent) {
        setPremoveCurrent(null);
        premovable?.events?.unset?.();
      }
      if (sel && sel !== sq) {
        const piece = piecesRef.current.get(sel as Square);
        // Without `dests`, any square is offered to onMove.
        const offer = legalRef.current.includes(sq) || (!dests && !!piece && canMoveColor(piece.color));
        if (offer) {
          const result = attemptMove(sel, sq, undefined, false);
          if (result === 'pending' || result) return;
        }
        if (premoveSquaresRef.current.includes(sq)) {
          attemptPremove(sel, sq);
          return;
        }
      }
      if (sel === sq) {
        clearSelection();
        return;
      }
      if (selectPiece(sq)) {
        onSquarePress?.(sq);
        return;
      }
      clearSelection();
      onSquarePress?.(sq);
    },
    [interactive, onSquarePress, premoveCurrent, premovable, dests, canMoveColor, attemptMove, attemptPremove, clearSelection, selectPiece],
  );

  const idxToSquare = useCallback(
    (idx: number): Square | null => (idx < 0 ? null : pointToSquare(idx % 8, Math.floor(idx / 8), orientation)),
    [orientation],
  );

  // Handlers called from the UI thread. The gesture is built once per size;
  // these stable trampolines always reach the latest closures.
  const handlers = {
    tap(idx: number) {
      const sq = idxToSquare(idx);
      if (sq && !pendingPromotion) handleSquare(sq);
    },
    liftPiece(idx: number) {
      const sq = idxToSquare(idx);
      if (!sq) return;
      if (parkedRef.current) {
        parkedRef.current = false;
        if (parkTimerRef.current) clearTimeout(parkTimerRef.current);
      }
      selectPiece(sq);
      onPieceLift?.(sq);
    },
    drop(fromIdx: number, toIdx: number, vx: number, vy: number, moved: boolean) {
      const from = idxToSquare(fromIdx);
      if (!from) return;
      const to = idxToSquare(toIdx);
      const piece = piecesRef.current.get(from);
      let result: 'accepted' | 'pending' | 'rejected' = 'rejected';
      if (to && to !== from && piece && interactive) {
        if (canMoveColor(piece.color)) {
          const r = attemptMove(from, to, undefined, true);
          result = r === 'pending' ? 'pending' : r ? 'accepted' : 'rejected';
        }
        if (result === 'rejected' && canPremoveColor(piece.color)) {
          if (premoveDests(from, piecesRef.current, piece.color).includes(to)) attemptPremove(from, to);
        }
      } else if (moved) {
        // Carried away and brought back: treat as "never mind".
        setSelected(null);
        setLegal(EMPTY_SQUARES);
        setPremoveSquares(EMPTY_SQUARES);
      }
      if (result === 'accepted' || result === 'pending') {
        park(toIdx);
        if (result === 'pending' && to) promoDragRef.current = { from, to, toIdx };
        else onPieceDrop?.(from, to, true);
        return;
      }
      snapBack(from, [vx, vy]);
      onPieceDrop?.(from, to, false);
    },
  };
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const onTapJS = useCallback((idx: number) => handlersRef.current.tap(idx), []);
  const onLiftJS = useCallback((idx: number) => handlersRef.current.liftPiece(idx), []);
  const onDropJS = useCallback(
    (from: number, to: number, vx: number, vy: number, moved: boolean) => handlersRef.current.drop(from, to, vx, vy, moved),
    [],
  );

  // ── Promotion ──
  const resolvePromotion = useCallback(
    (choice: PromotionPiece | null) => {
      const pending = pendingPromotion;
      const dragged = promoDragRef.current;
      promoDragRef.current = null;
      setPendingPromotion(null);
      if (!pending) return;
      const ok = choice ? attemptMove(pending.from, pending.to, choice, !!dragged) === true : false;
      if (!choice) clearSelection();
      if (dragged) {
        if (!ok) {
          const [c, r] = [dragged.toIdx % 8, Math.floor(dragged.toIdx / 8)];
          snapBack(dragged.from, [c, r]);
        }
        onPieceDrop?.(dragged.from, dragged.to, ok);
      }
    },
    [pendingPromotion, attemptMove, clearSelection, snapBack, onPieceDrop],
  );
  const onPromotionSelect = useCallback((p: PromotionPiece) => resolvePromotion(p), [resolvePromotion]);
  const onPromotionDismiss = useCallback(() => resolvePromotion(null), [resolvePromotion]);

  // ── Gesture ──
  const gestureEnabled = size > 0 && (interactive || !!onSquarePress) && !pendingPromotion;
  const pan = useMemo(() => {
    const indexAt = (x: number, y: number): number => {
      'worklet';
      if (!(x >= 0 && y >= 0 && x < size && y < size)) return -1;
      return Math.floor(y / s) * 8 + Math.floor(x / s);
    };
    return Gesture.Pan()
      .enabled(gestureEnabled)
      .minDistance(0)
      .maxPointers(1)
      .onBegin((e) => {
        'worklet';
        const idx = indexAt(e.x, e.y);
        candidate.value = -1;
        dragging.value = false;
        leftOrigin.value = false;
        if (idx < 0) return;
        if (snapshot.value.movable[idx]) {
          // Maybe a drag: decide on release (tap) or after the threshold (drag).
          candidate.value = idx;
          startX.value = e.x;
          startY.value = e.y;
        } else {
          runOnJS(onTapJS)(idx);
        }
      })
      .onUpdate((e) => {
        'worklet';
        const from = candidate.value;
        if (from < 0) return;
        if (!dragging.value) {
          const dx = e.x - startX.value;
          const dy = e.y - startY.value;
          if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return;
          dragging.value = true;
          // Pick the piece up right here on the UI thread; React catches up
          // with the selection dots a frame later.
          cancelAnimation(snapP);
          snapping.value = false;
          dropIdx.value = -1;
          dragCode.value = snapshot.value.codes[from];
          dragId.value = snapshot.value.ids[from];
          lift.value = withTiming(1, { duration: 110, easing: Easing.out(Easing.cubic) });
          runOnJS(onLiftJS)(from);
        }
        dragX.value = e.x;
        dragY.value = e.y;
        const idx = indexAt(e.x, e.y);
        if (idx !== from && idx >= 0) leftOrigin.value = true;
        const hover = idx === from ? -1 : idx;
        if (hoverIdx.value !== hover) hoverIdx.value = hover;
      })
      .onFinalize((e, success) => {
        'worklet';
        const from = candidate.value;
        candidate.value = -1;
        if (from < 0) return;
        if (!dragging.value) {
          runOnJS(onTapJS)(from);
          return;
        }
        dragging.value = false;
        hoverIdx.value = -1;
        const target = success ? indexAt(e.x, e.y) : -1;
        // Where the piece is drawn at release (top-left, squares) — the
        // snap-back starts from what the user sees, lift included.
        const vx = (dragX.value - s / 2) / s;
        const vy = (dragY.value - s / 2 - dragLiftSquares * s * lift.value) / s;
        runOnJS(onDropJS)(from, target, vx, vy, leftOrigin.value);
      });
  }, [
    gestureEnabled, size, s, dragLiftSquares, onTapJS, onLiftJS, onDropJS,
    candidate, dragging, leftOrigin, startX, startY, snapshot, snapP, snapping, dropIdx, dragCode, dragId, lift, dragX, dragY, hoverIdx,
  ]);

  // ── Board flip ('rotate'): the piece layer turns back from 180° ──
  const spin = ms.spin;
  const spinKey = spin?.key ?? 0;
  const spinOffsets = spin?.offsets ?? ZERO_TO_ONE;
  const spinAngles = spin?.angles ?? NO_ANGLE;
  const spinP = useSharedValue(1);
  const spinActive = useSharedValue(-1);
  const spinStyle = useAnimatedStyle(() => {
    'worklet';
    const p = spinActive.value === spinKey ? spinP.value : 0;
    return { transform: [{ rotate: `${lerpAt(spinAngles, segmentAt(p, spinOffsets))}deg` }] };
  }, [spinKey, spinOffsets, spinAngles, spinP, spinActive]);
  useEffect(() => {
    if (!spin) return;
    cancelAnimation(spinP);
    spinP.value = 0;
    spinActive.value = spin.key;
    spinP.value = withTiming(1, { duration: spin.durationMs, easing: Easing.linear });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey]);

  // ── Imperative API ──
  const shakePiece = useCallback((square: string): Promise<void> => {
    // A rejected drop snaps back first; shake once the piece is home.
    const delay = Math.max(0, snapUntilRef.current - Date.now());
    const now = Date.now();
    setMotionState((st) => retrack(st, square, (e) => shakeTrack(squareToPoint(e.square, st.orientation), delay), now));
    return new Promise((resolve) => setTimeout(resolve, delay + 380));
  }, []);
  shakeRef.current = shakePiece;

  useImperativeHandle(
    ref,
    () => ({
      pulseSquare(square, options = {}) {
        const durationMs = options.durationMs ?? 600;
        const times = Math.max(1, Math.round(options.times ?? 2));
        const spec: PulseSpec = {
          key: ++pulseKeyRef.current,
          square,
          color: options.color ?? 'rgba(255, 215, 0, 0.55)',
          durationMs,
          times,
        };
        setPulses((p) => [...p, spec]);
        return new Promise<void>((resolve) =>
          setTimeout(() => {
            setPulses((p) => p.filter((x) => x !== spec));
            resolve();
          }, durationMs * times + 32),
        );
      },
      shakePiece,
      animateMove(from, to, options = {}) {
        const m = motionRef.current;
        let durationMs = options.durationMs ?? Math.max(700, animationDurationMs * 3.5);
        if (reducedMotion) durationMs = Math.min(durationMs, 160);
        const now = Date.now();
        setMotionState((st) =>
          retrack(
            st,
            from,
            (e) =>
              planMoveTrack(currentPoint(e, st.orientation, now), squareToPoint(to, st.orientation), {
                ...m,
                durationMs,
                distanceScaling: 0,
                liftScale: reducedMotion ? 1 : Math.max(m.liftScale, 1.08),
              }),
            now,
          ),
        );
        return new Promise<void>((resolve) => setTimeout(resolve, durationMs + 16));
      },
      getSquareAtPoint(x, y) {
        return s > 0 ? pointToSquare(x / s, y / s, orientation) : null;
      },
      clearSelection,
    }),
    [shakePiece, animationDurationMs, reducedMotion, s, orientation, clearSelection],
  );

  // ── Render ──
  const label = accessibilityLabel ?? `Chess board, ${orientation} at the bottom`;
  const board =
    size > 0 ? (
      <View style={{ width: size, height: size }} collapsable={false}>
        <BoardSquares size={size} orientation={orientation} theme={theme} showCoordinates={showCoordinates} />
        <SquareOverlay
          size={size}
          orientation={orientation}
          theme={theme}
          visuals={visuals}
          lastMove={lastMove}
          check={check}
          highlightedSquares={highlightedSquares}
          markedSquares={markedSquares}
          selected={selected}
          legal={legal}
          premoveDests={premoveSquares}
          premoveCurrent={premoveCurrent}
          occupied={occupied}
          gradientId={gradientId}
        />
        {interactive ? <HoverSquare size={size} hoverIdx={hoverIdx} color={visuals.dragOverHighlight} /> : null}
        {pulses.map((p) => (
          <Pulse key={p.key} spec={p} size={size} orientation={orientation} />
        ))}
        <Animated.View style={[StyleSheet.absoluteFill, styles.passThrough, spinStyle]}>
          {ms.entries.map((e) => (
            <PieceView
              key={e.id}
              entry={e}
              orientation={orientation}
              size={size}
              renderPiece={renderPiece}
              flipPieces={flipPieces}
              dragId={dragId}
              dropIdx={dropIdx}
              originOpacity={visuals.dragOriginOpacity}
              onExitDone={onExitDone}
            />
          ))}
        </Animated.View>
        <Arrows size={size} orientation={orientation} arrows={stableArrows} brushes={arrowBrushes} />
        {interactive ? (
          <DragGhost
            size={size}
            drag={drag}
            dragScale={dragScale}
            liftSquares={dragLiftSquares}
            flipPieces={flipPieces}
            renderPiece={renderPiece}
          />
        ) : null}
        {pendingPromotion ? (
          <PromotionChooser
            size={size}
            orientation={orientation}
            square={pendingPromotion.to}
            color={pendingPromotion.color}
            renderPiece={renderPiece}
            onSelect={onPromotionSelect}
            onDismiss={onPromotionDismiss}
          />
        ) : null}
      </View>
    ) : null;

  return (
    <View
      style={[sizeProp !== undefined ? { width: sizeProp, height: sizeProp } : styles.auto, style]}
      onLayout={sizeProp === undefined ? onLayout : undefined}
      accessible={!pendingPromotion}
      accessibilityRole="image"
      accessibilityLabel={label}
      testID={testID}
    >
      {board ? <GestureDetector gesture={pan}>{board}</GestureDetector> : null}
    </View>
  );
});

/** Alias matching the web package's component name. */
export const ChessiroCanvas = ChessiroBoard;

const styles = StyleSheet.create({
  auto: { width: '100%', aspectRatio: 1 },
  passThrough: { pointerEvents: 'none' },
});
