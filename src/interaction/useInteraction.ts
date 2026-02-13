import { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import type {
  Square, Orientation, Arrow, ArrowBrushes, PieceColor,
  PromotionPiece, PromotionContext, Dests, PremoveConfig,
} from '../types';
import { DEFAULT_ARROW_BRUSHES } from '../types';
import { readFen, INITIAL_FEN } from '../utils/fen';
import { screenPos2square } from '../utils/coords';
import { premoveDests } from '../utils/premove';
import { getSquareFromEvent, getClientPos, isRightButton } from './pointer';
import type { DragState } from './pointer';

const DRAG_THRESHOLD = 4;

function hasDragStarted(drag: DragState): boolean {
  const dx = drag.currentPos[0] - drag.startPos[0];
  const dy = drag.currentPos[1] - drag.startPos[1];
  return Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD;
}

// Determine arrow brush color from modifier keys (matches chessground)
function eventBrushColor(e: MouseEvent | TouchEvent, brushes: ArrowBrushes): string {
  if (!('shiftKey' in e)) return brushes.green; // touch events
  const modA = (e.shiftKey || e.ctrlKey);
  const modB = e.altKey || e.metaKey;
  const idx = (modA ? 1 : 0) + (modB ? 2 : 0);
  const keys: (keyof ArrowBrushes)[] = ['green', 'red', 'blue', 'yellow'];
  return brushes[keys[idx]];
}

interface UseInteractionOptions {
  position: string;
  orientation: Orientation;
  interactive: boolean;
  allowDragging: boolean;
  allowDrawingArrows: boolean;
  boardRef: React.RefObject<HTMLDivElement | null>;
  boardBounds: DOMRect | null;
  onMove?: (from: string, to: string, promotion?: PromotionPiece) => boolean;
  dests?: Dests;
  turnColor?: PieceColor;
  movableColor?: PieceColor | 'both';
  premovable?: PremoveConfig;
  arrows: Arrow[];
  onArrowsChange?: (arrows: Arrow[]) => void;
  arrowBrushes?: Partial<ArrowBrushes>;
  snapArrowsToValidMoves?: boolean;
  markedSquares?: string[];
  onMarkedSquaresChange?: (squares: string[]) => void;
  plyIndex?: number;
  plyArrows?: Map<number, Arrow[]>;
  onPlyArrowsChange?: (plyIndex: number, arrows: Arrow[]) => void;
  plyMarks?: Map<number, string[]>;
  onPlyMarksChange?: (plyIndex: number, marks: string[]) => void;
  onSquareClick?: (square: string) => void;
  onClearOverlays?: () => void;
  blockTouchScroll?: boolean;
}

export interface InteractionState {
  selectedSquare: string | null;
  legalSquares: string[];
  premoveSquares: string[];
  premoveCurrent: [string, string] | null;
  pendingPromotion: PromotionContext | null;
  drag: DragState | null;
  activeMarkedSquares: Record<string, boolean>;
  renderedArrows: Arrow[];
  handlePointerDown: (e: React.MouseEvent | React.TouchEvent) => void;
  handlePromotionSelect: (piece: PromotionPiece) => void;
  handlePromotionDismiss: () => void;
}

export function useInteraction(opts: UseInteractionOptions): InteractionState {
  const {
    position, orientation, interactive, allowDragging, allowDrawingArrows,
    boardRef, boardBounds, onMove, dests,
    turnColor, movableColor, premovable,
    arrows, onArrowsChange: _onArrowsChange,
    arrowBrushes: customBrushes, snapArrowsToValidMoves = true,
    markedSquares: externalMarkedSquares, onMarkedSquaresChange,
    plyIndex, plyArrows, onPlyArrowsChange, plyMarks, onPlyMarksChange,
    onSquareClick, onClearOverlays, blockTouchScroll,
  } = opts;

  const asWhite = orientation === 'white';
  const brushes: ArrowBrushes = useMemo(
    () => ({ ...DEFAULT_ARROW_BRUSHES, ...customBrushes }),
    [customBrushes],
  );
  const pieces = useMemo(() => readFen(position || INITIAL_FEN), [position]);

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalSquares, setLegalSquares] = useState<string[]>([]);
  const [premoveSquares, setPremoveSquares] = useState<string[]>([]);
  const [premoveCurrent, setPremoveCurrent] = useState<[string, string] | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PromotionContext | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const [internalArrowsMap, setInternalArrowsMap] = useState<Map<number, Arrow[]>>(new Map());
  const [internalMarksMap, setInternalMarksMap] = useState<Map<number, string[]>>(new Map());
  const arrowStartRef = useRef<string | null>(null);
  const arrowColorRef = useRef<string>(brushes.green);
  const arrowPosRef = useRef<[number, number] | null>(null); // track mouse pos during arrow draw
  const justDrewArrowRef = useRef(false);
  const dragKeyChangedRef = useRef(false);

  const selectedRef = useRef(selectedSquare);
  const legalRef = useRef(legalSquares);
  const premoveRef = useRef(premoveSquares);
  const piecesRef = useRef(pieces);
  selectedRef.current = selectedSquare;
  legalRef.current = legalSquares;
  premoveRef.current = premoveSquares;
  piecesRef.current = pieces;

  // When turnColor/movableColor not provided, allow both colors (free mode)
  const freeMode = turnColor === undefined && movableColor === undefined;

  // Is this piece's color the one that can move right now?
  const canMoveColor = useCallback((_color: PieceColor): boolean => {
    if (freeMode) return true;
    const effective = movableColor ?? turnColor ?? 'w';
    if (effective === 'both') return true;
    return _color === effective && (turnColor === undefined || _color === turnColor);
  }, [freeMode, movableColor, turnColor]);

  // Is this piece premovable? (it's our color but not our turn)
  const canPremoveColor = useCallback((_color: PieceColor): boolean => {
    if (freeMode) return false;
    if (!premovable?.enabled) return false;
    const effective = movableColor ?? turnColor ?? 'w';
    if (effective === 'both') return false;
    return _color === effective && turnColor !== undefined && _color !== turnColor;
  }, [freeMode, movableColor, turnColor, premovable?.enabled]);

  // Reset selection on position change
  useEffect(() => {
    setSelectedSquare(null);
    setLegalSquares([]);
    setPremoveSquares([]);
    setPendingPromotion(null);
  }, [position]);

  // Apply premove when turn changes (if there's a stored premove)
  useEffect(() => {
    if (!premoveCurrent || !premovable?.enabled) return;
    const [from, to] = premoveCurrent;
    const piece = piecesRef.current.get(from as Square);
    if (piece && piece.color === turnColor) {
      // It's now our turn and we have a premove stored
      const validDests = dests?.get(from as Square) || [];
      if (validDests.includes(to as Square) || !dests) {
        setPremoveCurrent(null);
        premovable.events?.unset?.();
        onMove?.(from, to);
      } else {
        // Premove is not valid in the new position, cancel it
        setPremoveCurrent(null);
        premovable.events?.unset?.();
      }
    }
  }, [turnColor, premoveCurrent, premovable, dests, onMove]);

  // Sync external premove.current
  useEffect(() => {
    if (premovable?.current) {
      setPremoveCurrent(premovable.current);
    }
  }, [premovable?.current]);

  const getDestsForSquare = useCallback((sq: string): string[] => {
    if (dests) return dests.get(sq as Square) || [];
    return [];
  }, [dests]);

  const attemptMove = useCallback((from: string, to: string, promotion?: PromotionPiece): 'pending' | boolean => {
    if (!onMove || !interactive) return false;
    const validDests = getDestsForSquare(from);
    if (dests && !validDests.includes(to)) return false;

    const piece = piecesRef.current.get(from as Square);
    if (piece?.role === 'p' && !promotion) {
      const toRank = parseInt(to[1]);
      if ((piece.color === 'w' && toRank === 8) || (piece.color === 'b' && toRank === 1)) {
        setPendingPromotion({ from, to, color: piece.color });
        return 'pending';
      }
    }

    const success = onMove(from, to, promotion);
    if (success) {
      setSelectedSquare(null);
      setLegalSquares([]);
      setPremoveSquares([]);
    }
    return success;
  }, [onMove, interactive, getDestsForSquare, dests]);

  const attemptPremove = useCallback((from: string, to: string) => {
    if (!premovable?.enabled) return;
    setPremoveCurrent([from, to]);
    premovable.events?.set?.(from, to);
    setSelectedSquare(null);
    setLegalSquares([]);
    setPremoveSquares([]);
  }, [premovable]);

  // ── Clear overlays for current ply ──

  const clearOverlaysForPly = useCallback(() => {
    const ply = plyIndex ?? 0;
    if (externalMarkedSquares !== undefined) {
      onMarkedSquaresChange?.([]);
    } else if (onPlyMarksChange && plyIndex !== undefined) {
      onPlyMarksChange(plyIndex, []);
    } else {
      setInternalMarksMap(prev => { const m = new Map(prev); m.set(ply, []); return m; });
    }
    if (onPlyArrowsChange && plyIndex !== undefined) {
      onPlyArrowsChange(plyIndex, []);
    } else {
      setInternalArrowsMap(prev => { const m = new Map(prev); m.set(ply, []); return m; });
    }
    onClearOverlays?.();
  }, [plyIndex, externalMarkedSquares, onMarkedSquaresChange, onPlyMarksChange, onPlyArrowsChange, onClearOverlays]);

  // ── Square click/selection logic ──

  const handleSquareInteraction = useCallback((sq: string) => {
    if (!interactive) { onSquareClick?.(sq); return; }
    if (justDrewArrowRef.current) { justDrewArrowRef.current = false; return; }

    const sel = selectedRef.current;
    const legal = legalRef.current;
    const pmDests = premoveRef.current;

    clearOverlaysForPly();

    // Cancel existing premove on any click
    if (premoveCurrent) {
      setPremoveCurrent(null);
      premovable?.events?.unset?.();
    }

    // If we have a selection and the target is a legal move
    if (sel && legal.includes(sq)) {
      const result = attemptMove(sel, sq);
      if (result === 'pending' || result) return;
    }

    // If we have a selection and the target is a premove destination
    if (sel && pmDests.includes(sq)) {
      attemptPremove(sel, sq);
      return;
    }

    // Clicking the same square deselects
    if (sel === sq) {
      setSelectedSquare(null);
      setLegalSquares([]);
      setPremoveSquares([]);
      return;
    }

    // Clicking a piece
    const piece = piecesRef.current.get(sq as Square);
    if (piece) {
      // Can move this piece normally
      if (canMoveColor(piece.color)) {
        const targets = getDestsForSquare(sq);
        if (targets.length > 0 || !dests) {
          setSelectedSquare(sq);
          setLegalSquares(targets);
          setPremoveSquares([]);
          onSquareClick?.(sq);
          return;
        }
      }
      // Can premove this piece
      if (canPremoveColor(piece.color)) {
        const pmTargets = premoveDests(sq as Square, piecesRef.current, piece.color);
        if (pmTargets.length > 0) {
          setSelectedSquare(sq);
          setLegalSquares([]);
          setPremoveSquares(pmTargets);
          onSquareClick?.(sq);
          return;
        }
      }
    }

    setSelectedSquare(null);
    setLegalSquares([]);
    setPremoveSquares([]);
    onSquareClick?.(sq);
  }, [interactive, attemptMove, attemptPremove, getDestsForSquare, dests,
    canMoveColor, canPremoveColor, premoveCurrent, premovable,
    onSquareClick, clearOverlaysForPly]);

  // ── Toggle arrow/mark helpers ──

  const toggleArrow = useCallback((start: string, end: string, color: string) => {
    const ply = plyIndex ?? 0;
    const key = `${start}-${end}`;
    const current = (plyArrows && plyIndex !== undefined)
      ? (plyArrows.get(plyIndex) || [])
      : (internalArrowsMap.get(ply) || []);

    const exists = current.some(a => `${a.startSquare}-${a.endSquare}` === key);
    const next = exists
      ? current.filter(a => `${a.startSquare}-${a.endSquare}` !== key)
      : [...current, { startSquare: start, endSquare: end, color }];

    if (onPlyArrowsChange && plyIndex !== undefined) {
      onPlyArrowsChange(plyIndex, next);
    } else {
      setInternalArrowsMap(prev => { const m = new Map(prev); m.set(ply, next); return m; });
    }
  }, [plyIndex, plyArrows, onPlyArrowsChange, internalArrowsMap]);

  const toggleMark = useCallback((sq: string) => {
    const ply = plyIndex ?? 0;
    if (externalMarkedSquares !== undefined) {
      const set = new Set(externalMarkedSquares);
      if (set.has(sq)) set.delete(sq); else set.add(sq);
      onMarkedSquaresChange?.(Array.from(set));
    } else if (onPlyMarksChange && plyIndex !== undefined) {
      const current = plyMarks?.get(plyIndex) || [];
      const set = new Set(current);
      if (set.has(sq)) set.delete(sq); else set.add(sq);
      onPlyMarksChange(plyIndex, Array.from(set));
    } else {
      setInternalMarksMap(prev => {
        const m = new Map(prev);
        const set = new Set(m.get(ply) || []);
        if (set.has(sq)) set.delete(sq); else set.add(sq);
        m.set(ply, Array.from(set));
        return m;
      });
    }
  }, [plyIndex, externalMarkedSquares, onMarkedSquaresChange, plyMarks, onPlyMarksChange]);

  // ── Snap arrow destination to closest valid queen/knight square (pixel distance) ──
  // This matches chessground's getSnappedKeyAtDomPos approach

  const getSnappedSquare = useCallback((origSq: string, clientX: number, clientY: number): string | undefined => {
    if (!boardBounds) return undefined;
    const origF = origSq.charCodeAt(0) - 97;
    const origR = parseInt(origSq[1]) - 1;

    let bestSq: string | undefined;
    let bestDist = Infinity;

    for (let f = 0; f < 8; f++) {
      for (let r = 0; r < 8; r++) {
        if (f === origF && r === origR) continue;
        // Only queen or knight directions
        const df = Math.abs(f - origF);
        const dr = Math.abs(r - origR);
        const isKnight = (df === 1 && dr === 2) || (df === 2 && dr === 1);
        const isQueen = df === 0 || dr === 0 || df === dr;
        if (!isKnight && !isQueen) continue;

        // Compute pixel center of this square
        const col = asWhite ? f : 7 - f;
        const row = asWhite ? 7 - r : r;
        const cx = boardBounds.left + (col + 0.5) * boardBounds.width / 8;
        const cy = boardBounds.top + (row + 0.5) * boardBounds.height / 8;
        const dx = clientX - cx;
        const dy = clientY - cy;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          bestSq = String.fromCharCode(97 + f) + (r + 1);
        }
      }
    }
    return bestSq;
  }, [boardBounds, asWhite]);

  // ── Pointer down handler ──

  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!boardBounds) return;
    const sq = getSquareFromEvent(e.nativeEvent, asWhite, boardBounds);
    if (!sq) return;

    // Right-click: arrow drawing
    if ('button' in e && isRightButton(e as React.MouseEvent)) {
      if (allowDrawingArrows) {
        e.preventDefault();
        arrowStartRef.current = sq;
        arrowColorRef.current = eventBrushColor(e.nativeEvent as MouseEvent, brushes);
        const pos = getClientPos(e.nativeEvent);
        arrowPosRef.current = pos ?? null;
      }
      return;
    }

    // Left click: clear arrows/marks
    const piece = piecesRef.current.get(sq);
    const pos = getClientPos(e.nativeEvent);
    if (!pos) return;

    // Initiate drag if there's a piece and dragging is allowed
    if (piece && interactive && allowDragging) {
      const canMove = canMoveColor(piece.color);
      const canPremove = canPremoveColor(piece.color);
      if (canMove || canPremove) {
        dragKeyChangedRef.current = false;
        setDrag({
          origSquare: sq,
          piece,
          startPos: pos,
          currentPos: pos,
          started: false,
        });
      }
    }

    // Prevent touch scroll if configured or if interacting with a piece
    if (blockTouchScroll && 'touches' in e && piece) {
      e.preventDefault();
    }

    handleSquareInteraction(sq);
  }, [boardBounds, asWhite, interactive, allowDragging, allowDrawingArrows,
    handleSquareInteraction, brushes, canMoveColor, canPremoveColor, blockTouchScroll]);

  // ── Document-level move/up for drag and arrow drawing ──

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const pos = getClientPos(e);
      if (!pos) return;
      // Track mouse position for arrow drawing
      if (arrowStartRef.current) {
        arrowPosRef.current = pos;
      }
      setDrag(prev => {
        if (!prev) return null;
        const next = { ...prev, currentPos: pos };
        if (!next.started && hasDragStarted(next)) {
          next.started = true;
        }
        if (next.started && boardBounds) {
          const currentSq = screenPos2square(pos[0], pos[1], asWhite, boardBounds);
          if (currentSq && currentSq !== prev.origSquare) {
            dragKeyChangedRef.current = true;
          }
        }
        return next;
      });
    };

    const handleUp = (e: MouseEvent | TouchEvent) => {
      // Arrow drawing end
      if ('button' in e && isRightButton(e as MouseEvent) && arrowStartRef.current && boardBounds) {
        const startSq = arrowStartRef.current;
        const color = arrowColorRef.current;
        // Use the last tracked position (more reliable than event position for right-click)
        const pos = arrowPosRef.current || getClientPos(e);
        arrowStartRef.current = null;
        arrowPosRef.current = null;

        if (pos) {
          // Get the raw square under cursor
          const rawSq = screenPos2square(pos[0], pos[1], asWhite, boardBounds);

          if (rawSq === startSq || !rawSq) {
            // Same square or no square: toggle mark
            toggleMark(startSq);
          } else if (snapArrowsToValidMoves) {
            // Snap to closest valid queen/knight direction
            const snapped = getSnappedSquare(startSq, pos[0], pos[1]);
            if (snapped && snapped !== startSq) {
              toggleArrow(startSq, snapped, color);
              justDrewArrowRef.current = true;
              setTimeout(() => { justDrewArrowRef.current = false; }, 150);
            }
          } else {
            toggleArrow(startSq, rawSq, color);
            justDrewArrowRef.current = true;
            setTimeout(() => { justDrewArrowRef.current = false; }, 150);
          }
        }
        return;
      }

      // Drag end
      let capturedDrag: DragState | null = null;
      setDrag(prev => {
        capturedDrag = prev;
        return null;
      });

      queueMicrotask(() => {
        if (!capturedDrag) return;
        if (!capturedDrag.started) return;
        if (!boardBounds || !interactive) return;

        const pos = getClientPos(e);
        const target = pos ? screenPos2square(pos[0], pos[1], asWhite, boardBounds) : undefined;

        if (target && target !== capturedDrag.origSquare) {
          const piece = piecesRef.current.get(capturedDrag.origSquare);
          if (piece) {
            // Try normal move first
            if (canMoveColor(piece.color)) {
              const result = attemptMove(capturedDrag.origSquare, target);
              if (result === 'pending' || result) return;
            }
            // Try premove
            if (canPremoveColor(piece.color)) {
              const pmDests = premoveDests(capturedDrag.origSquare as Square, piecesRef.current, piece.color);
              if (pmDests.includes(target as Square)) {
                attemptPremove(capturedDrag.origSquare, target);
                return;
              }
            }
          }
        } else if (capturedDrag.origSquare === target || !target) {
          if (dragKeyChangedRef.current) {
            setSelectedSquare(null);
            setLegalSquares([]);
            setPremoveSquares([]);
          }
        }
      });
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('touchmove', handleMove, { passive: true });
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchend', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchend', handleUp);
    };
  }, [boardBounds, asWhite, interactive, attemptMove, attemptPremove,
    toggleArrow, toggleMark, getSnappedSquare, snapArrowsToValidMoves, canMoveColor, canPremoveColor]);

  // Prevent context menu on the board
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const handler = (e: Event) => e.preventDefault();
    el.addEventListener('contextmenu', handler);
    return () => el.removeEventListener('contextmenu', handler);
  }, [boardRef]);

  // ── Computed values ──

  const activeMarkedSquares = useMemo((): Record<string, boolean> => {
    if (externalMarkedSquares) return Object.fromEntries(externalMarkedSquares.map(s => [s, true]));
    const ply = plyIndex ?? 0;
    const marks = (plyMarks && plyIndex !== undefined ? plyMarks.get(plyIndex) : undefined) || internalMarksMap.get(ply) || [];
    return Object.fromEntries(marks.map(s => [s, true]));
  }, [externalMarkedSquares, plyIndex, plyMarks, internalMarksMap]);

  const renderedArrows = useMemo((): Arrow[] => {
    const final: Arrow[] = [];
    const seen = new Set<string>();
    const ply = plyIndex ?? 0;
    const plyArr = (plyArrows && plyIndex !== undefined ? plyArrows.get(plyIndex) : undefined) || internalArrowsMap.get(ply) || [];
    for (const a of plyArr) { const k = `${a.startSquare}-${a.endSquare}`; if (!seen.has(k)) { final.push(a); seen.add(k); } }
    for (const a of arrows) { const k = `${a.startSquare}-${a.endSquare}`; if (!seen.has(k)) { final.push(a); seen.add(k); } }
    return final;
  }, [arrows, plyIndex, plyArrows, internalArrowsMap]);

  const handlePromotionSelect = useCallback((piece: PromotionPiece) => {
    if (!pendingPromotion) return;
    setPendingPromotion(null);
    attemptMove(pendingPromotion.from, pendingPromotion.to, piece);
  }, [pendingPromotion, attemptMove]);

  const handlePromotionDismiss = useCallback(() => {
    setPendingPromotion(null);
    setSelectedSquare(null);
    setLegalSquares([]);
    setPremoveSquares([]);
  }, []);

  return {
    selectedSquare,
    legalSquares,
    premoveSquares,
    premoveCurrent,
    pendingPromotion,
    drag: drag?.started ? drag : null,
    activeMarkedSquares,
    renderedArrows,
    handlePointerDown,
    handlePromotionSelect,
    handlePromotionDismiss,
  };
}
