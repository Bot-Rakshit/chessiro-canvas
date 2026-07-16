import { memo, useMemo, useState, useEffect, forwardRef, useRef, useImperativeHandle, useCallback, useLayoutEffect } from 'react';
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { createPortal } from 'react-dom';

// src/ChessiroCanvas.tsx

// src/types.ts
var FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
var RANKS = ["1", "2", "3", "4", "5", "6", "7", "8"];
var DEFAULT_ARROW_BRUSHES = {
  green: "#15781B",
  red: "#882020",
  blue: "#003088",
  yellow: "#e68f00"
};

// src/utils/fen.ts
var ROLE_MAP = {
  p: "p",
  r: "r",
  n: "n",
  b: "b",
  q: "q",
  k: "k"
};
var INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
var INITIAL_GAME_FEN = `${INITIAL_FEN} w KQkq - 0 1`;
function readFen(fen) {
  const pieces = /* @__PURE__ */ new Map();
  const placement = fen.split(" ")[0] || fen;
  if (placement === "start") return readFen(INITIAL_FEN);
  let rank = 7;
  let file = 0;
  for (const ch of placement) {
    if (ch === "/") {
      rank--;
      file = 0;
      if (rank < 0) break;
      continue;
    }
    if (ch === " " || ch === "[") break;
    const num = ch.charCodeAt(0);
    if (num >= 49 && num <= 56) {
      file += num - 48;
    } else {
      const lower = ch.toLowerCase();
      const role = ROLE_MAP[lower];
      if (role && file < 8 && rank >= 0) {
        const color = ch === lower ? "b" : "w";
        const square = `${FILES[file]}${RANKS[rank]}`;
        pieces.set(square, { color, role });
      }
      file++;
    }
  }
  return pieces;
}
function writeFen(pieces) {
  const ranks = [];
  for (let r = 7; r >= 0; r--) {
    let empty = 0;
    let rankStr = "";
    for (let f = 0; f < 8; f++) {
      const sq2 = `${FILES[f]}${RANKS[r]}`;
      const piece = pieces.get(sq2);
      if (piece) {
        if (empty > 0) {
          rankStr += empty;
          empty = 0;
        }
        let ch = piece.role;
        if (piece.color === "w") ch = ch.toUpperCase();
        rankStr += ch;
      } else {
        empty++;
      }
    }
    if (empty > 0) rankStr += empty;
    ranks.push(rankStr);
  }
  return ranks.join("/");
}

// src/utils/coords.ts
var ALL_SQUARES = FILES.flatMap(
  (f) => RANKS.map((r) => `${f}${r}`)
);
function pos2square(pos) {
  if (pos[0] < 0 || pos[0] > 7 || pos[1] < 0 || pos[1] > 7) return void 0;
  return `${FILES[pos[0]]}${RANKS[pos[1]]}`;
}
function square2pos(sq2) {
  return [sq2.charCodeAt(0) - 97, sq2.charCodeAt(1) - 49];
}
function pos2translate(pos, asWhite, boundsWidth, boundsHeight) {
  const sqW = boundsWidth / 8;
  const sqH = boundsHeight / 8;
  return [
    (asWhite ? pos[0] : 7 - pos[0]) * sqW,
    (asWhite ? 7 - pos[1] : pos[1]) * sqH
  ];
}
function screenPos2square(clientX, clientY, asWhite, bounds) {
  let file = Math.floor(8 * (clientX - bounds.left) / bounds.width);
  if (!asWhite) file = 7 - file;
  let rank = 7 - Math.floor(8 * (clientY - bounds.top) / bounds.height);
  if (!asWhite) rank = 7 - rank;
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return void 0;
  return pos2square([file, rank]);
}
function distanceSq(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
}
function samePiece(a, b) {
  return a.color === b.color && a.role === b.role;
}
function useBoardSize(boardRef) {
  const [bounds, setBounds] = useState(null);
  const cachedBounds = useRef(null);
  const readMetrics = useCallback((el) => {
    const rect = el.getBoundingClientRect();
    const width = el.offsetWidth || rect.width;
    const height = el.offsetHeight || rect.height;
    if (width === 0 || height === 0) return null;
    return {
      width,
      height,
      left: rect.left,
      top: rect.top
    };
  }, []);
  const updateBounds = useCallback(() => {
    const el = boardRef.current;
    if (!el) return;
    const newBounds = readMetrics(el);
    if (!newBounds) return;
    const prev = cachedBounds.current;
    if (prev && prev.width === newBounds.width && prev.height === newBounds.height && prev.left === newBounds.left && prev.top === newBounds.top) {
      return;
    }
    cachedBounds.current = newBounds;
    setBounds(newBounds);
  }, [boardRef, readMetrics]);
  const getFreshBounds = useCallback(() => {
    const el = boardRef.current;
    if (!el) return cachedBounds.current;
    const fresh = readMetrics(el);
    if (!fresh) return cachedBounds.current;
    cachedBounds.current = fresh;
    return fresh;
  }, [boardRef, readMetrics]);
  useEffect(() => {
    updateBounds();
    const el = boardRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateBounds);
    observer.observe(el);
    window.addEventListener("scroll", updateBounds, { passive: true, capture: true });
    window.addEventListener("resize", updateBounds, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updateBounds, { capture: true });
      window.removeEventListener("resize", updateBounds);
    };
  }, [boardRef, updateBounds]);
  return { bounds, updateBounds, getFreshBounds };
}

// src/utils/premove.ts
var isValid = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;
var sq = (f, r) => `${FILES[f]}${RANKS[r]}`;
function premoveDests(square, pieces, color) {
  const piece = pieces.get(square);
  if (!piece || piece.color !== color) return [];
  const f = square.charCodeAt(0) - 97;
  const r = parseInt(square[1]) - 1;
  const results = [];
  switch (piece.role) {
    case "p": {
      const dir = color === "w" ? 1 : -1;
      const startRank = color === "w" ? 1 : 6;
      if (isValid(f, r + dir)) {
        results.push(sq(f, r + dir));
        if (r === startRank && isValid(f, r + 2 * dir)) {
          results.push(sq(f, r + 2 * dir));
        }
      }
      for (const df of [-1, 1]) {
        if (isValid(f + df, r + dir)) {
          results.push(sq(f + df, r + dir));
        }
      }
      break;
    }
    case "n": {
      for (const [df, dr] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
        if (isValid(f + df, r + dr)) {
          results.push(sq(f + df, r + dr));
        }
      }
      break;
    }
    case "b": {
      for (const [df, dr] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        for (let i = 1; i < 8; i++) {
          const tf = f + df * i, tr = r + dr * i;
          if (!isValid(tf, tr)) break;
          results.push(sq(tf, tr));
        }
      }
      break;
    }
    case "r": {
      for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        for (let i = 1; i < 8; i++) {
          const tf = f + df * i, tr = r + dr * i;
          if (!isValid(tf, tr)) break;
          results.push(sq(tf, tr));
        }
      }
      break;
    }
    case "q": {
      for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        for (let i = 1; i < 8; i++) {
          const tf = f + df * i, tr = r + dr * i;
          if (!isValid(tf, tr)) break;
          results.push(sq(tf, tr));
        }
      }
      break;
    }
    case "k": {
      for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        if (isValid(f + df, r + dr)) {
          results.push(sq(f + df, r + dr));
        }
      }
      const homeRank = color === "w" ? 0 : 7;
      if (f === 4 && r === homeRank) {
        const empty = (tf, tr) => {
          const occ = pieces.get(sq(tf, tr));
          return !occ || occ.color !== color;
        };
        if (empty(6, homeRank)) results.push(sq(6, homeRank));
        if (empty(2, homeRank)) results.push(sq(2, homeRank));
      }
      break;
    }
  }
  return results;
}

// src/interaction/pointer.ts
function getSquareFromEvent(e, asWhite, boardBounds) {
  let clientX;
  let clientY;
  if ("touches" in e && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else if ("changedTouches" in e && e.changedTouches.length > 0) {
    clientX = e.changedTouches[0].clientX;
    clientY = e.changedTouches[0].clientY;
  } else if ("clientX" in e) {
    clientX = e.clientX;
    clientY = e.clientY;
  } else {
    return void 0;
  }
  return screenPos2square(clientX, clientY, asWhite, boardBounds);
}
function getClientPos(e) {
  if ("touches" in e && e.touches.length > 0) {
    return [e.touches[0].clientX, e.touches[0].clientY];
  }
  if ("changedTouches" in e && e.changedTouches.length > 0) {
    return [e.changedTouches[0].clientX, e.changedTouches[0].clientY];
  }
  if ("clientX" in e) {
    return [e.clientX, e.clientY];
  }
  return void 0;
}
function isRightButton(e) {
  return e.button === 2;
}

// src/interaction/useInteraction.ts
var DRAG_THRESHOLD_MOUSE = 4;
var DRAG_THRESHOLD_TOUCH = 10;
var TOUCH_MOUSE_SUPPRESS_MS = 500;
var EMPTY_SQUARES = [];
var EMPTY_ARROWS = [];
var useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
function sameSquares(a, b) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
function hasDragStarted(drag, isTouch) {
  const dx = drag.currentPos[0] - drag.startPos[0];
  const dy = drag.currentPos[1] - drag.startPos[1];
  const threshold = isTouch ? DRAG_THRESHOLD_TOUCH : DRAG_THRESHOLD_MOUSE;
  return Math.sqrt(dx * dx + dy * dy) >= threshold;
}
function samePremove(a, b) {
  return a === b || a !== null && b !== null && a[0] === b[0] && a[1] === b[1];
}
function getControlledPremoveCurrent(premovable) {
  if (!premovable || !Object.prototype.hasOwnProperty.call(premovable, "current")) {
    return void 0;
  }
  return premovable.current ?? null;
}
function eventBrushColor(e, brushes) {
  if (!("shiftKey" in e)) return brushes.green;
  const modA = e.shiftKey || e.ctrlKey;
  const modB = e.altKey || e.metaKey;
  const idx = (modA ? 1 : 0) + (modB ? 2 : 0);
  const keys = ["green", "red", "blue", "yellow"];
  return brushes[keys[idx]];
}
function useInteraction(opts) {
  const {
    position,
    pieces,
    orientation,
    interactive,
    allowDragging,
    allowDrawingArrows,
    boardRef,
    boardBounds,
    getFreshBounds,
    onMove,
    dests,
    autoPromoteTo,
    turnColor,
    movableColor,
    premovable,
    arrows,
    onArrowsChange,
    arrowBrushes: customBrushes,
    snapArrowsToValidMoves = true,
    markedSquares: externalMarkedSquares,
    onMarkedSquaresChange,
    plyIndex,
    plyArrows,
    onPlyArrowsChange,
    plyMarks,
    onPlyMarksChange,
    onSquareClick,
    onClearOverlays,
    blockTouchScroll
  } = opts;
  const asWhite = orientation === "white";
  const brushes = useMemo(
    () => ({ ...DEFAULT_ARROW_BRUSHES, ...customBrushes }),
    [customBrushes]
  );
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalSquares, setLegalSquares] = useState([]);
  const [premoveSquares, setPremoveSquares] = useState([]);
  const [premoveCurrent, setPremoveCurrent] = useState(null);
  const [pendingPromotion, setPendingPromotion] = useState(null);
  const [dragHoverSquare, setDragHoverSquare] = useState(null);
  const [drag, setDrag] = useState(null);
  const [drawingArrow, setDrawingArrow] = useState(null);
  const dragGhostRef = useRef(null);
  const [internalArrowsMap, setInternalArrowsMap] = useState(/* @__PURE__ */ new Map());
  const [internalMarksMap, setInternalMarksMap] = useState(/* @__PURE__ */ new Map());
  const arrowStartRef = useRef(null);
  const arrowColorRef = useRef(brushes.green);
  const arrowPosRef = useRef(null);
  const drawingArrowRef = useRef(null);
  const justDrewArrowRef = useRef(false);
  const dragKeyChangedRef = useRef(false);
  const isTouchRef = useRef(false);
  const lastTouchTsRef = useRef(0);
  const docMoveHandlerRef = useRef(null);
  const docUpHandlerRef = useRef(null);
  const listenersActiveRef = useRef(false);
  const selectedRef = useRef(selectedSquare);
  const legalRef = useRef(legalSquares);
  const premoveRef = useRef(premoveSquares);
  const pendingPromotionRef = useRef(pendingPromotion);
  const piecesRef = useRef(pieces);
  const dragRef = useRef(null);
  const arrowsRef = useRef(arrows);
  const internalMarksMapRef = useRef(internalMarksMap);
  const internalArrowsMapRef = useRef(internalArrowsMap);
  const activeBoundsRef = useRef(null);
  selectedRef.current = selectedSquare;
  legalRef.current = legalSquares;
  premoveRef.current = premoveSquares;
  pendingPromotionRef.current = pendingPromotion;
  piecesRef.current = pieces;
  arrowsRef.current = arrows;
  internalMarksMapRef.current = internalMarksMap;
  internalArrowsMapRef.current = internalArrowsMap;
  const freeMode = turnColor === void 0 && movableColor === void 0;
  const canMoveColor = useCallback((_color) => {
    if (freeMode) return true;
    const effective = movableColor ?? turnColor ?? "w";
    if (effective === "both") return true;
    return _color === effective && (turnColor === void 0 || _color === turnColor);
  }, [freeMode, movableColor, turnColor]);
  const canPremoveColor = useCallback((_color) => {
    if (freeMode) return false;
    if (!premovable?.enabled) return false;
    const effective = movableColor ?? turnColor ?? "w";
    if (effective === "both") return false;
    return _color === effective && turnColor !== void 0 && _color !== turnColor;
  }, [freeMode, movableColor, turnColor, premovable?.enabled]);
  useEffect(() => {
    const sel = selectedRef.current;
    if (sel !== null) {
      const piece = piecesRef.current.get(sel);
      if (piece && canMoveColor(piece.color)) {
        const nextLegal = dests?.get(sel) ?? EMPTY_SQUARES;
        if (!sameSquares(legalRef.current, nextLegal)) {
          setLegalSquares(nextLegal.length === 0 ? EMPTY_SQUARES : [...nextLegal]);
        }
        if (premoveRef.current.length > 0) setPremoveSquares(EMPTY_SQUARES);
        if (pendingPromotionRef.current !== null) setPendingPromotion(null);
        return;
      }
    }
    if (selectedRef.current === null && legalRef.current.length === 0 && premoveRef.current.length === 0 && pendingPromotionRef.current === null) {
      return;
    }
    setSelectedSquare(null);
    setLegalSquares(EMPTY_SQUARES);
    setPremoveSquares(EMPTY_SQUARES);
    setPendingPromotion(null);
  }, [position, dests, canMoveColor]);
  useIsomorphicLayoutEffect(() => {
    if (!premoveCurrent || !premovable?.enabled) return;
    const [from, to] = premoveCurrent;
    const piece = piecesRef.current.get(from);
    if (piece && piece.color === turnColor) {
      const validDests = dests?.get(from) || [];
      if (validDests.includes(to) || !dests) {
        setPremoveCurrent(null);
        premovable.events?.unset?.();
        onMove?.(from, to);
      } else {
        setPremoveCurrent(null);
        premovable.events?.unset?.();
      }
    }
  }, [turnColor, premoveCurrent, premovable, dests, onMove]);
  useEffect(() => {
    const controlledCurrent = getControlledPremoveCurrent(premovable);
    if (controlledCurrent === void 0) return;
    setPremoveCurrent((prev) => samePremove(prev, controlledCurrent) ? prev : controlledCurrent);
    if (controlledCurrent === null) {
      setPremoveSquares((prev) => prev.length === 0 ? prev : EMPTY_SQUARES);
    }
  }, [premovable]);
  useEffect(() => {
    if (premovable?.enabled) return;
    setPremoveCurrent((prev) => prev === null ? prev : null);
    setPremoveSquares((prev) => prev.length === 0 ? prev : EMPTY_SQUARES);
  }, [premovable?.enabled]);
  const getDestsForSquare = useCallback((sq2) => {
    if (dests) return dests.get(sq2) || [];
    return [];
  }, [dests]);
  const getCurrentBounds = useCallback(() => {
    return getFreshBounds?.() ?? boardBounds;
  }, [boardBounds, getFreshBounds]);
  const onDocMove = useCallback((e) => {
    docMoveHandlerRef.current?.(e);
  }, []);
  const onDocUp = useCallback((e) => {
    docUpHandlerRef.current?.(e);
    if (!dragRef.current && !arrowStartRef.current && listenersActiveRef.current) {
      listenersActiveRef.current = false;
      document.removeEventListener("mousemove", onDocMove);
      document.removeEventListener("touchmove", onDocMove);
      document.removeEventListener("mouseup", onDocUp);
      document.removeEventListener("touchend", onDocUp);
      document.removeEventListener("touchcancel", onDocUp);
    }
  }, [onDocMove]);
  const detachDocListeners = useCallback(() => {
    if (!listenersActiveRef.current) return;
    listenersActiveRef.current = false;
    document.removeEventListener("mousemove", onDocMove);
    document.removeEventListener("touchmove", onDocMove);
    document.removeEventListener("mouseup", onDocUp);
    document.removeEventListener("touchend", onDocUp);
    document.removeEventListener("touchcancel", onDocUp);
  }, [onDocMove, onDocUp]);
  const attachDocListeners = useCallback((blockScroll) => {
    if (listenersActiveRef.current) return;
    listenersActiveRef.current = true;
    document.addEventListener("mousemove", onDocMove);
    document.addEventListener("touchmove", onDocMove, { passive: !blockScroll });
    document.addEventListener("mouseup", onDocUp);
    document.addEventListener("touchend", onDocUp);
    document.addEventListener("touchcancel", onDocUp);
  }, [onDocMove, onDocUp]);
  const attemptMove = useCallback((from, to, promotion) => {
    if (!onMove || !interactive) return false;
    const validDests = getDestsForSquare(from);
    if (dests && !validDests.includes(to)) return false;
    const piece = piecesRef.current.get(from);
    if (piece?.role === "p" && !promotion) {
      const toRank = parseInt(to[1]);
      if (piece.color === "w" && toRank === 8 || piece.color === "b" && toRank === 1) {
        if (autoPromoteTo) {
          promotion = autoPromoteTo;
        } else {
          setPendingPromotion({ from, to, color: piece.color });
          return "pending";
        }
      }
    }
    const success = onMove(from, to, promotion);
    if (success) {
      setSelectedSquare(null);
      setLegalSquares([]);
      setPremoveSquares([]);
    }
    return success;
  }, [onMove, interactive, getDestsForSquare, dests, autoPromoteTo]);
  const attemptPremove = useCallback((from, to) => {
    if (!premovable?.enabled) return;
    setPremoveCurrent([from, to]);
    premovable.events?.set?.(from, to);
    setSelectedSquare(null);
    setLegalSquares([]);
    setPremoveSquares([]);
  }, [premovable]);
  const clearSelection = useCallback(() => {
    setSelectedSquare(null);
    setLegalSquares([]);
    setPremoveSquares([]);
    setPendingPromotion(null);
    if (premoveCurrent) {
      setPremoveCurrent(null);
      premovable?.events?.unset?.();
    }
  }, [premoveCurrent, premovable]);
  const clearOverlaysForPly = useCallback(() => {
    const ply = plyIndex ?? 0;
    let changed = false;
    if (externalMarkedSquares !== void 0) {
      if (externalMarkedSquares.length > 0) {
        onMarkedSquaresChange?.([]);
        changed = true;
      }
    } else if (onPlyMarksChange && plyIndex !== void 0) {
      const current = plyMarks?.get(plyIndex) || EMPTY_SQUARES;
      if (current.length > 0) {
        onPlyMarksChange(plyIndex, []);
        changed = true;
      }
    } else {
      const current = internalMarksMapRef.current.get(ply) || EMPTY_SQUARES;
      if (current.length > 0) {
        setInternalMarksMap((prev) => {
          const m = new Map(prev);
          m.set(ply, EMPTY_SQUARES);
          return m;
        });
        changed = true;
      }
    }
    if (onPlyArrowsChange && plyIndex !== void 0) {
      const current = plyArrows?.get(plyIndex) || EMPTY_ARROWS;
      if (current.length > 0) {
        onPlyArrowsChange(plyIndex, []);
        changed = true;
      }
    } else if (onArrowsChange) {
      if (arrowsRef.current.length > 0) {
        onArrowsChange([]);
        changed = true;
      }
    } else {
      const current = internalArrowsMapRef.current.get(ply) || EMPTY_ARROWS;
      if (current.length > 0) {
        setInternalArrowsMap((prev) => {
          const m = new Map(prev);
          m.set(ply, EMPTY_ARROWS);
          return m;
        });
        changed = true;
      }
    }
    if (changed) {
      onClearOverlays?.();
    }
  }, [plyIndex, externalMarkedSquares, onMarkedSquaresChange, onPlyMarksChange, onPlyArrowsChange, onArrowsChange, onClearOverlays, plyMarks, plyArrows]);
  const handleSquareInteraction = useCallback((sq2) => {
    if (!interactive) {
      onSquareClick?.(sq2);
      return;
    }
    if (justDrewArrowRef.current) {
      justDrewArrowRef.current = false;
      return;
    }
    const sel = selectedRef.current;
    const legal = legalRef.current;
    const pmDests = premoveRef.current;
    clearOverlaysForPly();
    if (premoveCurrent) {
      setPremoveCurrent(null);
      premovable?.events?.unset?.();
    }
    if (sel && legal.includes(sq2)) {
      const result = attemptMove(sel, sq2);
      if (result === "pending" || result) return;
    }
    if (sel && pmDests.includes(sq2)) {
      attemptPremove(sel, sq2);
      return;
    }
    if (sel === sq2) {
      clearSelection();
      return;
    }
    const piece = piecesRef.current.get(sq2);
    if (piece) {
      if (canMoveColor(piece.color)) {
        const targets = getDestsForSquare(sq2);
        if (targets.length > 0 || !dests) {
          setSelectedSquare(sq2);
          setLegalSquares(targets);
          setPremoveSquares([]);
          onSquareClick?.(sq2);
          return;
        }
      }
      if (canPremoveColor(piece.color)) {
        const pmTargets = premoveDests(sq2, piecesRef.current, piece.color);
        if (pmTargets.length > 0) {
          setSelectedSquare(sq2);
          setLegalSquares([]);
          setPremoveSquares(pmTargets);
          onSquareClick?.(sq2);
          return;
        }
      }
    }
    clearSelection();
    onSquareClick?.(sq2);
  }, [
    interactive,
    attemptMove,
    attemptPremove,
    getDestsForSquare,
    dests,
    canMoveColor,
    canPremoveColor,
    premoveCurrent,
    premovable,
    onSquareClick,
    clearOverlaysForPly,
    clearSelection
  ]);
  const toggleArrow = useCallback((start, end, color) => {
    const ply = plyIndex ?? 0;
    const key = `${start}-${end}`;
    const current = plyArrows && plyIndex !== void 0 ? plyArrows.get(plyIndex) || [] : onArrowsChange ? arrowsRef.current : internalArrowsMap.get(ply) || [];
    const exists = current.some((a) => `${a.startSquare}-${a.endSquare}` === key);
    const next = exists ? current.filter((a) => `${a.startSquare}-${a.endSquare}` !== key) : [...current, { startSquare: start, endSquare: end, color }];
    if (onPlyArrowsChange && plyIndex !== void 0) {
      onPlyArrowsChange(plyIndex, next);
    } else if (onArrowsChange) {
      onArrowsChange(next);
    } else {
      setInternalArrowsMap((prev) => {
        const m = new Map(prev);
        m.set(ply, next);
        return m;
      });
    }
  }, [plyIndex, plyArrows, onPlyArrowsChange, onArrowsChange, internalArrowsMap]);
  const toggleMark = useCallback((sq2) => {
    const ply = plyIndex ?? 0;
    if (externalMarkedSquares !== void 0) {
      const set = new Set(externalMarkedSquares);
      if (set.has(sq2)) set.delete(sq2);
      else set.add(sq2);
      onMarkedSquaresChange?.(Array.from(set));
    } else if (onPlyMarksChange && plyIndex !== void 0) {
      const current = plyMarks?.get(plyIndex) || [];
      const set = new Set(current);
      if (set.has(sq2)) set.delete(sq2);
      else set.add(sq2);
      onPlyMarksChange(plyIndex, Array.from(set));
    } else {
      setInternalMarksMap((prev) => {
        const m = new Map(prev);
        const set = new Set(m.get(ply) || []);
        if (set.has(sq2)) set.delete(sq2);
        else set.add(sq2);
        m.set(ply, Array.from(set));
        return m;
      });
    }
  }, [plyIndex, externalMarkedSquares, onMarkedSquaresChange, plyMarks, onPlyMarksChange]);
  const getSnappedSquare = useCallback((origSq, clientX, clientY) => {
    const activeBounds = activeBoundsRef.current ?? getCurrentBounds();
    if (!activeBounds) return void 0;
    const origF = origSq.charCodeAt(0) - 97;
    const origR = parseInt(origSq[1]) - 1;
    let bestSq;
    let bestDist = Infinity;
    for (let f = 0; f < 8; f++) {
      for (let r = 0; r < 8; r++) {
        if (f === origF && r === origR) continue;
        const df = Math.abs(f - origF);
        const dr = Math.abs(r - origR);
        const isKnight = df === 1 && dr === 2 || df === 2 && dr === 1;
        const isQueen = df === 0 || dr === 0 || df === dr;
        if (!isKnight && !isQueen) continue;
        const col = asWhite ? f : 7 - f;
        const row = asWhite ? 7 - r : r;
        const cx = activeBounds.left + (col + 0.5) * activeBounds.width / 8;
        const cy = activeBounds.top + (row + 0.5) * activeBounds.height / 8;
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
  }, [asWhite, getCurrentBounds]);
  const handlePointerDown = useCallback((e) => {
    const nativeEvent = e.nativeEvent;
    const isTouch = "touches" in nativeEvent;
    isTouchRef.current = isTouch;
    if (isTouch) {
      lastTouchTsRef.current = Date.now();
    } else if (Date.now() - lastTouchTsRef.current < TOUCH_MOUSE_SUPPRESS_MS) {
      return;
    }
    const activeBounds = getCurrentBounds();
    if (!activeBounds) return;
    if (pendingPromotion) return;
    activeBoundsRef.current = activeBounds;
    const sq2 = getSquareFromEvent(nativeEvent, asWhite, activeBounds);
    if (!sq2) return;
    if ("button" in e && isRightButton(e)) {
      if (allowDrawingArrows) {
        e.preventDefault();
        arrowStartRef.current = sq2;
        arrowColorRef.current = eventBrushColor(nativeEvent, brushes);
        const pos2 = getClientPos(nativeEvent);
        arrowPosRef.current = pos2 ?? null;
        attachDocListeners(blockTouchScroll ?? false);
      }
      return;
    }
    const piece = piecesRef.current.get(sq2);
    const pos = getClientPos(nativeEvent);
    if (!pos) return;
    let startedDragCandidate = false;
    if (piece && interactive && allowDragging) {
      const canMove = canMoveColor(piece.color);
      const canPremove = canPremoveColor(piece.color);
      if (canMove || canPremove) {
        dragKeyChangedRef.current = false;
        const newDrag = {
          origSquare: sq2,
          piece,
          startPos: pos,
          currentPos: pos,
          started: false,
          isTouch
        };
        dragRef.current = newDrag;
        setDrag(newDrag);
        startedDragCandidate = true;
        attachDocListeners(blockTouchScroll ?? false);
      }
    }
    if (blockTouchScroll && "touches" in e && piece) {
      e.preventDefault();
    }
    if (!startedDragCandidate) {
      handleSquareInteraction(sq2);
    }
  }, [
    getCurrentBounds,
    pendingPromotion,
    asWhite,
    interactive,
    allowDragging,
    allowDrawingArrows,
    handleSquareInteraction,
    brushes,
    canMoveColor,
    canPremoveColor,
    blockTouchScroll,
    attachDocListeners
  ]);
  useEffect(() => {
    const handleMove = (e) => {
      const pos = getClientPos(e);
      if (!pos) return;
      if (arrowStartRef.current) {
        arrowPosRef.current = pos;
        const arrowBounds = activeBoundsRef.current ?? getCurrentBounds();
        if (arrowBounds) {
          const startSq = arrowStartRef.current;
          const rawSq = screenPos2square(pos[0], pos[1], asWhite, arrowBounds);
          let endSq;
          if (!rawSq || rawSq === startSq) {
            endSq = void 0;
          } else if (snapArrowsToValidMoves) {
            endSq = getSnappedSquare(startSq, pos[0], pos[1]);
          } else {
            endSq = rawSq;
          }
          const next = endSq && endSq !== startSq ? { startSquare: startSq, endSquare: endSq, color: arrowColorRef.current } : null;
          const prev = drawingArrowRef.current;
          if (prev?.startSquare !== next?.startSquare || prev?.endSquare !== next?.endSquare || prev?.color !== next?.color) {
            drawingArrowRef.current = next;
            setDrawingArrow(next);
          }
        }
      }
      if (blockTouchScroll && "touches" in e && (arrowStartRef.current || dragRef.current)) {
        e.preventDefault();
      }
      let dragStartedSquare = null;
      if (dragRef.current) {
        dragRef.current.currentPos = pos;
        if (!dragRef.current.started && hasDragStarted(dragRef.current, isTouchRef.current)) {
          dragRef.current.started = true;
          dragStartedSquare = dragRef.current.origSquare;
          setDrag({ ...dragRef.current });
        }
        const activeBounds = activeBoundsRef.current ?? getCurrentBounds();
        if (dragRef.current.started && activeBounds) {
          const currentSq = screenPos2square(pos[0], pos[1], asWhite, activeBounds);
          if (currentSq && currentSq !== dragRef.current.origSquare) {
            dragKeyChangedRef.current = true;
          }
          const origSq = dragRef.current.origSquare;
          setDragHoverSquare((prev) => {
            const next = currentSq && currentSq !== origSq ? currentSq : null;
            return prev === next ? prev : next;
          });
          if (dragGhostRef.current) {
            const squareSize = activeBounds.width / 8;
            const offset = squareSize / 2;
            dragGhostRef.current.style.transform = `translate(${pos[0] - offset}px, ${pos[1] - offset}px)`;
          }
        }
      }
      if (dragStartedSquare) {
        const piece = piecesRef.current.get(dragStartedSquare);
        if (!piece) return;
        if (canMoveColor(piece.color)) {
          const targets = getDestsForSquare(dragStartedSquare);
          if (targets.length > 0 || !dests) {
            setSelectedSquare((prev) => prev === dragStartedSquare ? prev : dragStartedSquare);
            setLegalSquares((prev) => sameSquares(prev, targets) ? prev : targets);
            setPremoveSquares((prev) => prev.length === 0 ? prev : EMPTY_SQUARES);
            return;
          }
        }
        if (canPremoveColor(piece.color)) {
          const pmTargets = premoveDests(dragStartedSquare, piecesRef.current, piece.color);
          if (pmTargets.length > 0) {
            setSelectedSquare((prev) => prev === dragStartedSquare ? prev : dragStartedSquare);
            setLegalSquares((prev) => prev.length === 0 ? prev : EMPTY_SQUARES);
            setPremoveSquares((prev) => sameSquares(prev, pmTargets) ? prev : pmTargets);
          }
        }
      }
    };
    const handleUp = (e) => {
      const releaseBounds = activeBoundsRef.current ?? getCurrentBounds();
      if ("button" in e && isRightButton(e) && arrowStartRef.current && releaseBounds) {
        const startSq = arrowStartRef.current;
        const color = arrowColorRef.current;
        const pos = arrowPosRef.current || getClientPos(e);
        arrowStartRef.current = null;
        arrowPosRef.current = null;
        if (drawingArrowRef.current) {
          drawingArrowRef.current = null;
          setDrawingArrow(null);
        }
        if (pos) {
          const rawSq = screenPos2square(pos[0], pos[1], asWhite, releaseBounds);
          if (rawSq === startSq || !rawSq) {
            toggleMark(startSq);
          } else if (snapArrowsToValidMoves) {
            const snapped = getSnappedSquare(startSq, pos[0], pos[1]);
            if (snapped && snapped !== startSq) {
              toggleArrow(startSq, snapped, color);
              justDrewArrowRef.current = true;
              setTimeout(() => {
                justDrewArrowRef.current = false;
              }, 150);
            }
          } else {
            toggleArrow(startSq, rawSq, color);
            justDrewArrowRef.current = true;
            setTimeout(() => {
              justDrewArrowRef.current = false;
            }, 150);
          }
        }
        activeBoundsRef.current = null;
        return;
      }
      const capturedDrag = dragRef.current;
      activeBoundsRef.current = null;
      setDrag(null);
      dragRef.current = null;
      setDragHoverSquare(null);
      if (capturedDrag && !capturedDrag.started) {
        handleSquareInteraction(capturedDrag.origSquare);
        return;
      }
      queueMicrotask(() => {
        if (!capturedDrag) return;
        const freshBounds = getCurrentBounds() ?? releaseBounds;
        if (!freshBounds || !interactive) return;
        const pos = getClientPos(e);
        const target = pos ? screenPos2square(pos[0], pos[1], asWhite, freshBounds) : void 0;
        if (target && target !== capturedDrag.origSquare) {
          const piece = piecesRef.current.get(capturedDrag.origSquare);
          if (piece) {
            if (canMoveColor(piece.color)) {
              const result = attemptMove(capturedDrag.origSquare, target);
              if (result === "pending" || result) return;
            }
            if (canPremoveColor(piece.color)) {
              const pmDests = premoveDests(capturedDrag.origSquare, piecesRef.current, piece.color);
              if (pmDests.includes(target)) {
                attemptPremove(capturedDrag.origSquare, target);
                return;
              }
            }
          }
        } else if (capturedDrag.origSquare === target || !target) {
          if (dragKeyChangedRef.current) {
            setSelectedSquare(null);
            setLegalSquares(EMPTY_SQUARES);
            setPremoveSquares(EMPTY_SQUARES);
          }
        }
      });
    };
    docMoveHandlerRef.current = handleMove;
    docUpHandlerRef.current = handleUp;
  }, [
    getCurrentBounds,
    asWhite,
    interactive,
    attemptMove,
    attemptPremove,
    toggleArrow,
    toggleMark,
    getSnappedSquare,
    snapArrowsToValidMoves,
    canMoveColor,
    canPremoveColor,
    blockTouchScroll,
    getDestsForSquare,
    dests,
    handleSquareInteraction
  ]);
  useEffect(() => {
    return () => detachDocListeners();
  }, [detachDocListeners]);
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const handler = (e) => e.preventDefault();
    el.addEventListener("contextmenu", handler);
    return () => el.removeEventListener("contextmenu", handler);
  }, [boardRef]);
  const activeMarkedSquares = useMemo(() => {
    if (externalMarkedSquares !== void 0) {
      return Object.fromEntries(externalMarkedSquares.map((s) => [s, true]));
    }
    const ply = plyIndex ?? 0;
    const marks = (plyMarks && plyIndex !== void 0 ? plyMarks.get(plyIndex) : void 0) || internalMarksMap.get(ply) || [];
    return Object.fromEntries(marks.map((s) => [s, true]));
  }, [externalMarkedSquares, plyIndex, plyMarks, internalMarksMap]);
  const renderedArrows = useMemo(() => {
    const final = [];
    const seen = /* @__PURE__ */ new Set();
    const ply = plyIndex ?? 0;
    const lists = [];
    if (plyArrows && plyIndex !== void 0) {
      lists.push(plyArrows.get(plyIndex) || []);
      lists.push(arrows);
    } else if (onArrowsChange) {
      lists.push(arrows);
    } else {
      lists.push(internalArrowsMap.get(ply) || []);
      lists.push(arrows);
    }
    for (const list of lists) {
      for (const a of list) {
        const k = `${a.startSquare}-${a.endSquare}`;
        if (!seen.has(k)) {
          final.push(a);
          seen.add(k);
        }
      }
    }
    if (drawingArrow) {
      const k = `${drawingArrow.startSquare}-${drawingArrow.endSquare}`;
      if (!seen.has(k)) final.push(drawingArrow);
    }
    return final;
  }, [arrows, plyIndex, plyArrows, internalArrowsMap, onArrowsChange, drawingArrow]);
  const handlePromotionSelect = useCallback((piece) => {
    if (!pendingPromotion) return;
    setPendingPromotion(null);
    attemptMove(pendingPromotion.from, pendingPromotion.to, piece);
  }, [pendingPromotion, attemptMove]);
  const handlePromotionDismiss = useCallback(() => {
    clearSelection();
  }, [clearSelection]);
  return {
    selectedSquare,
    legalSquares,
    premoveSquares,
    premoveCurrent,
    pendingPromotion,
    drag: drag?.started ? drag : null,
    dragHoverSquare,
    dragGhostRef,
    activeMarkedSquares,
    renderedArrows,
    clearSelection,
    handlePointerDown,
    handlePromotionSelect,
    handlePromotionDismiss
  };
}
function useKeyboard(opts) {
  useEffect(() => {
    const handler = (e) => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) {
        return;
      }
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          e.stopPropagation();
          opts.onPrevious?.();
          break;
        case "ArrowRight":
          e.preventDefault();
          e.stopPropagation();
          opts.onNext?.();
          break;
        case "ArrowUp":
        case "Home":
          e.preventDefault();
          e.stopPropagation();
          opts.onFirst?.();
          break;
        case "ArrowDown":
        case "End":
          e.preventDefault();
          e.stopPropagation();
          opts.onLast?.();
          break;
        case "f":
        case "F":
          e.preventDefault();
          opts.onFlipBoard?.();
          break;
        case "x":
        case "X":
          e.preventDefault();
          opts.onShowThreat?.();
          break;
        case "Escape":
          e.preventDefault();
          opts.onDeselect?.();
          break;
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [opts.onPrevious, opts.onNext, opts.onFirst, opts.onLast, opts.onFlipBoard, opts.onShowThreat, opts.onDeselect]);
}

// src/utils/colors.ts
function hexToRgba(hex, alpha) {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}
var DEFAULT_SQUARE_VISUALS = {
  markOverlay: "rgba(235, 64, 52, 0.65)",
  markOutline: "rgba(235, 64, 52, 0.9)",
  selectedOutline: "rgba(255, 255, 255, 0.95)",
  legalDot: "rgba(80, 37, 19, 0.65)",
  legalDotOutline: "rgba(255, 255, 255, 0.9)",
  legalCaptureRing: "rgba(80, 37, 19, 0.8)",
  premoveDot: "rgba(20, 85, 30, 0.5)",
  premoveCaptureRing: "rgba(20, 85, 30, 0.6)",
  premoveCurrent: "rgba(20, 30, 85, 0.4)",
  premoveCurrentStyle: "fill",
  premoveCurrentBorderWidth: 3,
  premoveCurrentBorderColor: "",
  checkGradient: "radial-gradient(ellipse at center, rgba(255, 0, 0, 1) 0%, rgba(231, 0, 0, 1) 25%, rgba(169, 0, 0, 0) 89%, rgba(158, 0, 0, 0) 100%)",
  selectedStyle: "fill",
  selectedBorderWidth: 4,
  legalMoveStyle: "ring",
  legalRingOuterRadius: 24,
  legalRingInnerRadius: 17,
  legalCaptureRingWidth: 3,
  legalCaptureRingShape: "square",
  legalCaptureRingCornerRadius: 14,
  dragOverHighlight: ""
};
var EMPTY_SQUARES2 = [];
var EMPTY_MARKS = {};
var EMPTY_HIGHLIGHTS = {};
var EMPTY_SQUARE_VISUALS = {};
var SquareCell = memo(function SquareCell2({
  sq: sq2,
  baseBg,
  isLastMove,
  isSelected,
  isDragHover,
  isLegal,
  isPremoveDest,
  isPremoveCurrent,
  isMarked,
  isCheck,
  isOccupied,
  customHighlight,
  highlightColor,
  selectedColor,
  dragOverColor,
  visuals
}) {
  let bg = baseBg;
  let boxShadow;
  let outline;
  let outlineOffset;
  let backgroundImage;
  let borderRadius;
  if (isLastMove) {
    bg = highlightColor;
  }
  if (customHighlight) {
    bg = customHighlight;
  }
  if (isCheck) {
    backgroundImage = visuals.checkGradient;
  }
  if (isMarked) {
    bg = visuals.markOverlay;
    outline = `2px solid ${visuals.markOutline}`;
    outlineOffset = "-2px";
  }
  if (isSelected) {
    const style = visuals.selectedStyle;
    if (style === "fill" || style === "both") {
      bg = selectedColor;
    }
    if (style === "border" || style === "both") {
      boxShadow = `inset 0 0 0 ${visuals.selectedBorderWidth}px ${visuals.selectedOutline}`;
    }
  }
  if (isDragHover) {
    bg = dragOverColor;
  }
  if (isPremoveCurrent) {
    const style = visuals.premoveCurrentStyle;
    if (style === "fill" || style === "both") {
      bg = visuals.premoveCurrent;
    }
    if (style === "dashed" || style === "both") {
      const w = visuals.premoveCurrentBorderWidth;
      const borderColor = visuals.premoveCurrentBorderColor || visuals.premoveCurrent;
      outline = `${w}px dashed ${borderColor}`;
      outlineOffset = `-${w}px`;
    }
  }
  if (isLegal) {
    if (isOccupied) {
      boxShadow = `inset 0 0 0 ${visuals.legalCaptureRingWidth}px ${visuals.legalCaptureRing}`;
      borderRadius = visuals.legalCaptureRingShape === "circle" ? "50%" : `${visuals.legalCaptureRingCornerRadius}%`;
    } else if (visuals.legalMoveStyle === "ring") {
      const inner = visuals.legalRingInnerRadius;
      const outer = visuals.legalRingOuterRadius;
      backgroundImage = `radial-gradient(circle at center, transparent 0%, transparent ${inner}%, ${visuals.legalDot} ${inner}%, ${visuals.legalDot} ${outer}%, transparent ${outer}%)`;
    } else {
      backgroundImage = `radial-gradient(circle at center, ${visuals.legalDot} 0%, ${visuals.legalDot} 15%, ${visuals.legalDotOutline} 15%, ${visuals.legalDotOutline} 19%, transparent 19%)`;
    }
  }
  if (isPremoveDest && !isLegal) {
    if (isOccupied) {
      boxShadow = `inset 0 0 0 ${visuals.legalCaptureRingWidth}px ${visuals.premoveCaptureRing}`;
      borderRadius = visuals.legalCaptureRingShape === "circle" ? "50%" : `${visuals.legalCaptureRingCornerRadius}%`;
    } else if (visuals.legalMoveStyle === "ring") {
      const inner = visuals.legalRingInnerRadius;
      const outer = visuals.legalRingOuterRadius;
      backgroundImage = `radial-gradient(circle at center, transparent 0%, transparent ${inner}%, ${visuals.premoveDot} ${inner}%, ${visuals.premoveDot} ${outer}%, transparent ${outer}%)`;
    } else {
      backgroundImage = `radial-gradient(circle at center, ${visuals.premoveDot} 0%, ${visuals.premoveDot} 15%, ${visuals.premoveDot} 19%, transparent 19%)`;
    }
  }
  return /* @__PURE__ */ jsx(
    "div",
    {
      "data-square": sq2,
      style: {
        backgroundColor: bg,
        boxShadow,
        outline,
        outlineOffset,
        backgroundImage,
        borderRadius,
        position: "relative"
      }
    }
  );
});
var Squares = memo(function Squares2({
  theme,
  orientation,
  lastMove,
  selectedSquare,
  draggingSquare: _draggingSquare,
  dragHoverSquare,
  legalSquares = EMPTY_SQUARES2,
  occupiedSquares,
  premoveSquares = EMPTY_SQUARES2,
  premoveCurrent,
  markedSquares = EMPTY_MARKS,
  highlightedSquares = EMPTY_HIGHLIGHTS,
  squareVisuals = EMPTY_SQUARE_VISUALS,
  check,
  lastMoveColor
}) {
  const visuals = useMemo(
    () => ({ ...DEFAULT_SQUARE_VISUALS, ...squareVisuals }),
    [squareVisuals]
  );
  const highlightColor = lastMoveColor || hexToRgba(theme.lastMoveHighlight || "#DFAA4E", 0.5) || "rgba(223, 170, 78, 0.5)";
  const selectedColor = hexToRgba(theme.selectedPiece || "#B57340", 0.5) || "rgba(181, 115, 64, 0.5)";
  const dragOverColor = visuals.dragOverHighlight || hexToRgba(theme.selectedPiece || "#B57340", 0.35) || "rgba(181, 115, 64, 0.35)";
  const asWhite = orientation === "white";
  const legalSet = useMemo(() => new Set(legalSquares), [legalSquares]);
  const premoveSet = useMemo(() => new Set(premoveSquares), [premoveSquares]);
  const premoveCurrentSet = useMemo(() => {
    if (!premoveCurrent) return /* @__PURE__ */ new Set();
    return new Set(premoveCurrent);
  }, [premoveCurrent]);
  const squares = useMemo(() => {
    const result = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const file = asWhite ? col : 7 - col;
        const rank = asWhite ? 7 - row : row;
        const sq2 = `${FILES[file]}${RANKS[rank]}`;
        const isLight = (file + rank) % 2 !== 0;
        result.push({ sq: sq2, isLight, col, row });
      }
    }
    return result;
  }, [asWhite]);
  const lightSquare = theme.lightSquare;
  const darkSquare = theme.darkSquare;
  return /* @__PURE__ */ jsx(
    "div",
    {
      style: {
        position: "absolute",
        inset: 0,
        display: "grid",
        gridTemplateColumns: "repeat(8, 1fr)",
        gridTemplateRows: "repeat(8, 1fr)"
      },
      children: squares.map(({ sq: sq2, isLight }) => /* @__PURE__ */ jsx(
        SquareCell,
        {
          sq: sq2,
          baseBg: isLight ? lightSquare : darkSquare,
          isLastMove: lastMove?.from === sq2 || lastMove?.to === sq2,
          isSelected: selectedSquare === sq2,
          isDragHover: dragHoverSquare === sq2,
          isLegal: legalSet.has(sq2),
          isPremoveDest: premoveSet.has(sq2),
          isPremoveCurrent: premoveCurrentSet.has(sq2),
          isMarked: !!markedSquares[sq2],
          isCheck: check === sq2,
          isOccupied: !!occupiedSquares?.has(sq2),
          customHighlight: highlightedSquares[sq2],
          highlightColor,
          selectedColor,
          dragOverColor,
          visuals
        },
        sq2
      ))
    }
  );
});

// src/animation/anim.ts
function computeAnimPlan(prevPieces, nextPieces) {
  const anims = /* @__PURE__ */ new Map();
  const fadings = /* @__PURE__ */ new Map();
  const missings = [];
  const news = [];
  for (const sq2 of ALL_SQUARES) {
    const prev = prevPieces.get(sq2);
    const next = nextPieces.get(sq2);
    if (next) {
      if (prev) {
        if (!samePiece(prev, next)) {
          missings.push({ square: sq2, piece: prev });
          news.push({ square: sq2, piece: next });
        }
      } else {
        news.push({ square: sq2, piece: next });
      }
    } else if (prev) {
      missings.push({ square: sq2, piece: prev });
    }
  }
  const animedOrigs = [];
  for (const newP of news) {
    const candidates = missings.filter(
      (m) => samePiece(m.piece, newP.piece) && !animedOrigs.includes(m.square)
    );
    if (candidates.length === 0) continue;
    const newPos = square2pos(newP.square);
    candidates.sort(
      (a, b) => distanceSq(square2pos(a.square), newPos) - distanceSq(square2pos(b.square), newPos)
    );
    const closest = candidates[0];
    const fromPos = square2pos(closest.square);
    const toPos = newPos;
    const dx = fromPos[0] - toPos[0];
    const dy = fromPos[1] - toPos[1];
    anims.set(newP.square, {
      fromPos,
      toPos,
      currentX: dx,
      currentY: dy
    });
    animedOrigs.push(closest.square);
  }
  for (const m of missings) {
    if (!animedOrigs.includes(m.square)) {
      fadings.set(m.square, m.piece);
    }
  }
  return { anims, fadings };
}
var blobCache = /* @__PURE__ */ new Map();
var loadPromises = /* @__PURE__ */ new Map();
function isDirectSource(src) {
  return src.startsWith("data:") || src.startsWith("blob:");
}
async function loadAndCache(src) {
  if (isDirectSource(src)) {
    blobCache.set(src, src);
    return src;
  }
  const cached = blobCache.get(src);
  if (cached) return cached;
  const pending = loadPromises.get(src);
  if (pending) return pending;
  const promise = (async () => {
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(`${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      blobCache.set(src, url);
      return url;
    } catch {
      blobCache.set(src, src);
      return src;
    } finally {
      loadPromises.delete(src);
    }
  })();
  loadPromises.set(src, promise);
  return promise;
}
var PIECE_TYPES = ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"];
function preloadPieceSet(path) {
  for (const p of PIECE_TYPES) {
    loadAndCache(`${path}/${p.toLowerCase()}.svg`);
  }
}
var CachedPieceImg = memo(function CachedPieceImg2({
  src,
  alt
}) {
  const [imgSrc, setImgSrc] = useState(() => blobCache.get(src) || src);
  useEffect(() => {
    if (!blobCache.has(src)) {
      loadAndCache(src).then(setImgSrc);
    } else if (imgSrc !== blobCache.get(src)) {
      setImgSrc(blobCache.get(src));
    }
  }, [src, imgSrc]);
  return /* @__PURE__ */ jsx(
    "img",
    {
      src: imgSrc,
      alt,
      draggable: false,
      style: { width: "100%", height: "100%", objectFit: "contain" }
    }
  );
});

// src/defaultPieceDataUris.ts
var DEFAULT_PIECE_SVGS = {
  bb: `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 45 45" width="100%" height="100%"><g style="opacity:1;fill:none;fill-rule:evenodd;fill-opacity:1;stroke:#000000;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"><g style="fill:#000000;stroke:#000000;stroke-linecap:butt"><path d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.65,38.99 6.68,38.97 6,38 C 7.35,36.54 9,36 9,36 z"></path><path d="M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z"></path><path d="M 25 8 A 2.5 2.5 0 1 1 20,8 A 2.5 2.5 0 1 1 25 8 z"></path></g><path d="M 17.5,26 L 27.5,26 M 15,30 L 30,30 M 22.5,15.5 L 22.5,20.5 M 20,18 L 25,18" style="fill:none;stroke:#ffffff;stroke-linejoin:miter"></path></g></svg>`,
  bk: `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 45 45" width="100%" height="100%"><g style="fill:none;fill-opacity:1;fill-rule:evenodd;stroke:#000000;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"><path d="M 22.5,11.63 L 22.5,6" style="fill:none;stroke:#000000;stroke-linejoin:miter" id="path6570"></path><path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25" style="fill:#000000;fill-opacity:1;stroke-linecap:butt;stroke-linejoin:miter"></path><path d="M 12.5,37 C 18,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 20,16 10.5,13 6.5,19.5 C 3.5,25.5 12.5,30 12.5,30 L 12.5,37" style="fill:#000000;stroke:#000000"></path><path d="M 20,8 L 25,8" style="fill:none;stroke:#000000;stroke-linejoin:miter"></path><path d="M 32,29.5 C 32,29.5 40.5,25.5 38.03,19.85 C 34.15,14 25,18 22.5,24.5 L 22.5,26.6 L 22.5,24.5 C 20,18 10.85,14 6.97,19.85 C 4.5,25.5 13,29.5 13,29.5" style="fill:none;stroke:#ffffff"></path><path d="M 12.5,30 C 18,27 27,27 32.5,30 M 12.5,33.5 C 18,30.5 27,30.5 32.5,33.5 M 12.5,37 C 18,34 27,34 32.5,37" style="fill:none;stroke:#ffffff"></path></g></svg>`,
  bn: `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 45 45" width="100%" height="100%"><g style="opacity:1;fill:none;fill-opacity:1;fill-rule:evenodd;stroke:#000000;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"><path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" style="fill:#000000;stroke:#000000"></path><path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10" style="fill:#000000;stroke:#000000"></path><path d="M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z" style="fill:#ffffff;stroke:#ffffff"></path><path d="M 15 15.5 A 0.5 1.5 0 1 1 14,15.5 A 0.5 1.5 0 1 1 15 15.5 z" transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)" style="fill:#ffffff;stroke:#ffffff"></path><path d="M 24.55,10.4 L 24.1,11.85 L 24.6,12 C 27.75,13 30.25,14.49 32.5,18.75 C 34.75,23.01 35.75,29.06 35.25,39 L 35.2,39.5 L 37.45,39.5 L 37.5,39 C 38,28.94 36.62,22.15 34.25,17.66 C 31.88,13.17 28.46,11.02 25.06,10.5 L 24.55,10.4 z " style="fill:#ffffff;stroke:none"></path></g></svg>`,
  bp: `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 45 45" width="100%" height="100%"><path d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z" style="opacity:1;fill:#000000;fill-opacity:1;fill-rule:nonzero;stroke:#000000;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"></path></svg>`,
  bq: `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 45 45" width="100%" height="100%"><g style="fill:#000000;stroke:#000000;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"><path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.9 L 14,25 L 6.5,13.5 L 9,26 z" style="stroke-linecap:butt;fill:#000000"></path><path d="m 9,26 c 0,2 1.5,2 2.5,4 1,1.5 1,1 0.5,3.5 -1.5,1 -1,2.5 -1,2.5 -1.5,1.5 0,2.5 0,2.5 6.5,1 16.5,1 23,0 0,0 1.5,-1 0,-2.5 0,0 0.5,-1.5 -1,-2.5 -0.5,-2.5 -0.5,-2 0.5,-3.5 1,-2 2.5,-2 2.5,-4 -8.5,-1.5 -18.5,-1.5 -27,0 z"></path><path d="M 11.5,30 C 15,29 30,29 33.5,30"></path><path d="m 12,33.5 c 6,-1 15,-1 21,0"></path><circle cx="6" cy="12" r="2"></circle><circle cx="14" cy="9" r="2"></circle><circle cx="22.5" cy="8" r="2"></circle><circle cx="31" cy="9" r="2"></circle><circle cx="39" cy="12" r="2"></circle><path d="M 11,38.5 A 35,35 1 0 0 34,38.5" style="fill:none;stroke:#000000;stroke-linecap:butt"></path><g style="fill:none;stroke:#ffffff"><path d="M 11,29 A 35,35 1 0 1 34,29"></path><path d="M 12.5,31.5 L 32.5,31.5"></path><path d="M 11.5,34.5 A 35,35 1 0 0 33.5,34.5"></path><path d="M 10.5,37.5 A 35,35 1 0 0 34.5,37.5"></path></g></g></svg>`,
  br: `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 45 45" width="100%" height="100%"><g style="opacity:1;fill:#000000;fill-opacity:1;fill-rule:evenodd;stroke:#000000;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"><path d="M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z " style="stroke-linecap:butt"></path><path d="M 12.5,32 L 14,29.5 L 31,29.5 L 32.5,32 L 12.5,32 z " style="stroke-linecap:butt"></path><path d="M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z " style="stroke-linecap:butt"></path><path d="M 14,29.5 L 14,16.5 L 31,16.5 L 31,29.5 L 14,29.5 z " style="stroke-linecap:butt;stroke-linejoin:miter"></path><path d="M 14,16.5 L 11,14 L 34,14 L 31,16.5 L 14,16.5 z " style="stroke-linecap:butt"></path><path d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14 L 11,14 z " style="stroke-linecap:butt"></path><path d="M 12,35.5 L 33,35.5 L 33,35.5" style="fill:none;stroke:#ffffff;stroke-width:1;stroke-linejoin:miter"></path><path d="M 13,31.5 L 32,31.5" style="fill:none;stroke:#ffffff;stroke-width:1;stroke-linejoin:miter"></path><path d="M 14,29.5 L 31,29.5" style="fill:none;stroke:#ffffff;stroke-width:1;stroke-linejoin:miter"></path><path d="M 14,16.5 L 31,16.5" style="fill:none;stroke:#ffffff;stroke-width:1;stroke-linejoin:miter"></path><path d="M 11,14 L 34,14" style="fill:none;stroke:#ffffff;stroke-width:1;stroke-linejoin:miter"></path></g></svg>`,
  wb: `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 45 45" width="100%" height="100%"><g style="opacity:1;fill:none;fill-rule:evenodd;fill-opacity:1;stroke:#000000;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"><g style="fill:#ffffff;stroke:#000000;stroke-linecap:butt"><path d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.65,38.99 6.68,38.97 6,38 C 7.35,36.54 9,36 9,36 z"></path><path d="M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z"></path><path d="M 25 8 A 2.5 2.5 0 1 1 20,8 A 2.5 2.5 0 1 1 25 8 z"></path></g><path d="M 17.5,26 L 27.5,26 M 15,30 L 30,30 M 22.5,15.5 L 22.5,20.5 M 20,18 L 25,18" style="fill:none;stroke:#000000;stroke-linejoin:miter"></path></g></svg>`,
  wk: `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 45 45" width="100%" height="100%"><g style="fill:none;fill-opacity:1;fill-rule:evenodd;stroke:#000000;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"><path d="M 22.5,11.63 L 22.5,6" style="fill:none;stroke:#000000;stroke-linejoin:miter"></path><path d="M 20,8 L 25,8" style="fill:none;stroke:#000000;stroke-linejoin:miter"></path><path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25" style="fill:#ffffff;stroke:#000000;stroke-linecap:butt;stroke-linejoin:miter"></path><path d="M 12.5,37 C 18,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 20,16 10.5,13 6.5,19.5 C 3.5,25.5 12.5,30 12.5,30 L 12.5,37" style="fill:#ffffff;stroke:#000000"></path><path d="M 12.5,30 C 18,27 27,27 32.5,30" style="fill:none;stroke:#000000"></path><path d="M 12.5,33.5 C 18,30.5 27,30.5 32.5,33.5" style="fill:none;stroke:#000000"></path><path d="M 12.5,37 C 18,34 27,34 32.5,37" style="fill:none;stroke:#000000"></path></g></svg>`,
  wn: `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 45 45" width="100%" height="100%"><g style="opacity:1;fill:none;fill-opacity:1;fill-rule:evenodd;stroke:#000000;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"><path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" style="fill:#ffffff;stroke:#000000"></path><path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10" style="fill:#ffffff;stroke:#000000"></path><path d="M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z" style="fill:#000000;stroke:#000000"></path><path d="M 15 15.5 A 0.5 1.5 0 1 1 14,15.5 A 0.5 1.5 0 1 1 15 15.5 z" transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)" style="fill:#000000;stroke:#000000"></path></g></svg>`,
  wp: `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 45 45" width="100%" height="100%"><path d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z" style="opacity:1;fill:#ffffff;fill-opacity:1;fill-rule:nonzero;stroke:#000000;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"></path></svg>`,
  wq: `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 45 45" width="100%" height="100%"><g style="fill:#ffffff;stroke:#000000;stroke-width:1.5;stroke-linejoin:round"><path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.9 L 14,25 L 6.5,13.5 L 9,26 z"></path><path d="M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 11,36 11,36 C 9.5,37.5 11,38.5 11,38.5 C 17.5,39.5 27.5,39.5 34,38.5 C 34,38.5 35.5,37.5 34,36 C 34,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 C 27.5,24.5 17.5,24.5 9,26 z"></path><path d="M 11.5,30 C 15,29 30,29 33.5,30" style="fill:none"></path><path d="M 12,33.5 C 18,32.5 27,32.5 33,33.5" style="fill:none"></path><circle cx="6" cy="12" r="2"></circle><circle cx="14" cy="9" r="2"></circle><circle cx="22.5" cy="8" r="2"></circle><circle cx="31" cy="9" r="2"></circle><circle cx="39" cy="12" r="2"></circle></g></svg>`,
  wr: `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 45 45" width="100%" height="100%"><g style="opacity:1;fill:#ffffff;fill-opacity:1;fill-rule:evenodd;stroke:#000000;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"><path d="M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z " style="stroke-linecap:butt"></path><path d="M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z " style="stroke-linecap:butt"></path><path d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14" style="stroke-linecap:butt"></path><path d="M 34,14 L 31,17 L 14,17 L 11,14"></path><path d="M 31,17 L 31,29.5 L 14,29.5 L 14,17" style="stroke-linecap:butt;stroke-linejoin:miter"></path><path d="M 31,29.5 L 32.5,32 L 12.5,32 L 14,29.5"></path><path d="M 11,14 L 34,14" style="fill:none;stroke:#000000;stroke-linejoin:miter"></path></g></svg>`
};
function svgToDataUri(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
var DEFAULT_PIECE_DATA_URIS = {
  bb: svgToDataUri(DEFAULT_PIECE_SVGS.bb),
  bk: svgToDataUri(DEFAULT_PIECE_SVGS.bk),
  bn: svgToDataUri(DEFAULT_PIECE_SVGS.bn),
  bp: svgToDataUri(DEFAULT_PIECE_SVGS.bp),
  bq: svgToDataUri(DEFAULT_PIECE_SVGS.bq),
  br: svgToDataUri(DEFAULT_PIECE_SVGS.br),
  wb: svgToDataUri(DEFAULT_PIECE_SVGS.wb),
  wk: svgToDataUri(DEFAULT_PIECE_SVGS.wk),
  wn: svgToDataUri(DEFAULT_PIECE_SVGS.wn),
  wp: svgToDataUri(DEFAULT_PIECE_SVGS.wp),
  wq: svgToDataUri(DEFAULT_PIECE_SVGS.wq),
  wr: svgToDataUri(DEFAULT_PIECE_SVGS.wr)
};

// src/defaultPieces.ts
var DEFAULT_PIECE_SOURCES = DEFAULT_PIECE_DATA_URIS;
function resolvePieceImageSrc(pieceKey, piecePath) {
  const normalized = pieceKey.toLowerCase();
  if (piecePath) return `${piecePath}/${normalized}.svg`;
  return DEFAULT_PIECE_SOURCES[normalized] ?? DEFAULT_PIECE_SOURCES.wq;
}
var PieceGlyph = memo(function PieceGlyph2({
  pieceKey,
  pieceSet,
  customPieces
}) {
  if (customPieces?.[pieceKey]) {
    return customPieces[pieceKey]();
  }
  const src = resolvePieceImageSrc(pieceKey, pieceSet?.path);
  return /* @__PURE__ */ jsx(CachedPieceImg, { src, alt: pieceKey });
});
function easing(t) {
  return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}
function squareColRow(sq2, asWhite) {
  const f = sq2.charCodeAt(0) - 97;
  const r = sq2.charCodeAt(1) - 49;
  return [asWhite ? f : 7 - f, asWhite ? 7 - r : r];
}
function baseTransform(col, row) {
  return `translate(${col * 100}%, ${row * 100}%)`;
}
var PiecesLayer = memo(forwardRef(function PiecesLayer2({
  position,
  pieces,
  orientation,
  pieceSet,
  customPieces,
  flipPieces = false,
  animationDurationMs,
  showAnimations,
  draggingSquare,
  selectedSquare,
  selectedPieceScale
}, ref) {
  const asWhite = orientation === "white";
  const piecePath = pieceSet?.path;
  const currentPos = position || INITIAL_FEN;
  const skipNextAnimRef = useRef(false);
  const prevDraggingRef = useRef(draggingSquare);
  const prevPositionRef = useRef(currentPos);
  const prevPiecesRef = useRef(pieces);
  const rafIdRef = useRef(null);
  const pieceElsRef = useRef(/* @__PURE__ */ new Map());
  const fadingElsRef = useRef(/* @__PURE__ */ new Map());
  const refCallbacksRef = useRef(/* @__PURE__ */ new Map());
  const fadingRefCallbacksRef = useRef(/* @__PURE__ */ new Map());
  const animRef = useRef(null);
  const [fadings, setFadings] = useState([]);
  useImperativeHandle(ref, () => ({
    getPieceElement(square) {
      return pieceElsRef.current.get(square) ?? null;
    }
  }), []);
  useEffect(() => {
    if (piecePath) preloadPieceSet(piecePath);
  }, [piecePath]);
  const syncTransforms = useCallback(() => {
    const anim = animRef.current;
    let ease = 0;
    if (anim) {
      const elapsed = performance.now() - anim.startTime;
      const rest = 1 - elapsed * anim.frequency;
      if (rest <= 0) {
        animRef.current = null;
      } else {
        ease = easing(rest);
      }
    }
    const currentAnim = animRef.current;
    const mult = asWhite ? 1 : -1;
    for (const [sq2, el] of pieceElsRef.current) {
      const [col, row] = squareColRow(sq2, asWhite);
      const vec = currentAnim?.plan.anims.get(sq2);
      if (vec) {
        let x = col + mult * (vec.fromPos[0] - vec.toPos[0]) * ease;
        let y = row - mult * (vec.fromPos[1] - vec.toPos[1]) * ease;
        x = Math.max(0, Math.min(7, x));
        y = Math.max(0, Math.min(7, y));
        el.style.transform = `translate(${x * 100}%, ${y * 100}%)`;
        el.style.zIndex = "8";
        el.style.willChange = "transform";
      } else {
        el.style.transform = baseTransform(col, row);
        el.style.zIndex = "2";
        el.style.willChange = "";
      }
    }
    return !!animRef.current;
  }, [asWhite]);
  const stepFrame = useCallback(() => {
    const anim = animRef.current;
    if (!anim) return false;
    const elapsed = performance.now() - anim.startTime;
    const rest = 1 - elapsed * anim.frequency;
    if (rest <= 0) {
      animRef.current = null;
      for (const sq2 of anim.plan.anims.keys()) {
        const el = pieceElsRef.current.get(sq2);
        if (el) {
          const [col, row] = squareColRow(sq2, asWhite);
          el.style.transform = baseTransform(col, row);
          el.style.zIndex = "2";
          el.style.willChange = "";
        }
      }
      if (anim.plan.fadings.size > 0) {
        setFadings((prev) => prev.length === 0 ? prev : []);
      }
      return false;
    }
    const ease = easing(rest);
    const mult = asWhite ? 1 : -1;
    for (const [sq2, vec] of anim.plan.anims) {
      const el = pieceElsRef.current.get(sq2);
      if (!el) continue;
      const [col, row] = squareColRow(sq2, asWhite);
      let x = col + mult * (vec.fromPos[0] - vec.toPos[0]) * ease;
      let y = row - mult * (vec.fromPos[1] - vec.toPos[1]) * ease;
      x = Math.max(0, Math.min(7, x));
      y = Math.max(0, Math.min(7, y));
      el.style.transform = `translate(${x * 100}%, ${y * 100}%)`;
    }
    for (const sq2 of anim.plan.fadings.keys()) {
      const el = fadingElsRef.current.get(sq2);
      if (el) el.style.opacity = String(ease);
    }
    return true;
  }, [asWhite]);
  const animLoop = useCallback(() => {
    if (stepFrame()) {
      rafIdRef.current = requestAnimationFrame(animLoop);
    } else {
      rafIdRef.current = null;
    }
  }, [stepFrame]);
  useLayoutEffect(() => {
    if (prevDraggingRef.current && !draggingSquare) {
      skipNextAnimRef.current = true;
    }
    prevDraggingRef.current = draggingSquare;
    const prevPos = prevPositionRef.current;
    const positionChanged = currentPos !== prevPos;
    let nextPlan = null;
    if (positionChanged) {
      if (skipNextAnimRef.current) {
        skipNextAnimRef.current = false;
      } else if (showAnimations && animationDurationMs >= 50) {
        const plan = computeAnimPlan(prevPiecesRef.current, pieces);
        if (plan.anims.size > 0) {
          nextPlan = plan;
        }
      }
      prevPositionRef.current = currentPos;
      prevPiecesRef.current = pieces;
    }
    if (nextPlan) {
      animRef.current = {
        plan: nextPlan,
        startTime: performance.now(),
        frequency: 1 / animationDurationMs
      };
      const nextFadings = [];
      for (const [square, piece] of nextPlan.fadings) {
        nextFadings.push({ square, piece });
      }
      setFadings((prev) => prev.length === 0 && nextFadings.length === 0 ? prev : nextFadings);
    } else if (positionChanged || !showAnimations || animationDurationMs < 50) {
      animRef.current = null;
      setFadings((prev) => prev.length === 0 ? prev : []);
    }
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    const stillAnimating = syncTransforms();
    if (stillAnimating) {
      rafIdRef.current = requestAnimationFrame(animLoop);
    }
  }, [
    currentPos,
    pieces,
    draggingSquare,
    showAnimations,
    animationDurationMs,
    syncTransforms,
    animLoop
  ]);
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);
  const pieceStates = useMemo(() => {
    const states = [];
    for (const [square, piece] of pieces) {
      states.push({
        square,
        piece,
        dragging: draggingSquare === square,
        selected: selectedSquare === square
      });
    }
    return states;
  }, [pieces, draggingSquare, selectedSquare]);
  const setRef = useCallback((square) => {
    let cb = refCallbacksRef.current.get(square);
    if (!cb) {
      cb = (el) => {
        if (el) {
          pieceElsRef.current.set(square, el);
        } else {
          pieceElsRef.current.delete(square);
        }
      };
      refCallbacksRef.current.set(square, cb);
    }
    return cb;
  }, []);
  const setFadingRef = useCallback((square) => {
    let cb = fadingRefCallbacksRef.current.get(square);
    if (!cb) {
      cb = (el) => {
        if (el) {
          fadingElsRef.current.set(square, el);
        } else {
          fadingElsRef.current.delete(square);
        }
      };
      fadingRefCallbacksRef.current.set(square, cb);
    }
    return cb;
  }, []);
  const pieceRotation = flipPieces ? "rotate(180deg)" : "";
  return /* @__PURE__ */ jsxs("div", { style: { position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }, children: [
    fadings.map((f) => {
      const [col, row] = squareColRow(f.square, asWhite);
      return /* @__PURE__ */ jsx(
        "div",
        {
          ref: setFadingRef(f.square),
          style: {
            position: "absolute",
            width: "12.5%",
            height: "12.5%",
            transform: baseTransform(col, row),
            opacity: 1,
            zIndex: 1,
            pointerEvents: "none"
          },
          children: /* @__PURE__ */ jsx(
            "div",
            {
              style: {
                transform: pieceRotation || void 0,
                width: "100%",
                height: "100%"
              },
              children: /* @__PURE__ */ jsx(
                PieceGlyph,
                {
                  pieceKey: `${f.piece.color}${f.piece.role.toUpperCase()}`,
                  pieceSet,
                  customPieces
                }
              )
            }
          )
        },
        `fade-${f.square}-${f.piece.color}${f.piece.role}`
      );
    }),
    pieceStates.map((ps) => {
      const [col, row] = squareColRow(ps.square, asWhite);
      return /* @__PURE__ */ jsx(
        "div",
        {
          ref: setRef(ps.square),
          style: {
            position: "absolute",
            width: "12.5%",
            height: "12.5%",
            transform: baseTransform(col, row),
            opacity: ps.dragging ? 0.5 : 1,
            zIndex: ps.dragging ? 1 : 2,
            pointerEvents: "none"
          },
          children: /* @__PURE__ */ jsx(
            "div",
            {
              style: {
                transition: "transform 0.15s ease-out",
                transform: [
                  pieceRotation,
                  ps.selected && selectedPieceScale ? `scale(${selectedPieceScale})` : ""
                ].filter(Boolean).join(" ") || void 0,
                transformOrigin: "center center",
                width: "100%",
                height: "100%"
              },
              children: /* @__PURE__ */ jsx(
                PieceGlyph,
                {
                  pieceKey: `${ps.piece.color}${ps.piece.role.toUpperCase()}`,
                  pieceSet,
                  customPieces
                }
              )
            }
          )
        },
        `${ps.square}-${ps.piece.color}${ps.piece.role}`
      );
    })
  ] });
}));
function squareColRow2(sq2, asWhite) {
  const f = sq2.charCodeAt(0) - 97;
  const r = sq2.charCodeAt(1) - 49;
  return [asWhite ? f : 7 - f, asWhite ? 7 - r : r];
}
function isValidSquare(sq2) {
  return /^[a-h][1-8]$/.test(sq2);
}
var GhostPiecesLayer = memo(function GhostPiecesLayer2({
  ghosts,
  orientation,
  pieceSet,
  customPieces,
  flipPieces = false
}) {
  const asWhite = orientation === "white";
  return /* @__PURE__ */ jsx("div", { style: { position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }, children: ghosts.map((g, i) => {
    if (!isValidSquare(g.square)) return null;
    const [col, row] = squareColRow2(g.square, asWhite);
    const scale = g.scale ?? 1;
    return /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          position: "absolute",
          width: "12.5%",
          height: "12.5%",
          transform: `translate(${col * 100}%, ${row * 100}%)`,
          opacity: g.opacity ?? 0.45,
          zIndex: 1,
          pointerEvents: "none"
        },
        children: /* @__PURE__ */ jsx(
          "div",
          {
            style: {
              width: "100%",
              height: "100%",
              transform: [
                flipPieces ? "rotate(180deg)" : "",
                scale !== 1 ? `scale(${scale})` : ""
              ].filter(Boolean).join(" ") || void 0,
              transformOrigin: "center center"
            },
            children: /* @__PURE__ */ jsx(PieceGlyph, { pieceKey: g.piece, pieceSet, customPieces })
          }
        )
      },
      `ghost-${g.square}-${g.piece}-${i}`
    );
  }) });
});
function squareColRow3(sq2, asWhite) {
  const f = sq2.charCodeAt(0) - 97;
  const r = sq2.charCodeAt(1) - 49;
  return [asWhite ? f : 7 - f, asWhite ? 7 - r : r];
}
function isValidSquare2(sq2) {
  return /^[a-h][1-8]$/.test(sq2);
}
var CORNER_POSITIONS = {
  topLeft: { top: "4%", left: "4%" },
  topRight: { top: "4%", right: "4%" },
  bottomLeft: { bottom: "4%", left: "4%" },
  bottomRight: { bottom: "4%", right: "4%" },
  center: { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
};
var SquareLabelsLayer = memo(function SquareLabelsLayer2({
  labels,
  orientation
}) {
  const asWhite = orientation === "white";
  const entries = Object.entries(labels);
  if (entries.length === 0) return null;
  return /* @__PURE__ */ jsx("div", { style: { position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 6 }, children: entries.map(([sq2, raw]) => {
    if (!isValidSquare2(sq2)) return null;
    const label = typeof raw === "string" ? { text: raw } : raw;
    if (!label.text) return null;
    const [col, row] = squareColRow3(sq2, asWhite);
    const corner = label.corner ?? "topRight";
    return /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          position: "absolute",
          width: "12.5%",
          height: "12.5%",
          transform: `translate(${col * 100}%, ${row * 100}%)`,
          pointerEvents: "none"
        },
        children: /* @__PURE__ */ jsx(
          "span",
          {
            style: {
              position: "absolute",
              ...CORNER_POSITIONS[corner],
              minWidth: "1.5em",
              padding: "0.1em 0.35em",
              borderRadius: "999px",
              background: label.background ?? "rgba(15, 23, 42, 0.85)",
              color: label.color ?? "#ffffff",
              fontSize: label.fontSize ?? "clamp(9px, 1.6vmin, 13px)",
              fontWeight: 700,
              fontFamily: "system-ui, sans-serif",
              lineHeight: 1.4,
              textAlign: "center",
              whiteSpace: "nowrap",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.35)"
            },
            children: label.text
          }
        )
      },
      `label-${sq2}`
    );
  }) });
});
var DEFAULT_DEMO_DURATION_MS = 900;
var DEFAULT_LIFT_SCALE = 1.18;
var DEFAULT_PULSE_COLOR = "rgba(255, 188, 66, 0.95)";
var DEFAULT_PULSE_DURATION_MS = 700;
var DEFAULT_PULSE_TIMES = 2;
function squareColRow4(sq2, asWhite) {
  const f = sq2.charCodeAt(0) - 97;
  const r = sq2.charCodeAt(1) - 49;
  return [asWhite ? f : 7 - f, asWhite ? 7 - r : r];
}
function isValidSquare3(sq2) {
  return typeof sq2 === "string" && /^[a-h][1-8]$/.test(sq2);
}
function canAnimate(el) {
  return typeof el.animate === "function";
}
var TeachingLayer = memo(forwardRef(function TeachingLayer2({
  orientation,
  pieces,
  pieceSet,
  customPieces,
  flipPieces = false,
  getPieceElement
}, ref) {
  const asWhite = orientation === "white";
  const [demos, setDemos] = useState([]);
  const [pulses, setPulses] = useState([]);
  const demosRef = useRef(demos);
  demosRef.current = demos;
  const idRef = useRef(0);
  const piecesRef = useRef(pieces);
  piecesRef.current = pieces;
  const asWhiteRef = useRef(asWhite);
  asWhiteRef.current = asWhite;
  const demoResolversRef = useRef(/* @__PURE__ */ new Map());
  const demoAnimationsRef = useRef(/* @__PURE__ */ new Map());
  const startedRef = useRef(/* @__PURE__ */ new Set());
  const finishedRef = useRef(/* @__PURE__ */ new Set());
  const getPieceElementRef = useRef(getPieceElement);
  getPieceElementRef.current = getPieceElement;
  const finishDemo = useCallback((entry) => {
    if (finishedRef.current.has(entry.id)) return;
    finishedRef.current.add(entry.id);
    const resolve = demoResolversRef.current.get(entry.id);
    demoResolversRef.current.delete(entry.id);
    resolve?.();
    const cleanup = () => {
      demoAnimationsRef.current.delete(entry.id);
      startedRef.current.delete(entry.id);
      finishedRef.current.delete(entry.id);
      if (entry.hiddenSquare) {
        const orig = getPieceElementRef.current(entry.hiddenSquare);
        if (orig) orig.style.opacity = "";
      }
      setDemos((prev) => prev.filter((d) => d.id !== entry.id));
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => requestAnimationFrame(cleanup));
    } else {
      cleanup();
    }
  }, []);
  const startDemoAnimation = useCallback((el, entry) => {
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
        { transform: `${toT} scale(1)` }
      ],
      { duration: Math.max(50, entry.durationMs), easing: "ease-in-out", fill: "forwards" }
    );
    demoAnimationsRef.current.set(entry.id, glide);
    glide.oncancel = () => finishDemo(entry);
    glide.onfinish = () => {
      if (entry.ghost) {
        const fade = el.animate(
          [{ opacity: String(entry.ghostOpacity) }, { opacity: "0" }],
          { duration: 200, easing: "ease-out", fill: "forwards" }
        );
        demoAnimationsRef.current.set(entry.id, fade);
        fade.onfinish = () => finishDemo(entry);
        fade.oncancel = () => finishDemo(entry);
      } else {
        finishDemo(entry);
      }
    };
  }, [finishDemo]);
  const animateMove = useCallback((from, to, options) => {
    if (!isValidSquare3(from) || !isValidSquare3(to) || from === to) {
      return Promise.resolve();
    }
    const existing = piecesRef.current.get(from);
    const pieceKey = options?.piece ?? (existing ? `${existing.color}${existing.role.toUpperCase()}` : void 0);
    if (!pieceKey) return Promise.resolve();
    const ghost = options?.ghost ?? false;
    const hideOriginal = !ghost && (options?.hideOriginal ?? true) && !!existing;
    const white = asWhiteRef.current;
    const [fromCol, fromRow] = squareColRow4(from, white);
    const [toCol, toRow] = squareColRow4(to, white);
    const entry = {
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
      hiddenSquare: hideOriginal ? from : null
    };
    if (entry.hiddenSquare) {
      const orig = getPieceElementRef.current(entry.hiddenSquare);
      if (orig) orig.style.opacity = "0";
    }
    return new Promise((resolve) => {
      demoResolversRef.current.set(entry.id, resolve);
      setDemos((prev) => [...prev, entry]);
    });
  }, []);
  const pulseSquare = useCallback((square, options) => {
    if (!isValidSquare3(square)) return Promise.resolve();
    const [col, row] = squareColRow4(square, asWhiteRef.current);
    const entry = {
      id: ++idRef.current,
      col,
      row,
      color: options?.color ?? DEFAULT_PULSE_COLOR,
      durationMs: options?.durationMs ?? DEFAULT_PULSE_DURATION_MS,
      times: Math.max(1, options?.times ?? DEFAULT_PULSE_TIMES)
    };
    return new Promise((resolve) => {
      demoResolversRef.current.set(entry.id, resolve);
      setPulses((prev) => [...prev, entry]);
    });
  }, []);
  const finishPulse = useCallback((id) => {
    startedRef.current.delete(id);
    const resolve = demoResolversRef.current.get(id);
    demoResolversRef.current.delete(id);
    setPulses((prev) => prev.filter((p) => p.id !== id));
    resolve?.();
  }, []);
  const startPulseAnimation = useCallback((el, entry) => {
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);
    if (!canAnimate(el)) {
      finishPulse(entry.id);
      return;
    }
    const anim = el.animate(
      [
        { opacity: "0", transform: "scale(0.55)" },
        { opacity: "1", transform: "scale(0.92)", offset: 0.35 },
        { opacity: "0", transform: "scale(1.28)" }
      ],
      {
        duration: Math.max(150, entry.durationMs),
        iterations: entry.times,
        easing: "ease-out"
      }
    );
    anim.onfinish = () => finishPulse(entry.id);
    anim.oncancel = () => finishPulse(entry.id);
  }, [finishPulse]);
  const shakePiece = useCallback((square) => {
    if (!isValidSquare3(square)) return Promise.resolve();
    const outer = getPieceElementRef.current(square);
    const inner = outer?.firstElementChild;
    if (!inner || !canAnimate(inner)) return Promise.resolve();
    return new Promise((resolve) => {
      const anim = inner.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-9%)" },
          { transform: "translateX(9%)" },
          { transform: "translateX(-6%)" },
          { transform: "translateX(6%)" },
          { transform: "translateX(-3%)" },
          { transform: "translateX(0)" }
        ],
        { duration: 420, easing: "ease-in-out" }
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
        if (orig) orig.style.opacity = "";
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
    clearEffects
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
  return /* @__PURE__ */ jsxs("div", { style: { position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 9 }, children: [
    pulses.map((p) => /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          position: "absolute",
          width: "12.5%",
          height: "12.5%",
          transform: `translate(${p.col * 100}%, ${p.row * 100}%)`,
          pointerEvents: "none"
        },
        children: /* @__PURE__ */ jsx(
          "div",
          {
            ref: (el) => {
              if (el) startPulseAnimation(el, p);
            },
            style: {
              position: "absolute",
              inset: "6%",
              borderRadius: "50%",
              border: `3px solid ${p.color}`,
              boxShadow: `0 0 12px 1px ${p.color}`,
              opacity: 0
            }
          }
        )
      },
      `pulse-${p.id}`
    )),
    demos.map((d) => /* @__PURE__ */ jsx(
      "div",
      {
        ref: (el) => {
          if (el) startDemoAnimation(el, d);
        },
        style: {
          position: "absolute",
          width: "12.5%",
          height: "12.5%",
          transform: `translate(${d.fromCol * 100}%, ${d.fromRow * 100}%)`,
          opacity: d.ghost ? d.ghostOpacity : 1,
          willChange: "transform",
          pointerEvents: "none",
          filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.28))"
        },
        children: /* @__PURE__ */ jsx(
          "div",
          {
            style: {
              width: "100%",
              height: "100%",
              transform: flipPieces ? "rotate(180deg)" : void 0,
              transformOrigin: "center center"
            },
            children: /* @__PURE__ */ jsx(PieceGlyph, { pieceKey: d.pieceKey, pieceSet, customPieces })
          }
        )
      },
      `demo-${d.id}`
    ))
  ] });
}));

// src/cinematics/motion.ts
function canAnimate2(el) {
  return typeof el.animate === "function";
}
function waitForAnimation(anim, fallbackMs) {
  if (!anim) {
    return new Promise((resolve) => setTimeout(resolve, fallbackMs));
  }
  return new Promise((resolve) => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      resolve();
    };
    const watchdog = setTimeout(settle, fallbackMs * 2 + 1e3);
    const finished = anim.finished;
    if (finished && typeof finished.then === "function") {
      finished.then(settle, settle);
      return;
    }
    try {
      anim.onfinish = settle;
      anim.oncancel = settle;
    } catch {
    }
  });
}
var reducedMotionQuery;
function prefersReducedMotion() {
  if (reducedMotionQuery === void 0) {
    reducedMotionQuery = typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  }
  return reducedMotionQuery?.matches ?? false;
}
var BRILLIANT_TEAL = "#26c2a3";
var DEFAULT_BURST_COLOR = "#ffd65a";
var DEFAULT_BURST_DURATION_MS = 650;
var SHOCKWAVE_DURATION_MS = 500;
var DEFAULT_BADGE_DURATION_MS = 1600;
var MOVE_BADGE_DURATION_MS = 1400;
var VICTIM_BLAST_DURATION_MS = 700;
var FLASH_DURATION_MS = 380;
var DEFAULT_CELEBRATE_DURATION_MS = 2200;
var DEFAULT_BANNER_DURATION_MS = 1800;
var DEFAULT_PROMOTION_BEAM_DURATION_MS = 1500;
var DEFAULT_PROMOTION_BEAM_COLOR = "#ffe27a";
var DEFAULT_IMPLODE_DURATION_MS = 750;
var DEFAULT_IMPLODE_COLOR = "#b07bff";
var DEFAULT_CASTLE_SWAP_DURATION_MS = 1100;
var DEFAULT_CASTLE_SWAP_GLOW = "#8fd0ff";
var DEFAULT_SPOTLIGHT_DURATION_MS = 420;
var DEFAULT_SPOTLIGHT_COLOR = "rgba(3, 7, 15, 0.74)";
var DEFAULT_SPOTLIGHT_RADIUS = 0.72;
var DEFAULT_LASER_COLOR = "#ff3b3b";
var DEFAULT_LASER_DURATION_MS = 500;
var DEFAULT_LASER_WIDTH_PX = 4;
var DEFAULT_LASER_HOLD_MS = 400;
var LASER_FADE_MS = 250;
var HEX6 = /^#[0-9a-f]{6}$/i;
var TRAIL_GAP_MS = 55;
var FLIGHT_SAMPLES = 24;
var CELEBRATE_COLORS = [BRILLIANT_TEAL, "#ffd65a", "#ff6b6b", "#5ea2d9", "#b78bff", "#7ee081"];
var SLOWMO_EXPONENT = Math.log(0.2) / Math.log(0.4);
var STYLE_PRESETS = {
  brilliant: {
    durationMs: 2e3,
    spins: 1.5,
    arcHeight: 1.6,
    liftScale: 1.35,
    glowColor: BRILLIANT_TEAL,
    glowMaxPx: 18,
    sparkles: true,
    shockwave: true,
    slowMoLanding: true,
    plunge: false,
    squash: 0.15,
    liftEnd: 0.15,
    landStart: 0.7,
    slam: false,
    trailCount: 4,
    flash: true,
    victimBlast: true,
    impactShake: { intensity: 3, durationMs: 300 }
  },
  great: {
    durationMs: 1400,
    spins: 1,
    arcHeight: 0.9,
    liftScale: 1.26,
    glowColor: "#5ea2d9",
    glowMaxPx: 10,
    sparkles: true,
    shockwave: false,
    slowMoLanding: false,
    plunge: false,
    squash: 0.12,
    liftEnd: 0.15,
    landStart: 0.72,
    slam: false,
    trailCount: 0,
    flash: false,
    victimBlast: false,
    impactShake: null
  },
  smooth: {
    durationMs: 900,
    spins: 0,
    arcHeight: 0.35,
    liftScale: 1.12,
    glowColor: "rgba(0, 0, 0, 0)",
    glowMaxPx: 0,
    sparkles: false,
    shockwave: false,
    slowMoLanding: false,
    plunge: false,
    squash: 0.04,
    liftEnd: 0.15,
    landStart: 0.85,
    slam: false,
    trailCount: 0,
    flash: false,
    victimBlast: false,
    impactShake: null
  },
  slam: {
    durationMs: 1100,
    spins: 0,
    arcHeight: 0,
    liftScale: 1.6,
    glowColor: DEFAULT_BURST_COLOR,
    glowMaxPx: 12,
    sparkles: false,
    shockwave: true,
    slowMoLanding: false,
    plunge: false,
    squash: 0.3,
    liftEnd: 0.25,
    landStart: 0.7,
    slam: true,
    trailCount: 0,
    flash: true,
    victimBlast: true,
    impactShake: { intensity: 7, durationMs: 380 }
  },
  meteor: {
    durationMs: 2e3,
    spins: 2,
    arcHeight: 2.6,
    liftScale: 1.5,
    glowColor: "#ff7a3d",
    glowMaxPx: 26,
    sparkles: true,
    shockwave: true,
    slowMoLanding: false,
    plunge: true,
    squash: 0.28,
    liftEnd: 0.12,
    landStart: 0.72,
    slam: false,
    trailCount: 5,
    flash: true,
    victimBlast: true,
    impactShake: { intensity: 9, durationMs: 450 }
  }
};
function squareColRow5(sq2, asWhite) {
  const f = sq2.charCodeAt(0) - 97;
  const r = sq2.charCodeAt(1) - 49;
  return [asWhite ? f : 7 - f, asWhite ? 7 - r : r];
}
function isValidSquare4(sq2) {
  return typeof sq2 === "string" && /^[a-h][1-8]$/.test(sq2);
}
function positionTransform(col, row) {
  return `translate(${col * 100}%, ${row * 100}%)`;
}
function easeInOutQuad(u) {
  return u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
}
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function resolveShake(option, preset) {
  if (option === false) return null;
  if (option === void 0) return preset;
  const base = preset ?? { intensity: 5, durationMs: 350 };
  if (option === true) return base;
  return {
    intensity: option.intensity ?? base.intensity,
    durationMs: option.durationMs ?? base.durationMs
  };
}
function resolveMoveOptions(options, reduced) {
  const preset = STYLE_PRESETS[options?.style ?? "brilliant"];
  const trailOpt = options?.trail;
  const base = {
    durationMs: Math.max(100, options?.durationMs ?? preset.durationMs),
    spins: Math.max(0, options?.spins ?? preset.spins),
    arcHeight: Math.max(0, options?.arcHeight ?? preset.arcHeight),
    liftScale: options?.liftScale ?? preset.liftScale,
    glowColor: options?.glowColor ?? preset.glowColor,
    glowMaxPx: options?.glowColor ? Math.max(preset.glowMaxPx, 12) : preset.glowMaxPx,
    sparkles: options?.sparkles ?? preset.sparkles,
    shockwave: options?.shockwave ?? preset.shockwave,
    badge: options?.badge,
    badgeColor: options?.badgeColor,
    slowMoLanding: options?.slowMoLanding ?? preset.slowMoLanding,
    plunge: preset.plunge && !options?.slowMoLanding,
    squash: preset.squash,
    liftEnd: preset.liftEnd,
    landStart: preset.landStart,
    slam: preset.slam,
    trailCount: trailOpt === void 0 ? preset.trailCount : trailOpt === false ? 0 : trailOpt === true ? Math.max(preset.trailCount, 4) : clamp(Math.round(trailOpt), 0, 8),
    flash: options?.flash ?? preset.flash,
    victimBlast: options?.victimBlast ?? preset.victimBlast,
    impactShake: resolveShake(options?.impactShake, preset.impactShake),
    onImpact: options?.onImpact,
    reduced: false
  };
  if (!reduced) return base;
  return {
    ...base,
    durationMs: Math.min(base.durationMs, 900),
    spins: 0,
    arcHeight: 0,
    liftScale: 1.18,
    glowMaxPx: 0,
    sparkles: false,
    shockwave: false,
    badge: void 0,
    slowMoLanding: false,
    plunge: false,
    squash: 0,
    slam: false,
    trailCount: 0,
    flash: false,
    victimBlast: false,
    impactShake: null,
    reduced: true
  };
}
function flightPacing(o, u) {
  if (o.slowMoLanding) return 1 - (1 - u) ** SLOWMO_EXPONENT;
  if (o.plunge) return u ** 2.2;
  return easeInOutQuad(u);
}
function buildApproachPositionKeyframes(e) {
  const o = e.opts;
  const L = o.landStart;
  const liftFrac = o.liftEnd / L;
  const arriveFrac = o.slam ? 0.6 : 1;
  const frames = [{ transform: positionTransform(e.fromCol, e.fromRow), offset: 0 }];
  if (o.liftEnd > 0) {
    frames.push({ transform: positionTransform(e.fromCol, e.fromRow), offset: liftFrac });
  }
  const cx = (e.fromCol + e.toCol) / 2;
  let cy = (e.fromRow + e.toRow) / 2 - 2 * o.arcHeight;
  cy = Math.max(cy, (-0.6 - e.fromRow - e.toRow) / 2);
  for (let i = 1; i <= FLIGHT_SAMPLES; i++) {
    const u = i / FLIGHT_SAMPLES;
    const p = flightPacing(o, u);
    const inv = 1 - p;
    const x = inv * inv * e.fromCol + 2 * inv * p * cx + p * p * e.toCol;
    const y = inv * inv * e.fromRow + 2 * inv * p * cy + p * p * e.toRow;
    frames.push({
      transform: positionTransform(x, y),
      offset: liftFrac + (arriveFrac - liftFrac) * u
    });
  }
  if (arriveFrac < 1) {
    frames.push({ transform: positionTransform(e.toCol, e.toRow), offset: 1 });
  }
  return frames;
}
function buildReducedGlideKeyframes(e) {
  return [
    { transform: positionTransform(e.fromCol, e.fromRow), offset: 0, easing: "ease-in-out" },
    { transform: positionTransform(e.toCol, e.toRow), offset: 1 }
  ];
}
function att(offset, pose, glowColor, easing2) {
  const { z = 0, ry = 0, rx = 0, sx = 1, sy = 1, shadow = 2, glow = 0 } = pose;
  const frame = {
    offset,
    transform: `rotateZ(${z}deg) rotateY(${ry}deg) rotateX(${rx}deg) scaleX(${sx}) scaleY(${sy})`,
    filter: `drop-shadow(0 ${shadow}px ${Math.max(2, shadow)}px rgba(0, 0, 0, 0.3)) drop-shadow(0 0 ${glow}px ${glowColor})`
  };
  if (easing2) frame.easing = easing2;
  return frame;
}
function attitudePlan(o) {
  const flightRy = o.slam ? 0 : o.spins * 360;
  const restRy = Math.ceil(flightRy / 360 - 1e-3) * 360;
  return { flightRy, restRy };
}
function buildApproachAttitudeKeyframes(e) {
  const o = e.opts;
  const g = o.glowMaxPx;
  const c = o.glowColor;
  const lift = o.liftScale;
  const L = o.landStart;
  const liftFrac = o.liftEnd / L;
  const { flightRy } = attitudePlan(o);
  const frames = [att(0, {}, c)];
  if (o.slam) {
    frames.push(att(liftFrac, { sx: lift, sy: lift, shadow: 22, glow: g * 0.5 }, c));
    frames.push(att(0.78, { sx: lift, sy: lift, shadow: 22, glow: g }, c, "cubic-bezier(0.7, 0, 1, 0.6)"));
    frames.push(att(1, { sx: 1.04, sy: 0.96, shadow: 3, glow: g }, c));
    return frames;
  }
  const tiltZ = o.spins > 0 ? -6 : 0;
  const wobble = o.spins > 0 ? 14 : 0;
  frames.push(att(liftFrac, { z: tiltZ, sx: lift, sy: lift, shadow: 10, glow: g * 0.35 }, c));
  const flight = 1 - liftFrac;
  for (const [u, w] of [[0.25, 1], [0.5, 0], [0.75, -1]]) {
    frames.push(att(liftFrac + flight * u, {
      z: tiltZ * (1 - u),
      ry: flightRy * u,
      rx: wobble * w,
      sx: lift,
      sy: lift,
      shadow: 12,
      glow: g * (0.35 + 0.65 * u)
    }, c));
  }
  frames.push(att(1, { ry: flightRy, sx: lift, sy: lift, shadow: 12, glow: g }, c));
  return frames;
}
function buildSettleAttitudeKeyframes(e) {
  const o = e.opts;
  const g = o.glowMaxPx;
  const c = o.glowColor;
  const { flightRy, restRy } = attitudePlan(o);
  const contact = o.slam ? att(0, { sx: 1.04, sy: 0.96, shadow: 3, glow: g }, c) : att(0, { ry: flightRy, sx: o.liftScale, sy: o.liftScale, shadow: 12, glow: g }, c);
  if (o.squash <= 0) {
    return [contact, att(1, { ry: restRy, shadow: 2 }, c)];
  }
  return [
    contact,
    att(o.slam ? 0.22 : 0.28, { ry: restRy, sx: 1 + o.squash, sy: 1 - o.squash, shadow: 2, glow: g * 0.6 }, c),
    att(0.6, { ry: restRy, sx: 1 - o.squash * 0.25, sy: 1 + o.squash * 0.2, shadow: 2, glow: g * 0.3 }, c),
    att(1, { ry: restRy, shadow: 2 }, c)
  ];
}
var CinematicLayer = memo(forwardRef(function CinematicLayer2({
  orientation,
  pieces,
  pieceSet,
  customPieces,
  flipPieces = false,
  getPieceElement,
  onImpactShake
}, ref) {
  const asWhite = orientation === "white";
  const [moves, setMoves] = useState([]);
  const [bursts, setBursts] = useState([]);
  const [badges, setBadges] = useState([]);
  const [blasts, setBlasts] = useState([]);
  const [flashes, setFlashes] = useState([]);
  const [confetti, setConfetti] = useState([]);
  const [banners, setBanners] = useState([]);
  const [promos, setPromos] = useState([]);
  const [implodes, setImplodes] = useState([]);
  const [spotlights, setSpotlights] = useState([]);
  const [lasers, setLasers] = useState([]);
  const movesRef = useRef(moves);
  movesRef.current = moves;
  const idRef = useRef(0);
  const piecesRef = useRef(pieces);
  piecesRef.current = pieces;
  const asWhiteRef = useRef(asWhite);
  asWhiteRef.current = asWhite;
  const getPieceElementRef = useRef(getPieceElement);
  getPieceElementRef.current = getPieceElement;
  const onImpactShakeRef = useRef(onImpactShake);
  onImpactShakeRef.current = onImpactShake;
  const resolversRef = useRef(/* @__PURE__ */ new Map());
  const animationsRef = useRef(/* @__PURE__ */ new Map());
  const timeoutsRef = useRef(/* @__PURE__ */ new Map());
  const hiddenVictimsRef = useRef(/* @__PURE__ */ new Map());
  const hiddenSquaresRef = useRef(/* @__PURE__ */ new Map());
  const spotlightElsRef = useRef(/* @__PURE__ */ new Map());
  const startedRef = useRef(/* @__PURE__ */ new Set());
  const finishedRef = useRef(/* @__PURE__ */ new Set());
  const finishMove = useCallback((entry) => {
    if (finishedRef.current.has(entry.id)) return;
    finishedRef.current.add(entry.id);
    const resolve = resolversRef.current.get(entry.id);
    resolversRef.current.delete(entry.id);
    resolve?.();
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      const anims = animationsRef.current.get(entry.id);
      if (anims) for (const anim of anims) anim.cancel();
      animationsRef.current.delete(entry.id);
      startedRef.current.delete(entry.id);
      finishedRef.current.delete(entry.id);
      if (entry.hiddenSquare) {
        const orig = getPieceElementRef.current(entry.hiddenSquare);
        if (orig) orig.style.opacity = "";
      }
      const victimSquare = hiddenVictimsRef.current.get(entry.id);
      if (victimSquare) {
        hiddenVictimsRef.current.delete(entry.id);
        const el = getPieceElementRef.current(victimSquare);
        if (el) el.style.opacity = "";
      }
      setMoves((prev) => prev.filter((m) => m.id !== entry.id));
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => requestAnimationFrame(cleanup));
      setTimeout(cleanup, 150);
    } else {
      cleanup();
    }
  }, []);
  const makeFinisher = useCallback((setEntries) => (entry) => {
    const resolve = resolversRef.current.get(entry.id);
    resolversRef.current.delete(entry.id);
    animationsRef.current.delete(entry.id);
    startedRef.current.delete(entry.id);
    setEntries((prev) => prev.filter((b) => b.id !== entry.id));
    resolve?.();
  }, []);
  const makeHiddenFinisher = useCallback((setEntries) => (entry) => {
    if (finishedRef.current.has(entry.id)) return;
    finishedRef.current.add(entry.id);
    const resolve = resolversRef.current.get(entry.id);
    resolversRef.current.delete(entry.id);
    resolve?.();
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      const anims = animationsRef.current.get(entry.id);
      if (anims) for (const anim of anims) anim.cancel();
      animationsRef.current.delete(entry.id);
      startedRef.current.delete(entry.id);
      finishedRef.current.delete(entry.id);
      const square = hiddenSquaresRef.current.get(entry.id);
      if (square) {
        hiddenSquaresRef.current.delete(entry.id);
        const el = getPieceElementRef.current(square);
        if (el) el.style.opacity = "";
      }
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => requestAnimationFrame(cleanup));
      setTimeout(cleanup, 150);
    } else {
      cleanup();
    }
  }, []);
  const finishBurst = useRef(makeFinisher(setBursts)).current;
  const finishBadge = useRef(makeFinisher(setBadges)).current;
  const finishBlast = useRef(makeFinisher(setBlasts)).current;
  const finishFlash = useRef(makeFinisher(setFlashes)).current;
  const finishConfetti = useRef(makeFinisher(setConfetti)).current;
  const finishBanner = useRef(makeFinisher(setBanners)).current;
  const finishPromo = useRef(makeHiddenFinisher(setPromos)).current;
  const finishImplode = useRef(makeHiddenFinisher(setImplodes)).current;
  const finishLaser = useRef(makeFinisher(setLasers)).current;
  const spawnBurst = useCallback((square, options) => {
    const [col, row] = squareColRow5(square, asWhiteRef.current);
    const kind = options?.kind ?? "both";
    const durationMs = Math.max(100, options?.durationMs ?? DEFAULT_BURST_DURATION_MS);
    const particles = [];
    if (kind !== "shockwave") {
      const count = clamp(Math.round(options?.particleCount ?? 12), 4, 24);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = (0.4 + Math.random() * 0.7) * 100;
        particles.push({
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          size: 6 + Math.random() * 4,
          delayMs: Math.random() * 80,
          rotateDeg: (Math.random() * 2 - 1) * 180
        });
      }
    }
    const entry = {
      id: ++idRef.current,
      col,
      row,
      kind,
      color: options?.color ?? DEFAULT_BURST_COLOR,
      durationMs,
      particles
    };
    return new Promise((resolve) => {
      resolversRef.current.set(entry.id, resolve);
      setBursts((prev) => [...prev, entry]);
    });
  }, []);
  const spawnBadge = useCallback((square, options) => {
    const [col, row] = squareColRow5(square, asWhiteRef.current);
    const entry = {
      id: ++idRef.current,
      col,
      row,
      text: options.text,
      color: options.color ?? "#ffffff",
      background: options.background ?? BRILLIANT_TEAL,
      durationMs: Math.max(400, options.durationMs ?? DEFAULT_BADGE_DURATION_MS),
      corner: options.corner ?? "topRight"
    };
    return new Promise((resolve) => {
      resolversRef.current.set(entry.id, resolve);
      setBadges((prev) => [...prev, entry]);
    });
  }, []);
  const spawnFlash = useCallback((col, row, color) => {
    const entry = {
      id: ++idRef.current,
      cxPct: (col + 0.5) * 12.5,
      cyPct: (row + 0.5) * 12.5,
      color,
      durationMs: FLASH_DURATION_MS
    };
    return new Promise((resolve) => {
      resolversRef.current.set(entry.id, resolve);
      setFlashes((prev) => [...prev, entry]);
    });
  }, []);
  const spawnVictimBlast = useCallback((moveId, square) => {
    const victim = piecesRef.current.get(square);
    if (!victim) return null;
    const el = getPieceElementRef.current(square);
    if (el) {
      el.style.opacity = "0";
      hiddenVictimsRef.current.set(moveId, square);
    }
    const [col, row] = squareColRow5(square, asWhiteRef.current);
    const dir = col < 4 ? -1 : 1;
    const entry = {
      id: ++idRef.current,
      pieceKey: `${victim.color}${victim.role.toUpperCase()}`,
      col,
      row,
      dxPct: dir * (120 + Math.random() * 100),
      risePct: -(90 + Math.random() * 60),
      rotateDeg: dir * (360 + Math.random() * 360),
      durationMs: VICTIM_BLAST_DURATION_MS
    };
    return new Promise((resolve) => {
      resolversRef.current.set(entry.id, resolve);
      setBlasts((prev) => [...prev, entry]);
    });
  }, []);
  const runImpact = useCallback((entry) => {
    const o = entry.opts;
    const fx = [];
    o.onImpact?.();
    if (o.impactShake) {
      onImpactShakeRef.current?.({ intensity: o.impactShake.intensity, durationMs: o.impactShake.durationMs });
    }
    if (o.victimBlast) {
      const blast = spawnVictimBlast(entry.id, entry.toSquare);
      if (blast) fx.push(blast);
    }
    if (o.flash) {
      fx.push(spawnFlash(entry.toCol, entry.toRow, o.glowMaxPx > 0 ? o.glowColor : "#ffffff"));
    }
    if (o.sparkles || o.shockwave) {
      fx.push(spawnBurst(entry.toSquare, {
        kind: o.sparkles && o.shockwave ? "both" : o.sparkles ? "sparkles" : "shockwave",
        color: o.glowMaxPx > 0 ? o.glowColor : void 0
      }));
    }
    if (o.badge) {
      fx.push(spawnBadge(entry.toSquare, {
        text: o.badge,
        background: o.badgeColor,
        durationMs: MOVE_BADGE_DURATION_MS
      }));
    }
    return fx;
  }, [spawnVictimBlast, spawnFlash, spawnBurst, spawnBadge]);
  const startMoveAnimation = useCallback((wrapper, entry) => {
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);
    const hero = wrapper.querySelector("[data-cine-hero]");
    if (!hero || !canAnimate2(hero)) {
      entry.opts.onImpact?.();
      finishMove(entry);
      return;
    }
    const o = entry.opts;
    const anims = [];
    if (o.reduced) {
      const glide = hero.animate(buildReducedGlideKeyframes(entry), {
        duration: o.durationMs,
        fill: "forwards"
      });
      animationsRef.current.set(entry.id, [glide]);
      waitForAnimation(glide, o.durationMs).then(() => finishMove(entry));
      return;
    }
    const approachMs = Math.max(50, Math.round(o.durationMs * o.landStart));
    const settleMs = Math.max(50, o.durationMs - approachMs);
    const tailWaits = [];
    const posApproach = hero.animate(buildApproachPositionKeyframes(entry), {
      duration: approachMs,
      easing: "linear",
      fill: "forwards"
    });
    anims.push(posApproach);
    const attitude = hero.firstElementChild?.firstElementChild;
    if (attitude && canAnimate2(attitude)) {
      const attApproach = attitude.animate(buildApproachAttitudeKeyframes(entry), {
        duration: approachMs,
        easing: "linear",
        fill: "forwards"
      });
      anims.push(attApproach);
      tailWaits.push(waitForAnimation(attApproach, approachMs));
    }
    const ghosts = wrapper.querySelectorAll("[data-cine-trail]");
    ghosts.forEach((ghost, i) => {
      if (!canAnimate2(ghost)) return;
      const delay = (i + 1) * TRAIL_GAP_MS;
      const peak = 0.32 * (1 - i / (ghosts.length + 1));
      const posGhost = ghost.animate(buildApproachPositionKeyframes(entry), {
        duration: approachMs,
        delay,
        easing: "linear",
        fill: "both"
      });
      const fade = ghost.animate(
        [
          { opacity: 0, offset: 0 },
          { opacity: peak, offset: Math.min(0.35, o.liftEnd / o.landStart + 0.12) },
          { opacity: peak * 0.7, offset: 0.85 },
          { opacity: 0, offset: 1 }
        ],
        { duration: approachMs, delay, easing: "linear", fill: "both" }
      );
      anims.push(posGhost, fade);
      tailWaits.push(waitForAnimation(posGhost, approachMs + delay));
    });
    animationsRef.current.set(entry.id, anims);
    waitForAnimation(posApproach, approachMs).then(() => {
      if (!animationsRef.current.has(entry.id) || finishedRef.current.has(entry.id)) return;
      const fxWaits = runImpact(entry);
      if (attitude && canAnimate2(attitude)) {
        const settle = attitude.animate(buildSettleAttitudeKeyframes(entry), {
          duration: settleMs,
          easing: "linear",
          fill: "forwards"
        });
        anims.push(settle);
        tailWaits.push(waitForAnimation(settle, settleMs));
      }
      Promise.all([...tailWaits, ...fxWaits]).then(() => finishMove(entry));
    });
  }, [finishMove, runImpact]);
  const startBurstAnimation = useCallback((container, entry) => {
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);
    const children = Array.from(container.children);
    const anims = [];
    const waits = [];
    let idx = 0;
    if (entry.kind !== "sparkles") {
      const ring = children[idx++];
      if (ring && canAnimate2(ring)) {
        const anim = ring.animate(
          [
            { transform: "scale(0.3)", opacity: 0.9 },
            { transform: "scale(2.2)", opacity: 0 }
          ],
          { duration: SHOCKWAVE_DURATION_MS, easing: "ease-out", fill: "forwards" }
        );
        anims.push(anim);
        waits.push(waitForAnimation(anim, SHOCKWAVE_DURATION_MS));
      }
    }
    if (entry.kind !== "shockwave") {
      for (const p of entry.particles) {
        const el = children[idx++];
        if (!el || !canAnimate2(el)) continue;
        const anim = el.animate(
          [
            { transform: "translate(0%, 0%) rotate(0deg) scale(1)", opacity: 1 },
            { transform: `translate(${p.dx}%, ${p.dy}%) rotate(${p.rotateDeg}deg) scale(0)`, opacity: 0 }
          ],
          { duration: entry.durationMs, delay: p.delayMs, easing: "cubic-bezier(0.12, 0.6, 0.3, 1)", fill: "both" }
        );
        anims.push(anim);
        waits.push(waitForAnimation(anim, entry.durationMs + p.delayMs));
      }
    }
    if (anims.length === 0) {
      finishBurst(entry);
      return;
    }
    animationsRef.current.set(entry.id, anims);
    Promise.all(waits).then(() => finishBurst(entry));
  }, [finishBurst]);
  const startBadgeAnimation = useCallback((el, entry) => {
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);
    if (!canAnimate2(el)) {
      finishBadge(entry);
      return;
    }
    const duration = entry.durationMs;
    const pop = Math.min(0.4, 350 / duration);
    const fadeStart = Math.max(pop, 1 - 300 / duration);
    const anim = el.animate(
      [
        { transform: "scale(0)", opacity: 0, offset: 0, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
        { transform: "scale(1.25)", opacity: 1, offset: pop * 0.6 },
        { transform: "scale(0.95)", opacity: 1, offset: pop * 0.85 },
        { transform: "scale(1)", opacity: 1, offset: pop },
        { transform: "scale(1)", opacity: 1, offset: fadeStart },
        { transform: "scale(0.85)", opacity: 0, offset: 1 }
      ],
      { duration, easing: "ease-out", fill: "forwards" }
    );
    animationsRef.current.set(entry.id, [anim]);
    waitForAnimation(anim, duration).then(() => finishBadge(entry));
  }, [finishBadge]);
  const startBlastAnimation = useCallback((el, entry) => {
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);
    if (!canAnimate2(el)) {
      finishBlast(entry);
      return;
    }
    const anim = el.animate(
      [
        { transform: "translate(0%, 0%) rotate(0deg) scale(1)", opacity: 1, offset: 0 },
        {
          transform: `translate(${entry.dxPct * 0.5}%, ${entry.risePct}%) rotate(${entry.rotateDeg * 0.45}deg) scale(0.8)`,
          opacity: 0.95,
          offset: 0.4
        },
        {
          transform: `translate(${entry.dxPct}%, ${entry.risePct * 0.15}%) rotate(${entry.rotateDeg}deg) scale(0.25)`,
          opacity: 0,
          offset: 1
        }
      ],
      { duration: entry.durationMs, easing: "cubic-bezier(0.3, 0.5, 0.5, 1)", fill: "forwards" }
    );
    animationsRef.current.set(entry.id, [anim]);
    waitForAnimation(anim, entry.durationMs).then(() => finishBlast(entry));
  }, [finishBlast]);
  const startFlashAnimation = useCallback((el, entry) => {
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);
    if (!canAnimate2(el)) {
      finishFlash(entry);
      return;
    }
    const anim = el.animate(
      [
        { opacity: 0, offset: 0 },
        { opacity: 0.55, offset: 0.18 },
        { opacity: 0, offset: 1 }
      ],
      { duration: entry.durationMs, easing: "ease-out", fill: "forwards" }
    );
    animationsRef.current.set(entry.id, [anim]);
    waitForAnimation(anim, entry.durationMs).then(() => finishFlash(entry));
  }, [finishFlash]);
  const startConfettiAnimation = useCallback((container, entry) => {
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);
    const children = Array.from(container.children);
    const anims = [];
    const waits = [];
    entry.flakes.forEach((f, i) => {
      const el = children[i];
      if (!el || !canAnimate2(el)) return;
      const fall = 110 / f.hPct * 100;
      const sway = f.swayPct / f.wPct * 100;
      const anim = el.animate(
        [
          { transform: "translate(0%, 0%) rotate(0deg)", opacity: 1, offset: 0 },
          { transform: `translate(${sway}%, ${fall * 0.28}%) rotate(${f.rotateDeg * 0.3}deg)`, opacity: 1, offset: 0.28 },
          { transform: `translate(${-sway * 0.7}%, ${fall * 0.58}%) rotate(${f.rotateDeg * 0.62}deg)`, opacity: 1, offset: 0.58 },
          { transform: `translate(${sway * 0.4}%, ${fall * 0.85}%) rotate(${f.rotateDeg * 0.86}deg)`, opacity: 0.9, offset: 0.85 },
          { transform: `translate(0%, ${fall}%) rotate(${f.rotateDeg}deg)`, opacity: 0, offset: 1 }
        ],
        { duration: f.fallMs, delay: f.delayMs, easing: "linear", fill: "both" }
      );
      anims.push(anim);
      waits.push(waitForAnimation(anim, f.fallMs + f.delayMs));
    });
    if (anims.length === 0) {
      finishConfetti(entry);
      return;
    }
    animationsRef.current.set(entry.id, anims);
    Promise.all(waits).then(() => finishConfetti(entry));
  }, [finishConfetti]);
  const startBannerAnimation = useCallback((el, entry) => {
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);
    if (!canAnimate2(el)) {
      finishBanner(entry);
      return;
    }
    const duration = entry.durationMs;
    const popIn = Math.min(0.35, 420 / duration);
    const holdEnd = Math.max(popIn, 1 - Math.min(0.3, 500 / duration));
    const anim = el.animate(
      [
        { transform: "scale(0.4)", opacity: 0, offset: 0, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
        { transform: "scale(1.08)", opacity: 1, offset: popIn * 0.7 },
        { transform: "scale(1)", opacity: 1, offset: popIn },
        { transform: "scale(1)", opacity: 1, offset: holdEnd },
        { transform: "scale(1.15)", opacity: 0, offset: 1 }
      ],
      { duration, easing: "ease-out", fill: "forwards" }
    );
    animationsRef.current.set(entry.id, [anim]);
    waitForAnimation(anim, duration).then(() => finishBanner(entry));
  }, [finishBanner]);
  const startPromotionAnimation = useCallback((container, entry) => {
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);
    const c = entry.color;
    const d = entry.durationMs;
    const anims = [];
    const waits = [];
    const pillar = container.querySelector("[data-promo-pillar]");
    if (pillar && canAnimate2(pillar)) {
      const anim = pillar.animate(
        [
          { transform: "scaleX(0.8) scaleY(0)", opacity: 0, offset: 0 },
          { transform: "scaleX(1.1) scaleY(1)", opacity: 0.95, offset: 0.4 },
          { transform: "scaleX(0.9) scaleY(1)", opacity: 0.85, offset: 0.7 },
          { transform: "scaleX(0.7) scaleY(1.05)", opacity: 0, offset: 1 }
        ],
        { duration: d, easing: "ease-out", fill: "forwards" }
      );
      anims.push(anim);
      waits.push(waitForAnimation(anim, d));
    }
    const ring = container.querySelector("[data-promo-ring]");
    if (ring && canAnimate2(ring)) {
      const ringMs = Math.max(50, Math.round(d * 0.55));
      const anim = ring.animate(
        [
          { transform: "scale(0.3)", opacity: 0.9 },
          { transform: "scale(2.2)", opacity: 0 }
        ],
        { duration: ringMs, easing: "ease-out", fill: "forwards" }
      );
      anims.push(anim);
      waits.push(waitForAnimation(anim, ringMs));
    }
    const flash = container.querySelector("[data-promo-flash]");
    if (flash && canAnimate2(flash)) {
      const anim = flash.animate(
        [
          { opacity: 0, offset: 0 },
          { opacity: 0, offset: 0.38 },
          { opacity: 0.6, offset: 0.46 },
          { opacity: 0, offset: 0.6 },
          { opacity: 0, offset: 1 }
        ],
        { duration: d, easing: "ease-out", fill: "forwards" }
      );
      anims.push(anim);
      waits.push(waitForAnimation(anim, d));
    }
    const oldPiece = container.querySelector("[data-promo-old]");
    if (oldPiece && canAnimate2(oldPiece)) {
      const oldMs = Math.max(50, Math.round(d * 0.45));
      const anim = oldPiece.animate(
        [
          { transform: "scaleX(1) scaleY(1) rotateZ(0deg)", opacity: 1 },
          { transform: "scaleX(0.2) scaleY(0.2) rotateZ(180deg)", opacity: 0 }
        ],
        { duration: oldMs, easing: "ease-in", fill: "forwards" }
      );
      anims.push(anim);
      waits.push(waitForAnimation(anim, oldMs));
    }
    const newPiece = container.querySelector("[data-promo-new]");
    if (newPiece && canAnimate2(newPiece)) {
      const anim = newPiece.animate(
        [
          { transform: "scale(0) rotateY(0deg)", opacity: 0, filter: `drop-shadow(0 0 0px ${c})`, offset: 0 },
          { transform: "scale(0) rotateY(0deg)", opacity: 0, filter: `drop-shadow(0 0 0px ${c})`, offset: 0.4 },
          { transform: "scale(1.2) rotateY(720deg)", opacity: 1, filter: `drop-shadow(0 0 20px ${c})`, offset: 0.62 },
          { transform: "scale(1) rotateY(720deg)", opacity: 1, filter: `drop-shadow(0 0 4px ${c})`, offset: 1 }
        ],
        { duration: d, easing: "ease-out", fill: "forwards" }
      );
      anims.push(anim);
      waits.push(waitForAnimation(anim, d));
    }
    if (anims.length === 0) {
      finishPromo(entry);
      return;
    }
    animationsRef.current.set(entry.id, anims);
    Promise.all(waits).then(() => finishPromo(entry));
  }, [finishPromo]);
  const startImplodeAnimation = useCallback((container, entry) => {
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);
    const d = entry.durationMs;
    const anims = [];
    const waits = [];
    const rings = container.querySelectorAll("[data-implode-ring]");
    rings.forEach((ringEl, i) => {
      if (!canAnimate2(ringEl)) return;
      const dir = i % 2 === 0 ? 1 : -1;
      const anim = ringEl.animate(
        [
          { transform: `scale(1.6) rotateZ(0deg)`, opacity: 0, offset: 0 },
          { transform: `scale(1) rotateZ(${dir * 180}deg)`, opacity: 0.9, offset: 0.4 },
          { transform: `scale(0) rotateZ(${dir * 360}deg)`, opacity: 0, offset: 1 }
        ],
        { duration: d, easing: "ease-in", fill: "forwards" }
      );
      anims.push(anim);
      waits.push(waitForAnimation(anim, d));
    });
    const core = container.querySelector("[data-implode-core]");
    if (core && canAnimate2(core)) {
      const anim = core.animate(
        [
          { transform: "scale(0)", opacity: 0, offset: 0 },
          { transform: "scale(1.4)", opacity: 0.95, offset: 0.7 },
          { transform: "scale(0)", opacity: 0, offset: 1 }
        ],
        { duration: d, easing: "ease-in", fill: "forwards" }
      );
      anims.push(anim);
      waits.push(waitForAnimation(anim, d));
    }
    const piece = container.querySelector("[data-implode-piece]");
    if (piece && canAnimate2(piece)) {
      const anim = piece.animate(
        [
          { transform: "scaleX(1) scaleY(1) rotateZ(0deg)", opacity: 1, offset: 0 },
          { transform: "scaleX(0.5) scaleY(0.6) rotateZ(360deg)", opacity: 0.9, offset: 0.6 },
          { transform: "scaleX(0.05) scaleY(0.25) rotateZ(720deg)", opacity: 0, offset: 1 }
        ],
        { duration: d, easing: "ease-in", fill: "forwards" }
      );
      anims.push(anim);
      waits.push(waitForAnimation(anim, d));
    }
    const flash = container.querySelector("[data-implode-flash]");
    if (flash && canAnimate2(flash)) {
      const anim = flash.animate(
        [
          { opacity: 0, offset: 0 },
          { opacity: 0, offset: 0.8 },
          { opacity: 0.5, offset: 0.9 },
          { opacity: 0, offset: 1 }
        ],
        { duration: d, easing: "ease-out", fill: "forwards" }
      );
      anims.push(anim);
      waits.push(waitForAnimation(anim, d));
    }
    if (anims.length === 0) {
      finishImplode(entry);
      return;
    }
    animationsRef.current.set(entry.id, anims);
    Promise.all(waits).then(() => finishImplode(entry));
  }, [finishImplode]);
  const startSpotlightAnimation = useCallback((el, entry) => {
    spotlightElsRef.current.set(entry.id, el);
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);
    if (!canAnimate2(el)) return;
    const anim = el.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: entry.durationMs, easing: "ease-out", fill: "forwards" }
    );
    animationsRef.current.set(entry.id, [anim]);
  }, []);
  const startLaserAnimation = useCallback((container, entry) => {
    if (startedRef.current.has(entry.id)) return;
    startedRef.current.add(entry.id);
    const beam = container.querySelector("[data-laser-beam]");
    const tip = container.querySelector("[data-laser-tip]");
    if (!beam || !canAnimate2(beam)) {
      finishLaser(entry);
      return;
    }
    const drawMs = entry.durationMs;
    const anims = [];
    const beamDraw = beam.animate(
      [
        { transform: `rotate(${entry.angle}deg) scaleX(0)`, opacity: 0, offset: 0 },
        { transform: `rotate(${entry.angle}deg) scaleX(0)`, opacity: 1, offset: 0.1 },
        { transform: `rotate(${entry.angle}deg) scaleX(1)`, opacity: 1, offset: 1 }
      ],
      { duration: drawMs, easing: "ease-out", fill: "forwards" }
    );
    anims.push(beamDraw);
    if (tip && canAnimate2(tip)) {
      const tipAnim = tip.animate(
        [
          { opacity: 0, offset: 0 },
          { opacity: 1, offset: 0.5 },
          { opacity: 0.6, offset: 1 }
        ],
        {
          duration: Math.max(50, Math.round(drawMs * 0.5)),
          delay: Math.round(drawMs * 0.85),
          easing: "ease-out",
          fill: "forwards"
        }
      );
      anims.push(tipAnim);
    }
    animationsRef.current.set(entry.id, anims);
    waitForAnimation(beamDraw, drawMs).then(() => {
      if (!animationsRef.current.has(entry.id) || finishedRef.current.has(entry.id)) return;
      if (entry.persist) {
        const resolve = resolversRef.current.get(entry.id);
        resolversRef.current.delete(entry.id);
        resolve?.();
        return;
      }
      const fadeBeam = beam.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: LASER_FADE_MS, delay: entry.holdMs, easing: "ease-out", fill: "forwards" }
      );
      const current = animationsRef.current.get(entry.id) ?? [];
      current.push(fadeBeam);
      if (tip && canAnimate2(tip)) {
        const fadeTip = tip.animate(
          [{ opacity: 0.6 }, { opacity: 0 }],
          { duration: LASER_FADE_MS, delay: entry.holdMs, easing: "ease-out", fill: "forwards" }
        );
        current.push(fadeTip);
      }
      animationsRef.current.set(entry.id, current);
      waitForAnimation(fadeBeam, LASER_FADE_MS + entry.holdMs).then(() => finishLaser(entry));
    });
  }, [finishLaser]);
  const cinematicMove = useCallback((from, to, options) => {
    if (!isValidSquare4(from) || !isValidSquare4(to) || from === to) {
      return Promise.resolve();
    }
    const existing = piecesRef.current.get(from);
    const pieceKey = options?.piece ?? (existing ? `${existing.color}${existing.role.toUpperCase()}` : void 0);
    if (!pieceKey) return Promise.resolve();
    const reduced = prefersReducedMotion() && !options?.force;
    const white = asWhiteRef.current;
    const [fromCol, fromRow] = squareColRow5(from, white);
    const [toCol, toRow] = squareColRow5(to, white);
    const entry = {
      id: ++idRef.current,
      pieceKey,
      fromCol,
      fromRow,
      toCol,
      toRow,
      toSquare: to,
      hiddenSquare: existing ? from : null,
      opts: resolveMoveOptions(options, reduced)
    };
    if (entry.hiddenSquare) {
      const orig = getPieceElementRef.current(entry.hiddenSquare);
      if (orig) orig.style.opacity = "0";
    }
    return new Promise((resolve) => {
      resolversRef.current.set(entry.id, resolve);
      setMoves((prev) => [...prev, entry]);
    });
  }, []);
  const squareBurst = useCallback((square, options) => {
    if (!isValidSquare4(square)) return Promise.resolve();
    if (prefersReducedMotion() && !options?.force) return Promise.resolve();
    return spawnBurst(square, options);
  }, [spawnBurst]);
  const popBadge = useCallback((square, options) => {
    if (!isValidSquare4(square) || !options?.text) return Promise.resolve();
    if (prefersReducedMotion() && !options?.force) return Promise.resolve();
    return spawnBadge(square, options);
  }, [spawnBadge]);
  const celebrate = useCallback((options) => {
    if (prefersReducedMotion() && !options?.force) return Promise.resolve();
    const kind = options?.kind ?? "both";
    const durationMs = Math.max(400, options?.durationMs ?? DEFAULT_CELEBRATE_DURATION_MS);
    const colors = options?.colors && options.colors.length > 0 ? options.colors : CELEBRATE_COLORS;
    const scale = durationMs / DEFAULT_CELEBRATE_DURATION_MS;
    const parts = [];
    if (kind !== "fireworks") {
      const flakes = [];
      for (let i = 0; i < 42; i++) {
        const wPct = 0.9 + Math.random() * 0.7;
        flakes.push({
          leftPct: Math.random() * 98,
          delayMs: Math.random() * 450 * scale,
          fallMs: (1300 + Math.random() * 800) * scale,
          color: colors[i % colors.length],
          wPct,
          hPct: 0.5 + Math.random() * 0.6,
          swayPct: (2 + Math.random() * 5) * (Math.random() < 0.5 ? -1 : 1),
          rotateDeg: (Math.random() * 2 - 1) * 900,
          round: Math.random() < 0.35
        });
      }
      const entry = { id: ++idRef.current, flakes };
      parts.push(new Promise((resolve) => {
        resolversRef.current.set(entry.id, resolve);
        setConfetti((prev) => [...prev, entry]);
      }));
    }
    if (kind !== "confetti") {
      const files = "abcdefgh";
      const burstCount = 5;
      for (let i = 0; i < burstCount; i++) {
        const square = `${files[1 + Math.floor(Math.random() * 6)]}${2 + Math.floor(Math.random() * 6)}`;
        const color = colors[i % colors.length];
        parts.push(new Promise((resolve) => {
          const fwId = ++idRef.current;
          resolversRef.current.set(fwId, resolve);
          const tid = setTimeout(() => {
            timeoutsRef.current.delete(fwId);
            if (!resolversRef.current.has(fwId)) return;
            spawnBurst(square, { kind: "both", color, particleCount: 16 }).then(() => {
              resolversRef.current.delete(fwId);
              resolve();
            });
          }, i * 170 * scale);
          timeoutsRef.current.set(fwId, tid);
        }));
      }
    }
    if (parts.length === 0) return Promise.resolve();
    return Promise.all(parts).then(() => void 0);
  }, [spawnBurst]);
  const popBanner = useCallback((options) => {
    if (!options?.text) return Promise.resolve();
    if (prefersReducedMotion() && !options.force) return Promise.resolve();
    const entry = {
      id: ++idRef.current,
      text: options.text,
      color: options.color ?? "#ffffff",
      background: options.background,
      glowColor: options.glowColor ?? BRILLIANT_TEAL,
      durationMs: Math.max(500, options.durationMs ?? DEFAULT_BANNER_DURATION_MS)
    };
    return new Promise((resolve) => {
      resolversRef.current.set(entry.id, resolve);
      setBanners((prev) => [...prev, entry]);
    });
  }, []);
  const promotionBeam = useCallback((square, options) => {
    if (!isValidSquare4(square)) return Promise.resolve();
    if (prefersReducedMotion() && !options?.force) return Promise.resolve();
    const existing = piecesRef.current.get(square);
    const fromPieceKey = options?.fromPiece ?? (existing ? `${existing.color}${existing.role.toUpperCase()}` : void 0);
    const toPieceKey = options?.piece;
    const [col, row] = squareColRow5(square, asWhiteRef.current);
    const entry = {
      id: ++idRef.current,
      col,
      row,
      color: options?.color ?? DEFAULT_PROMOTION_BEAM_COLOR,
      durationMs: Math.max(100, options?.durationMs ?? DEFAULT_PROMOTION_BEAM_DURATION_MS),
      fromPieceKey,
      toPieceKey
    };
    if (existing) {
      const orig = getPieceElementRef.current(square);
      if (orig) {
        orig.style.opacity = "0";
        hiddenSquaresRef.current.set(entry.id, square);
      }
    }
    return new Promise((resolve) => {
      resolversRef.current.set(entry.id, resolve);
      setPromos((prev) => [...prev, entry]);
    });
  }, []);
  const implode = useCallback((square, options) => {
    if (!isValidSquare4(square)) return Promise.resolve();
    if (prefersReducedMotion() && !options?.force) return Promise.resolve();
    const existing = piecesRef.current.get(square);
    const pieceKey = options?.piece ?? (existing ? `${existing.color}${existing.role.toUpperCase()}` : void 0);
    const [col, row] = squareColRow5(square, asWhiteRef.current);
    const entry = {
      id: ++idRef.current,
      col,
      row,
      color: options?.color ?? DEFAULT_IMPLODE_COLOR,
      durationMs: Math.max(100, options?.durationMs ?? DEFAULT_IMPLODE_DURATION_MS),
      pieceKey
    };
    if (existing) {
      const orig = getPieceElementRef.current(square);
      if (orig) {
        orig.style.opacity = "0";
        hiddenSquaresRef.current.set(entry.id, square);
      }
    }
    return new Promise((resolve) => {
      resolversRef.current.set(entry.id, resolve);
      setImplodes((prev) => [...prev, entry]);
    });
  }, []);
  const castleSwap = useCallback((kingFrom, kingTo, rookFrom, rookTo, options) => {
    if (![kingFrom, kingTo, rookFrom, rookTo].every(isValidSquare4)) return Promise.resolve();
    if (prefersReducedMotion() && !options?.force) return Promise.resolve();
    const arc = options?.arcHeight ?? 0.9;
    const common = {
      style: "great",
      durationMs: options?.durationMs ?? DEFAULT_CASTLE_SWAP_DURATION_MS,
      spins: options?.spins ?? 1,
      glowColor: options?.glowColor ?? DEFAULT_CASTLE_SWAP_GLOW,
      sparkles: false,
      shockwave: false,
      flash: false,
      victimBlast: false,
      impactShake: false,
      trail: false,
      force: options?.force
    };
    const king = cinematicMove(kingFrom, kingTo, { ...common, arcHeight: arc });
    const rook = cinematicMove(rookFrom, rookTo, { ...common, arcHeight: arc * 0.4 });
    return Promise.all([king, rook]).then(() => void 0);
  }, [cinematicMove]);
  const spotlight = useCallback((squares, options) => {
    if (prefersReducedMotion() && !options?.force) return { clear: () => Promise.resolve() };
    const valid = squares.filter(isValidSquare4);
    if (valid.length === 0) return { clear: () => Promise.resolve() };
    const white = asWhiteRef.current;
    const rPct = (options?.radius ?? DEFAULT_SPOTLIGHT_RADIUS) * 12.5;
    const holes = valid.map((sq2) => {
      const [col, row] = squareColRow5(sq2, white);
      return { cx: (col + 0.5) * 12.5, cy: (row + 0.5) * 12.5, r: rPct };
    });
    const entry = {
      id: ++idRef.current,
      holes,
      color: options?.color ?? DEFAULT_SPOTLIGHT_COLOR,
      durationMs: Math.max(50, options?.durationMs ?? DEFAULT_SPOTLIGHT_DURATION_MS)
    };
    setSpotlights((prev) => [...prev, entry]);
    let cleared = false;
    const clear = (durationMs) => {
      if (cleared) return Promise.resolve();
      cleared = true;
      return new Promise((resolve) => {
        const fadeMs = Math.max(1, durationMs ?? entry.durationMs);
        const existing = animationsRef.current.get(entry.id) ?? [];
        const el = spotlightElsRef.current.get(entry.id);
        const remove = () => {
          for (const a of animationsRef.current.get(entry.id) ?? []) a.cancel();
          animationsRef.current.delete(entry.id);
          startedRef.current.delete(entry.id);
          spotlightElsRef.current.delete(entry.id);
          setSpotlights((prev) => prev.filter((s) => s.id !== entry.id));
          resolve();
        };
        if (el && canAnimate2(el)) {
          const from = typeof getComputedStyle === "function" && getComputedStyle(el).opacity || "1";
          const fade = el.animate(
            [{ opacity: from }, { opacity: 0 }],
            { duration: fadeMs, easing: "ease-out", fill: "forwards" }
          );
          animationsRef.current.set(entry.id, [...existing, fade]);
          waitForAnimation(fade, fadeMs).then(remove);
        } else {
          remove();
        }
      });
    };
    return { clear };
  }, []);
  const drawLaser = useCallback((from, to, options) => {
    if (!isValidSquare4(from) || !isValidSquare4(to)) return Promise.resolve();
    if (prefersReducedMotion() && !options?.force) return Promise.resolve();
    const white = asWhiteRef.current;
    const [fc, fr] = squareColRow5(from, white);
    const [tc, tr] = squareColRow5(to, white);
    const sx = (fc + 0.5) * 12.5;
    const sy = (fr + 0.5) * 12.5;
    const ex = (tc + 0.5) * 12.5;
    const ey = (tr + 0.5) * 12.5;
    const dxp = ex - sx;
    const dyp = ey - sy;
    const color = options?.color ?? DEFAULT_LASER_COLOR;
    const entry = {
      id: ++idRef.current,
      sx,
      sy,
      ex,
      ey,
      dist: Math.hypot(dxp, dyp),
      angle: Math.atan2(dyp, dxp) * 180 / Math.PI,
      color,
      glowColor: options?.glowColor ?? color,
      widthPx: Math.max(1, options?.widthPx ?? DEFAULT_LASER_WIDTH_PX),
      durationMs: Math.max(50, options?.durationMs ?? DEFAULT_LASER_DURATION_MS),
      persist: options?.persist ?? false,
      holdMs: Math.max(0, options?.holdMs ?? DEFAULT_LASER_HOLD_MS)
    };
    return new Promise((resolve) => {
      resolversRef.current.set(entry.id, resolve);
      setLasers((prev) => [...prev, entry]);
    });
  }, []);
  const clearCinematics = useCallback(() => {
    for (const anims of Array.from(animationsRef.current.values())) {
      for (const anim of anims) anim.cancel();
    }
    animationsRef.current.clear();
    for (const tid of timeoutsRef.current.values()) clearTimeout(tid);
    timeoutsRef.current.clear();
    for (const entry of movesRef.current) {
      if (entry.hiddenSquare) {
        const orig = getPieceElementRef.current(entry.hiddenSquare);
        if (orig) orig.style.opacity = "";
      }
    }
    for (const square of hiddenVictimsRef.current.values()) {
      const el = getPieceElementRef.current(square);
      if (el) el.style.opacity = "";
    }
    hiddenVictimsRef.current.clear();
    for (const square of hiddenSquaresRef.current.values()) {
      const el = getPieceElementRef.current(square);
      if (el) el.style.opacity = "";
    }
    hiddenSquaresRef.current.clear();
    spotlightElsRef.current.clear();
    const resolvers = Array.from(resolversRef.current.values());
    resolversRef.current.clear();
    startedRef.current.clear();
    finishedRef.current.clear();
    setMoves([]);
    setBursts([]);
    setBadges([]);
    setBlasts([]);
    setFlashes([]);
    setConfetti([]);
    setBanners([]);
    setPromos([]);
    setImplodes([]);
    setSpotlights([]);
    setLasers([]);
    for (const resolve of resolvers) resolve();
  }, []);
  useImperativeHandle(ref, () => ({
    cinematicMove,
    squareBurst,
    popBadge,
    celebrate,
    popBanner,
    promotionBeam,
    implode,
    castleSwap,
    spotlight,
    drawLaser,
    clearCinematics
  }), [cinematicMove, squareBurst, popBadge, celebrate, popBanner, promotionBeam, implode, castleSwap, spotlight, drawLaser, clearCinematics]);
  useEffect(() => {
    return () => {
      for (const anims of animationsRef.current.values()) {
        for (const anim of anims) anim.cancel();
      }
      animationsRef.current.clear();
      for (const tid of timeoutsRef.current.values()) clearTimeout(tid);
      timeoutsRef.current.clear();
      for (const square of hiddenSquaresRef.current.values()) {
        const el = getPieceElementRef.current(square);
        if (el) el.style.opacity = "";
      }
      hiddenSquaresRef.current.clear();
      for (const resolve of resolversRef.current.values()) resolve();
      resolversRef.current.clear();
    };
  }, []);
  if (moves.length === 0 && bursts.length === 0 && badges.length === 0 && blasts.length === 0 && flashes.length === 0 && confetti.length === 0 && banners.length === 0 && promos.length === 0 && implodes.length === 0 && spotlights.length === 0 && lasers.length === 0) return null;
  const pieceBox = { width: "12.5%", height: "12.5%" };
  return /* @__PURE__ */ jsxs("div", { "data-cine-overlay": true, style: { position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 10 }, children: [
    flashes.map((f) => /* @__PURE__ */ jsx(
      "div",
      {
        ref: (el) => {
          if (el) startFlashAnimation(el, f);
        },
        style: {
          position: "absolute",
          inset: 0,
          background: [
            `radial-gradient(circle at ${f.cxPct}% ${f.cyPct}%, #ffffff 0%, transparent 28%)`,
            `radial-gradient(circle at ${f.cxPct}% ${f.cyPct}%, ${f.color} 0%, transparent 62%)`
          ].join(", "),
          opacity: 0,
          willChange: "opacity",
          zIndex: 2
        }
      },
      `flash-${f.id}`
    )),
    bursts.map((b) => /* @__PURE__ */ jsxs(
      "div",
      {
        ref: (el) => {
          if (el) startBurstAnimation(el, b);
        },
        style: {
          position: "absolute",
          ...pieceBox,
          transform: positionTransform(b.col, b.row),
          pointerEvents: "none",
          zIndex: 4
        },
        children: [
          b.kind !== "sparkles" && /* @__PURE__ */ jsx(
            "div",
            {
              style: {
                position: "absolute",
                inset: "8%",
                borderRadius: "50%",
                border: `3px solid ${b.color}`,
                boxShadow: `0 0 10px ${b.color}`,
                opacity: 0,
                willChange: "transform, opacity"
              }
            }
          ),
          b.kind !== "shockwave" && b.particles.map((p, i) => /* @__PURE__ */ jsx(
            "div",
            {
              style: { position: "absolute", inset: 0, opacity: 0, willChange: "transform, opacity" },
              children: /* @__PURE__ */ jsx(
                "div",
                {
                  style: {
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: `${p.size}%`,
                    height: `${p.size}%`,
                    marginLeft: `${-p.size / 2}%`,
                    marginTop: `${-p.size / 2}%`,
                    borderRadius: "50%",
                    background: b.color,
                    boxShadow: `0 0 6px ${b.color}`
                  }
                }
              )
            },
            i
          ))
        ]
      },
      `burst-${b.id}`
    )),
    blasts.map((bl) => /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          position: "absolute",
          ...pieceBox,
          transform: positionTransform(bl.col, bl.row),
          pointerEvents: "none",
          zIndex: 4
        },
        children: /* @__PURE__ */ jsx(
          "div",
          {
            ref: (el) => {
              if (el) startBlastAnimation(el, bl);
            },
            style: { width: "100%", height: "100%", willChange: "transform, opacity" },
            children: /* @__PURE__ */ jsx(
              "div",
              {
                style: {
                  width: "100%",
                  height: "100%",
                  transform: flipPieces ? "rotate(180deg)" : void 0,
                  transformOrigin: "center center"
                },
                children: /* @__PURE__ */ jsx(PieceGlyph, { pieceKey: bl.pieceKey, pieceSet, customPieces })
              }
            )
          }
        )
      },
      `blast-${bl.id}`
    )),
    badges.map((bd) => /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          position: "absolute",
          ...pieceBox,
          transform: positionTransform(bd.col, bd.row),
          pointerEvents: "none",
          zIndex: 5
        },
        children: /* @__PURE__ */ jsx(
          "span",
          {
            style: {
              position: "absolute",
              ...bd.corner === "center" ? { top: "50%", left: "50%", transform: "translate(-50%, -50%)" } : { top: "-6%", right: "-6%" }
            },
            children: /* @__PURE__ */ jsx(
              "span",
              {
                ref: (el) => {
                  if (el) startBadgeAnimation(el, bd);
                },
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "1.6em",
                  height: "1.6em",
                  padding: "0 0.3em",
                  borderRadius: "999px",
                  background: bd.background,
                  color: bd.color,
                  fontSize: "clamp(10px, 2.4vmin, 20px)",
                  fontWeight: 800,
                  fontFamily: "system-ui, sans-serif",
                  lineHeight: 1,
                  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.35)",
                  opacity: 0,
                  willChange: "transform, opacity"
                },
                children: bd.text
              }
            )
          }
        )
      },
      `badge-${bd.id}`
    )),
    moves.map((m) => /* @__PURE__ */ jsxs(
      "div",
      {
        ref: (el) => {
          if (el) startMoveAnimation(el, m);
        },
        style: { position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3 },
        children: [
          Array.from({ length: m.opts.trailCount }, (_, i) => /* @__PURE__ */ jsx(
            "div",
            {
              "data-cine-trail": true,
              style: {
                position: "absolute",
                ...pieceBox,
                transform: positionTransform(m.fromCol, m.fromRow),
                opacity: 0,
                willChange: "transform, opacity"
              },
              children: /* @__PURE__ */ jsx(
                "div",
                {
                  style: {
                    width: "100%",
                    height: "100%",
                    transform: `${flipPieces ? "rotate(180deg) " : ""}scale(${0.92 - i * 0.05})`,
                    transformOrigin: "center center",
                    filter: "blur(1px)"
                  },
                  children: /* @__PURE__ */ jsx(PieceGlyph, { pieceKey: m.pieceKey, pieceSet, customPieces })
                }
              )
            },
            `trail-${i}`
          )),
          /* @__PURE__ */ jsx(
            "div",
            {
              "data-cine-hero": true,
              style: {
                position: "absolute",
                ...pieceBox,
                transform: positionTransform(m.fromCol, m.fromRow),
                willChange: "transform"
              },
              children: /* @__PURE__ */ jsx("div", { style: { width: "100%", height: "100%", perspective: 800 }, children: /* @__PURE__ */ jsx(
                "div",
                {
                  style: {
                    width: "100%",
                    height: "100%",
                    transformOrigin: "center center",
                    transformStyle: "preserve-3d",
                    willChange: "transform, filter"
                  },
                  children: /* @__PURE__ */ jsx(
                    "div",
                    {
                      style: {
                        width: "100%",
                        height: "100%",
                        transform: flipPieces ? "rotate(180deg)" : void 0,
                        transformOrigin: "center center"
                      },
                      children: /* @__PURE__ */ jsx(PieceGlyph, { pieceKey: m.pieceKey, pieceSet, customPieces })
                    }
                  )
                }
              ) })
            }
          )
        ]
      },
      `cine-${m.id}`
    )),
    confetti.map((c) => /* @__PURE__ */ jsx(
      "div",
      {
        ref: (el) => {
          if (el) startConfettiAnimation(el, c);
        },
        style: { position: "absolute", inset: 0, pointerEvents: "none", zIndex: 6 },
        children: c.flakes.map((f, i) => /* @__PURE__ */ jsx(
          "div",
          {
            style: {
              position: "absolute",
              top: `${-f.hPct - 3}%`,
              left: `${f.leftPct}%`,
              width: `${f.wPct}%`,
              height: `${f.hPct}%`,
              background: f.color,
              borderRadius: f.round ? "50%" : "18%",
              opacity: 0,
              willChange: "transform, opacity"
            }
          },
          i
        ))
      },
      `confetti-${c.id}`
    )),
    banners.map((bn) => /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 7
        },
        children: /* @__PURE__ */ jsx(
          "span",
          {
            ref: (el) => {
              if (el) startBannerAnimation(el, bn);
            },
            style: {
              maxWidth: "92%",
              padding: bn.background ? "0.25em 0.9em" : void 0,
              borderRadius: bn.background ? "999px" : void 0,
              background: bn.background,
              color: bn.color,
              fontSize: "clamp(20px, 7.5vmin, 60px)",
              fontWeight: 900,
              fontFamily: "system-ui, sans-serif",
              letterSpacing: "0.06em",
              textAlign: "center",
              lineHeight: 1.1,
              textShadow: `0 0 18px ${bn.glowColor}, 0 0 42px ${bn.glowColor}, 0 2px 4px rgba(0, 0, 0, 0.45)`,
              opacity: 0,
              willChange: "transform, opacity"
            },
            children: bn.text
          }
        )
      },
      `banner-${bn.id}`
    )),
    spotlights.map((s) => {
      const mask = s.holes.map((h) => `radial-gradient(circle at ${h.cx}% ${h.cy}%, transparent 0, transparent ${h.r * 0.7}%, black ${h.r}%)`).join(", ");
      return /* @__PURE__ */ jsx(
        "div",
        {
          ref: (el) => {
            if (el) startSpotlightAnimation(el, s);
          },
          style: {
            position: "absolute",
            inset: 0,
            background: s.color,
            opacity: 0,
            pointerEvents: "none",
            willChange: "opacity",
            zIndex: 1,
            maskImage: mask,
            WebkitMaskImage: mask,
            maskComposite: "intersect",
            WebkitMaskComposite: "source-in"
          }
        },
        `spotlight-${s.id}`
      );
    }),
    promos.map((p) => /* @__PURE__ */ jsxs(
      "div",
      {
        ref: (el) => {
          if (el) startPromotionAnimation(el, p);
        },
        style: {
          position: "absolute",
          ...pieceBox,
          transform: positionTransform(p.col, p.row),
          pointerEvents: "none",
          perspective: 800,
          zIndex: 4
        },
        children: [
          /* @__PURE__ */ jsx(
            "div",
            {
              "data-promo-pillar": true,
              style: {
                position: "absolute",
                left: "50%",
                bottom: "50%",
                width: "50%",
                height: "320%",
                marginLeft: "-25%",
                background: `linear-gradient(to top, ${p.color} 0%, transparent 85%)`,
                filter: "blur(1px)",
                transformOrigin: "bottom center",
                opacity: 0,
                willChange: "transform, opacity"
              }
            }
          ),
          /* @__PURE__ */ jsx(
            "div",
            {
              "data-promo-ring": true,
              style: {
                position: "absolute",
                inset: "8%",
                borderRadius: "50%",
                border: `3px solid ${p.color}`,
                boxShadow: `0 0 10px ${p.color}`,
                opacity: 0,
                willChange: "transform, opacity"
              }
            }
          ),
          p.fromPieceKey && /* @__PURE__ */ jsx(
            "div",
            {
              "data-promo-old": true,
              style: { position: "absolute", inset: 0, opacity: 1, transformOrigin: "center center", willChange: "transform, opacity" },
              children: /* @__PURE__ */ jsx("div", { style: { width: "100%", height: "100%", transform: flipPieces ? "rotate(180deg)" : void 0, transformOrigin: "center center" }, children: /* @__PURE__ */ jsx(PieceGlyph, { pieceKey: p.fromPieceKey, pieceSet, customPieces }) })
            }
          ),
          p.toPieceKey && /* @__PURE__ */ jsx(
            "div",
            {
              "data-promo-new": true,
              style: { position: "absolute", inset: 0, opacity: 0, transformStyle: "preserve-3d", transformOrigin: "center center", willChange: "transform, opacity, filter" },
              children: /* @__PURE__ */ jsx("div", { style: { width: "100%", height: "100%", transform: flipPieces ? "rotate(180deg)" : void 0, transformOrigin: "center center" }, children: /* @__PURE__ */ jsx(PieceGlyph, { pieceKey: p.toPieceKey, pieceSet, customPieces }) })
            }
          ),
          /* @__PURE__ */ jsx(
            "div",
            {
              "data-promo-flash": true,
              style: {
                position: "absolute",
                inset: "-40%",
                borderRadius: "50%",
                background: `radial-gradient(circle, #ffffff 0%, ${p.color} 35%, transparent 70%)`,
                opacity: 0,
                willChange: "opacity"
              }
            }
          )
        ]
      },
      `promo-${p.id}`
    )),
    implodes.map((im) => /* @__PURE__ */ jsxs(
      "div",
      {
        ref: (el) => {
          if (el) startImplodeAnimation(el, im);
        },
        style: {
          position: "absolute",
          ...pieceBox,
          transform: positionTransform(im.col, im.row),
          pointerEvents: "none",
          zIndex: 4
        },
        children: [
          /* @__PURE__ */ jsx(
            "div",
            {
              "data-implode-ring": true,
              style: { position: "absolute", inset: "-12%", borderRadius: "50%", border: `2px solid ${im.color}`, boxShadow: `0 0 10px ${im.color}`, opacity: 0, willChange: "transform, opacity" }
            }
          ),
          /* @__PURE__ */ jsx(
            "div",
            {
              "data-implode-ring": true,
              style: { position: "absolute", inset: "12%", borderRadius: "50%", border: `2px solid ${im.color}`, boxShadow: `0 0 10px ${im.color}`, opacity: 0, willChange: "transform, opacity" }
            }
          ),
          /* @__PURE__ */ jsx(
            "div",
            {
              "data-implode-core": true,
              style: { position: "absolute", inset: "28%", borderRadius: "50%", background: "radial-gradient(circle, rgba(0, 0, 0, 0.9), transparent 70%)", opacity: 0, willChange: "transform, opacity" }
            }
          ),
          im.pieceKey && /* @__PURE__ */ jsx(
            "div",
            {
              "data-implode-piece": true,
              style: { position: "absolute", inset: 0, opacity: 1, transformOrigin: "center center", willChange: "transform, opacity" },
              children: /* @__PURE__ */ jsx("div", { style: { width: "100%", height: "100%", transform: flipPieces ? "rotate(180deg)" : void 0, transformOrigin: "center center" }, children: /* @__PURE__ */ jsx(PieceGlyph, { pieceKey: im.pieceKey, pieceSet, customPieces }) })
            }
          ),
          /* @__PURE__ */ jsx(
            "div",
            {
              "data-implode-flash": true,
              style: { position: "absolute", inset: "-30%", borderRadius: "50%", background: `radial-gradient(circle, #ffffff 0%, ${im.color} 40%, transparent 70%)`, opacity: 0, willChange: "opacity" }
            }
          )
        ]
      },
      `implode-${im.id}`
    )),
    lasers.map((l) => {
      const gradient = HEX6.test(l.color) ? `linear-gradient(90deg, ${l.color}00 0%, ${l.color} 60%, #ffffff 100%)` : `linear-gradient(90deg, transparent, ${l.color} 60%, #ffffff)`;
      return /* @__PURE__ */ jsxs(
        "div",
        {
          ref: (el) => {
            if (el) startLaserAnimation(el, l);
          },
          style: { position: "absolute", inset: 0, pointerEvents: "none", zIndex: 8 },
          children: [
            /* @__PURE__ */ jsx(
              "div",
              {
                "data-laser-beam": true,
                style: {
                  position: "absolute",
                  left: `${l.sx}%`,
                  top: `${l.sy}%`,
                  width: `${l.dist}%`,
                  height: `${l.widthPx}px`,
                  marginTop: `${-l.widthPx / 2}px`,
                  transformOrigin: "0 50%",
                  transform: `rotate(${l.angle}deg)`,
                  background: gradient,
                  borderRadius: `${l.widthPx}px`,
                  boxShadow: `0 0 ${l.widthPx * 2}px ${l.glowColor}, 0 0 ${l.widthPx * 4}px ${l.glowColor}`,
                  opacity: 0,
                  willChange: "transform, opacity"
                }
              }
            ),
            /* @__PURE__ */ jsx(
              "div",
              {
                "data-laser-tip": true,
                style: {
                  position: "absolute",
                  left: `${l.ex}%`,
                  top: `${l.ey}%`,
                  width: `${l.widthPx * 3}px`,
                  height: `${l.widthPx * 3}px`,
                  marginLeft: `${-l.widthPx * 1.5}px`,
                  marginTop: `${-l.widthPx * 1.5}px`,
                  borderRadius: "50%",
                  background: `radial-gradient(circle, #ffffff 0%, ${l.glowColor} 40%, transparent 70%)`,
                  opacity: 0,
                  willChange: "opacity"
                }
              }
            )
          ]
        },
        `laser-${l.id}`
      );
    })
  ] });
}));

// src/cinematics/camera.ts
var DEFAULT_ZOOM_SCALE = 1.6;
var DEFAULT_ZOOM_DURATION_MS = 600;
var DEFAULT_ZOOM_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
var DEFAULT_TILT_DEG = 18;
var DEFAULT_SHAKE_INTENSITY_PX = 6;
var DEFAULT_SHAKE_DURATION_MS = 400;
var DEFAULT_DRIFT_SCALE = 1.06;
var DEFAULT_DRIFT_DURATION_MS = 6e3;
function squareColRow6(sq2, asWhite) {
  const f = sq2.charCodeAt(0) - 97;
  const r = sq2.charCodeAt(1) - 49;
  return [asWhite ? f : 7 - f, asWhite ? 7 - r : r];
}
function isValidSquare5(sq2) {
  return typeof sq2 === "string" && /^[a-h][1-8]$/.test(sq2);
}
function createCameraController(getRoot, getAsWhite) {
  const state = { scale: 1, rotateX: 0, rotateY: 0 };
  const active = /* @__PURE__ */ new Set();
  const composeTransform = () => {
    const parts = [];
    if (state.rotateX !== 0 || state.rotateY !== 0) {
      parts.push("perspective(1000px)");
      if (state.rotateX !== 0) parts.push(`rotateX(${state.rotateX}deg)`);
      if (state.rotateY !== 0) parts.push(`rotateY(${state.rotateY}deg)`);
    }
    if (state.scale !== 1) parts.push(`scale(${state.scale})`);
    return parts.length > 0 ? parts.join(" ") : "none";
  };
  const applyEndState = (root, target) => {
    root.style.transform = target === "none" ? "" : target;
  };
  const animateTo = (root, target, durationMs, easing2) => {
    if (!canAnimate2(root) || durationMs <= 0) {
      applyEndState(root, target);
      return Promise.resolve();
    }
    const from = typeof getComputedStyle === "function" && getComputedStyle(root).transform || "none";
    const anim = root.animate(
      [{ transform: from }, { transform: target }],
      { duration: durationMs, easing: easing2 }
    );
    active.add(anim);
    return waitForAnimation(anim, durationMs).then(() => {
      if (active.has(anim)) {
        active.delete(anim);
        applyEndState(root, target);
        anim.cancel();
      }
    });
  };
  const skip = (force) => prefersReducedMotion() && !force;
  return {
    zoomTo(square, options) {
      const root = getRoot();
      if (!root || !isValidSquare5(square) || skip(options?.force)) return Promise.resolve();
      const [col, row] = squareColRow6(square, getAsWhite());
      root.style.transformOrigin = `${(col + 0.5) * 12.5}% ${(row + 0.5) * 12.5}%`;
      state.scale = options?.scale ?? DEFAULT_ZOOM_SCALE;
      return animateTo(
        root,
        composeTransform(),
        options?.durationMs ?? DEFAULT_ZOOM_DURATION_MS,
        options?.easing ?? DEFAULT_ZOOM_EASING
      );
    },
    zoomOut(options) {
      const root = getRoot();
      if (!root || skip(options?.force)) return Promise.resolve();
      state.scale = 1;
      return animateTo(
        root,
        composeTransform(),
        options?.durationMs ?? DEFAULT_ZOOM_DURATION_MS,
        options?.easing ?? DEFAULT_ZOOM_EASING
      );
    },
    tilt(options) {
      const root = getRoot();
      if (!root || skip(options?.force)) return Promise.resolve();
      state.rotateX = options?.rotateX ?? DEFAULT_TILT_DEG;
      state.rotateY = options?.rotateY ?? 0;
      return animateTo(
        root,
        composeTransform(),
        options?.durationMs ?? DEFAULT_ZOOM_DURATION_MS,
        options?.easing ?? DEFAULT_ZOOM_EASING
      );
    },
    shake(options) {
      const root = getRoot();
      if (!root || !canAnimate2(root) || skip(options?.force)) return Promise.resolve();
      const intensity = options?.intensity ?? DEFAULT_SHAKE_INTENSITY_PX;
      const durationMs = options?.durationMs ?? DEFAULT_SHAKE_DURATION_MS;
      const steps = 6;
      const frames = [{ transform: "translate(0px, 0px)" }];
      for (let i = 1; i <= steps; i++) {
        const amp = intensity * (1 - i / (steps + 1));
        const sign = i % 2 === 0 ? 1 : -1;
        frames.push({ transform: `translate(${sign * amp}px, ${-sign * amp * 0.6}px)` });
      }
      frames.push({ transform: "translate(0px, 0px)" });
      let anim;
      try {
        anim = root.animate(frames, { duration: durationMs, easing: "ease-out", composite: "add" });
      } catch {
        anim = root.animate(frames, { duration: durationMs, easing: "ease-out" });
      }
      active.add(anim);
      return waitForAnimation(anim, durationMs).then(() => {
        active.delete(anim);
      });
    },
    drift(options) {
      const root = getRoot();
      if (!root || !canAnimate2(root) || skip(options?.force)) return { stop: () => {
      } };
      const scale = options?.scale ?? DEFAULT_DRIFT_SCALE;
      const durationMs = options?.durationMs ?? DEFAULT_DRIFT_DURATION_MS;
      const base = composeTransform();
      const prefix = base === "none" ? "" : `${base} `;
      const wander = (scale - 1) * 100;
      const anim = root.animate(
        [
          { transform: `${prefix}translate(0%, 0%) scale(1)` },
          { transform: `${prefix}translate(${-wander / 2}%, ${wander / 3}%) scale(${scale})` }
        ],
        { duration: Math.max(500, durationMs), easing: "ease-in-out", direction: "alternate", iterations: Infinity }
      );
      active.add(anim);
      return {
        stop: () => {
          if (active.has(anim)) {
            active.delete(anim);
            anim.cancel();
          }
        }
      };
    },
    reset() {
      for (const anim of Array.from(active)) anim.cancel();
      active.clear();
      state.scale = 1;
      state.rotateX = 0;
      state.rotateY = 0;
      const root = getRoot();
      if (root) {
        root.style.transform = "";
        root.style.transformOrigin = "";
      }
    }
  };
}

// src/cinematics/director.ts
function playCinematicScript(ctx, steps, options) {
  let cancelled = false;
  const cancelHooks = /* @__PURE__ */ new Set();
  const force = options?.force;
  let activeSpotlight = null;
  const wait = (ms) => new Promise((resolve) => {
    const hook = () => {
      clearTimeout(tid);
      resolve();
    };
    const tid = setTimeout(() => {
      cancelHooks.delete(hook);
      resolve();
    }, ms);
    cancelHooks.add(hook);
  });
  const runStep = async (step) => {
    if (cancelled) return;
    switch (step.type) {
      case "move": {
        await ctx.getLayer()?.cinematicMove(step.from, step.to, { force, ...step.options });
        break;
      }
      case "camera": {
        const opts = step.options;
        switch (step.action) {
          case "zoomTo":
            if (step.square) {
              await ctx.getCamera().zoomTo(step.square, { force, ...opts });
            }
            break;
          case "zoomOut":
            await ctx.getCamera().zoomOut({ force, ...opts });
            break;
          case "tilt":
            await ctx.getCamera().tilt({ force, ...opts });
            break;
          case "shake":
            await ctx.getCamera().shake({ force, ...opts });
            break;
          case "reset":
            ctx.peekCamera()?.reset();
            break;
        }
        break;
      }
      case "burst": {
        await ctx.getLayer()?.squareBurst(step.square, { force, ...step.options });
        break;
      }
      case "badge": {
        await ctx.getLayer()?.popBadge(step.square, { force, ...step.options });
        break;
      }
      case "celebrate": {
        await ctx.getLayer()?.celebrate({ force, ...step.options });
        break;
      }
      case "banner": {
        await ctx.getLayer()?.popBanner({ force, ...step.options });
        break;
      }
      case "promotionBeam": {
        await ctx.getLayer()?.promotionBeam(step.square, { force, ...step.options });
        break;
      }
      case "implode": {
        await ctx.getLayer()?.implode(step.square, { force, ...step.options });
        break;
      }
      case "castleSwap": {
        await ctx.getLayer()?.castleSwap(step.kingFrom, step.kingTo, step.rookFrom, step.rookTo, { force, ...step.options });
        break;
      }
      case "spotlight": {
        activeSpotlight = ctx.getLayer()?.spotlight(step.squares, { force, ...step.options }) ?? null;
        break;
      }
      case "clearSpotlight": {
        await activeSpotlight?.clear();
        activeSpotlight = null;
        break;
      }
      case "laser": {
        await ctx.getLayer()?.drawLaser(step.from, step.to, { force, ...step.options });
        break;
      }
      case "wait": {
        await wait(step.ms);
        break;
      }
      case "parallel": {
        await Promise.all(step.steps.map(runStep));
        break;
      }
      case "call": {
        await step.fn();
        break;
      }
    }
  };
  const finished = (async () => {
    for (const step of steps) {
      if (cancelled) break;
      await runStep(step);
    }
  })();
  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    for (const hook of Array.from(cancelHooks)) hook();
    cancelHooks.clear();
    activeSpotlight?.clear();
    activeSpotlight = null;
    ctx.getLayer()?.clearCinematics();
    ctx.peekCamera()?.reset();
  };
  return { finished, cancel };
}
function pos2user(fileIdx, rankIdx, asWhite, boardWidth, boardHeight) {
  const f = asWhite ? fileIdx : 7 - fileIdx;
  const r = asWhite ? rankIdx : 7 - rankIdx;
  const xScale = Math.min(1, boardWidth / boardHeight);
  const yScale = Math.min(1, boardHeight / boardWidth);
  return [(f - 3.5) * xScale, (3.5 - r) * yScale];
}
function squareToFileRank(sq2) {
  if (sq2.length !== 2) return null;
  const f = sq2.charCodeAt(0) - 97;
  const r = parseInt(sq2[1]) - 1;
  if (f < 0 || f > 7 || r < 0 || r > 7) return null;
  return [f, r];
}
function fmt(p) {
  return `${p[0].toFixed(4)},${p[1].toFixed(4)}`;
}
function buildRoundedPolygon(V, roundness, skipIndex) {
  const n = V.length;
  const t = Math.max(0, Math.min(1, roundness));
  const edgeLen = [];
  for (let i = 0; i < n; i++) {
    const a = V[i];
    const b = V[(i + 1) % n];
    edgeLen.push(Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const offset = [];
  for (let i = 0; i < n; i++) {
    const prevLen = edgeLen[(i - 1 + n) % n];
    const nextLen = edgeLen[i];
    offset.push(Math.min(prevLen, nextLen) / 2 * t);
  }
  const entries = [];
  const exits = [];
  for (let i = 0; i < n; i++) {
    const prev = V[(i - 1 + n) % n];
    const curr = V[i];
    const next = V[(i + 1) % n];
    const r = offset[i];
    const dxP = prev[0] - curr[0], dyP = prev[1] - curr[1];
    const dxN = next[0] - curr[0], dyN = next[1] - curr[1];
    const lP = Math.hypot(dxP, dyP) || 1;
    const lN = Math.hypot(dxN, dyN) || 1;
    entries.push([curr[0] + dxP / lP * r, curr[1] + dyP / lP * r]);
    exits.push([curr[0] + dxN / lN * r, curr[1] + dyN / lN * r]);
  }
  const fillParts = [`M${fmt(exits[0])}`];
  for (let i = 1; i <= n; i++) {
    const idx = i % n;
    fillParts.push(`L${fmt(entries[idx])}`);
    if (offset[idx] > 1e-4) {
      fillParts.push(`Q${fmt(V[idx])} ${fmt(exits[idx])}`);
    } else {
      fillParts.push(`L${fmt(V[idx])}`);
    }
  }
  fillParts.push("Z");
  let strokePath = "";
  {
    strokePath = fillParts.slice(0, -1).join(" ");
  }
  return { fill: fillParts.join(" "), stroke: strokePath };
}
function computeHeadPath(shape, hl, hw, roundness) {
  const h = hw / 2;
  switch (shape) {
    case "classic":
    default: {
      const vertices = [[0, 0], [hl, h], [0, hw]];
      const { fill, stroke } = buildRoundedPolygon(vertices, roundness);
      return { fill, stroke, isOpen: false };
    }
    case "open": {
      const d = `M0,0 L${hl},${h} L0,${hw}`;
      return { fill: d, stroke: d, isOpen: true };
    }
    case "concave": {
      const nx = hl * 0.28;
      const vertices = [[0, 0], [hl, h], [0, hw], [nx, h]];
      const { fill, stroke } = buildRoundedPolygon(vertices, roundness);
      return { fill, stroke, isOpen: false };
    }
    case "diamond": {
      const cx = hl / 2;
      const vertices = [[0, h], [cx, 0], [hl, h], [cx, hw]];
      const { fill, stroke } = buildRoundedPolygon(vertices, roundness);
      return { fill, stroke, isOpen: false };
    }
  }
}
function markerKey(prefix, color, shape, variant) {
  const safe = color.replace(/[^a-zA-Z0-9]/g, "");
  return `cc-${prefix}-${shape}-${variant}-${safe}`;
}
var ArrowsLayer = memo(function ArrowsLayer2({
  arrows,
  orientation,
  boardWidth,
  boardHeight,
  visuals = {}
}) {
  const asWhite = orientation === "white";
  const lineWidth = visuals.lineWidth ?? 0.086;
  const margin = visuals.margin ?? 0.18;
  const startOffset = visuals.startOffset ?? 0;
  const lineOpacity = visuals.opacity ?? 0.85;
  const lineCap = visuals.lineCap ?? "round";
  const lineJoin = visuals.lineJoin ?? "miter";
  const dashArray = visuals.dashArray ?? visuals.dash;
  const dashOffset = visuals.dashOffset ?? 0;
  const knightArrowShape = visuals.knightArrowShape ?? "l-shaped";
  const headLength = visuals.headLength ?? visuals.markerWidth ?? 3.2;
  const headWidth = visuals.headWidth ?? visuals.markerHeight ?? 3.5;
  const headShape = visuals.headShape ?? "classic";
  const headRoundness = Math.max(0, Math.min(1, visuals.headCornerRadius ?? 0));
  const outlineColor = visuals.outlineColor ?? "rgba(0,0,0,0.45)";
  const outlineWidth = visuals.outlineWidth ?? 0;
  const hasOutline = outlineWidth > 0;
  const markerOutlineWidth = hasOutline && lineWidth > 0 ? outlineWidth / lineWidth : 0;
  const headPaths = useMemo(
    () => computeHeadPath(headShape, headLength, headWidth, headRoundness),
    [headShape, headLength, headWidth, headRoundness]
  );
  const { fill: headFillPath, stroke: headStrokePath, isOpen: isOpenHead } = headPaths;
  const markerVariant = useMemo(
    () => [
      headLength.toFixed(2),
      headWidth.toFixed(2),
      headRoundness.toFixed(3),
      hasOutline ? `o${outlineWidth.toFixed(3)}` : "0",
      lineJoin
    ].join("_"),
    [headLength, headWidth, headRoundness, hasOutline, outlineWidth, lineJoin]
  );
  const markerRefX = visuals.markerRefX ?? (headShape === "diamond" ? headLength / 2 : 0);
  const markerRefY = visuals.markerRefY ?? headWidth / 2;
  const headForwardExtent = useMemo(() => {
    switch (headShape) {
      case "diamond":
        return headLength / 2 * lineWidth;
      case "open":
      case "concave":
      case "classic":
      default:
        return headLength * lineWidth;
    }
  }, [headShape, headLength, lineWidth]);
  const uniqueColors = useMemo(() => {
    const set = /* @__PURE__ */ new Set();
    for (const a of arrows) set.add(a.color);
    return [...set];
  }, [arrows]);
  if (arrows.length === 0 || boardWidth === 0) return null;
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      style: {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "visible",
        zIndex: 5
      },
      viewBox: "-4 -4 8 8",
      preserveAspectRatio: "xMidYMid slice",
      children: [
        /* @__PURE__ */ jsx("defs", { children: uniqueColors.map((color) => {
          const mainId = markerKey("h", color, headShape, markerVariant);
          return /* @__PURE__ */ jsx(
            "marker",
            {
              id: mainId,
              orient: "auto",
              overflow: "visible",
              markerWidth: headLength,
              markerHeight: headWidth,
              refX: markerRefX,
              refY: markerRefY,
              children: isOpenHead ? /* @__PURE__ */ jsx(
                "path",
                {
                  d: headStrokePath,
                  fill: "none",
                  stroke: color,
                  strokeWidth: Math.max(0.45, headWidth * 0.2),
                  strokeLinejoin: "round",
                  strokeLinecap: "round"
                }
              ) : /* @__PURE__ */ jsxs(Fragment, { children: [
                hasOutline && /* @__PURE__ */ jsx(
                  "path",
                  {
                    d: headStrokePath,
                    fill: "none",
                    stroke: outlineColor,
                    strokeWidth: markerOutlineWidth,
                    strokeLinejoin: lineJoin,
                    strokeLinecap: "butt"
                  }
                ),
                /* @__PURE__ */ jsx("path", { d: headFillPath, fill: color })
              ] })
            },
            mainId
          );
        }) }),
        arrows.map((arrow, i) => {
          const fromFR = squareToFileRank(arrow.startSquare);
          const toFR = squareToFileRank(arrow.endSquare);
          if (!fromFR || !toFR) return null;
          const from = pos2user(fromFR[0], fromFR[1], asWhite, boardWidth, boardHeight);
          const to = pos2user(toFR[0], toFR[1], asWhite, boardWidth, boardHeight);
          const dx = to[0] - from[0];
          const dy = to[1] - from[1];
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist === 0) return null;
          const markerUrl = `url(#${markerKey("h", arrow.color, headShape, markerVariant)})`;
          const keyBase = `${arrow.startSquare}-${arrow.endSquare}-${arrow.color}-${i}`;
          const lineShorten = margin + headForwardExtent;
          const df = toFR[0] - fromFR[0];
          const dr = toFR[1] - fromFR[1];
          const isKnight = Math.abs(df) === 1 && Math.abs(dr) === 2 || Math.abs(df) === 2 && Math.abs(dr) === 1;
          if (isKnight && knightArrowShape === "l-shaped") {
            const cornerFR = Math.abs(dr) === 2 ? [fromFR[0], toFR[1]] : [toFR[0], fromFR[1]];
            const corner = pos2user(cornerFR[0], cornerFR[1], asWhite, boardWidth, boardHeight);
            const l1x = corner[0] - from[0];
            const l1y = corner[1] - from[1];
            const l1 = Math.hypot(l1x, l1y) || 1;
            const l2x = to[0] - corner[0];
            const l2y = to[1] - corner[1];
            const l2 = Math.hypot(l2x, l2y) || 1;
            const sX = from[0] + l1x / l1 * startOffset;
            const sY = from[1] + l1y / l1 * startOffset;
            const eX = to[0] - l2x / l2 * lineShorten;
            const eY = to[1] - l2y / l2 * lineShorten;
            const d = `M${sX.toFixed(4)},${sY.toFixed(4)} L${corner[0].toFixed(4)},${corner[1].toFixed(4)} L${eX.toFixed(4)},${eY.toFixed(4)}`;
            return /* @__PURE__ */ jsxs("g", { opacity: lineOpacity, children: [
              hasOutline && /* @__PURE__ */ jsx(
                "path",
                {
                  d,
                  fill: "none",
                  stroke: outlineColor,
                  strokeWidth: lineWidth + outlineWidth * 2,
                  strokeLinecap: lineCap,
                  strokeLinejoin: lineJoin,
                  strokeDasharray: dashArray,
                  strokeDashoffset: dashOffset
                }
              ),
              /* @__PURE__ */ jsx(
                "path",
                {
                  d,
                  fill: "none",
                  stroke: arrow.color,
                  strokeWidth: lineWidth,
                  strokeLinecap: lineCap,
                  strokeLinejoin: lineJoin,
                  strokeDasharray: dashArray,
                  strokeDashoffset: dashOffset,
                  markerEnd: markerUrl
                }
              )
            ] }, keyBase);
          }
          const ux = dx / dist;
          const uy = dy / dist;
          const startX = from[0] + ux * startOffset;
          const startY = from[1] + uy * startOffset;
          const endX = to[0] - ux * lineShorten;
          const endY = to[1] - uy * lineShorten;
          return /* @__PURE__ */ jsxs("g", { opacity: lineOpacity, children: [
            hasOutline && /* @__PURE__ */ jsx(
              "line",
              {
                x1: startX,
                y1: startY,
                x2: endX,
                y2: endY,
                stroke: outlineColor,
                strokeWidth: lineWidth + outlineWidth * 2,
                strokeLinecap: lineCap,
                strokeDasharray: dashArray,
                strokeDashoffset: dashOffset
              }
            ),
            /* @__PURE__ */ jsx(
              "line",
              {
                x1: startX,
                y1: startY,
                x2: endX,
                y2: endY,
                stroke: arrow.color,
                strokeWidth: lineWidth,
                strokeLinecap: lineCap,
                strokeLinejoin: lineJoin,
                strokeDasharray: dashArray,
                strokeDashoffset: dashOffset,
                markerEnd: markerUrl
              }
            )
          ] }, keyBase);
        })
      ]
    }
  );
});
var Notation = memo(function Notation2({
  orientation,
  theme,
  showOnMargin,
  marginThickness,
  marginRadius,
  visuals = {}
}) {
  const asWhite = orientation === "white";
  const files = asWhite ? FILES : [...FILES].reverse();
  const ranks = asWhite ? [...RANKS].reverse() : RANKS;
  if (showOnMargin) {
    return /* @__PURE__ */ jsx(
      MarginNotation,
      {
        files,
        ranks,
        theme,
        thickness: marginThickness,
        radius: marginRadius,
        visuals
      }
    );
  }
  return /* @__PURE__ */ jsx(OnBoardNotation, { files, ranks, theme, orientation, visuals });
});
var DEFAULT_NOTATION_VISUALS = {
  fontFamily: "var(--font-geist-sans, system-ui, sans-serif)",
  fontSize: "12px",
  fontWeight: 500,
  color: "",
  onLightSquareColor: "",
  onDarkSquareColor: "",
  opacity: 0.85,
  onBoardFontSize: "10px",
  onBoardLeftOffset: "2px",
  onBoardBottomOffset: "1px"
};
var coordStyle = (theme, visuals) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: visuals.fontSize,
  fontWeight: visuals.fontWeight,
  fontFamily: visuals.fontFamily,
  color: visuals.color || theme.lightSquare,
  userSelect: "none"
});
function MarginNotation({
  files,
  ranks,
  theme,
  thickness,
  radius,
  visuals
}) {
  const notationVisuals = { ...DEFAULT_NOTATION_VISUALS, ...visuals };
  const bg = theme.margin || theme.darkSquare;
  const cs = coordStyle(theme, notationVisuals);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          position: "absolute",
          top: -thickness,
          left: -thickness,
          right: -thickness,
          height: thickness,
          backgroundColor: bg,
          borderTopLeftRadius: radius,
          borderTopRightRadius: radius
        }
      }
    ),
    /* @__PURE__ */ jsxs(
      "div",
      {
        style: {
          position: "absolute",
          bottom: -thickness,
          left: -thickness,
          right: -thickness,
          height: thickness,
          display: "flex",
          backgroundColor: bg,
          borderBottomLeftRadius: radius,
          borderBottomRightRadius: radius
        },
        children: [
          /* @__PURE__ */ jsx("div", { style: { width: thickness, flexShrink: 0 } }),
          files.map((f) => /* @__PURE__ */ jsx("div", { style: { flex: 1, ...cs }, children: f }, f)),
          /* @__PURE__ */ jsx("div", { style: { width: thickness, flexShrink: 0 } })
        ]
      }
    ),
    /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          position: "absolute",
          left: -thickness,
          top: 0,
          bottom: 0,
          width: thickness,
          display: "flex",
          flexDirection: "column",
          backgroundColor: bg
        },
        children: ranks.map((r) => /* @__PURE__ */ jsx("div", { style: { flex: 1, ...cs }, children: r }, r))
      }
    ),
    /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          position: "absolute",
          right: -thickness,
          top: 0,
          bottom: 0,
          width: thickness,
          backgroundColor: bg
        }
      }
    )
  ] });
}
function OnBoardNotation({
  files,
  ranks,
  theme,
  orientation,
  visuals
}) {
  const asWhite = orientation === "white";
  const notationVisuals = { ...DEFAULT_NOTATION_VISUALS, ...visuals };
  const lightSqColor = notationVisuals.color || notationVisuals.onLightSquareColor || theme.darkSquare;
  const darkSqColor = notationVisuals.color || notationVisuals.onDarkSquareColor || theme.lightSquare;
  return /* @__PURE__ */ jsxs("div", { style: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    zIndex: 10
  }, children: [
    files.map((f, i) => {
      const bottomRank = asWhite ? 0 : 7;
      const isLight = (i + bottomRank) % 2 !== 0;
      return /* @__PURE__ */ jsx(
        "div",
        {
          style: {
            position: "absolute",
            bottom: notationVisuals.onBoardBottomOffset,
            right: `${(7 - i) * 12.5 + 0.5}%`,
            fontSize: notationVisuals.onBoardFontSize,
            fontWeight: notationVisuals.fontWeight,
            fontFamily: notationVisuals.fontFamily,
            color: isLight ? lightSqColor : darkSqColor,
            opacity: notationVisuals.opacity,
            userSelect: "none",
            lineHeight: 1
          },
          children: f
        },
        `f-${f}`
      );
    }),
    ranks.map((r, i) => {
      const leftFile = asWhite ? 0 : 7;
      const rankIdx = asWhite ? 7 - i : i;
      const isLight = (leftFile + rankIdx) % 2 !== 0;
      return /* @__PURE__ */ jsx(
        "div",
        {
          style: {
            position: "absolute",
            top: `${i * 12.5 + 0.5}%`,
            left: notationVisuals.onBoardLeftOffset,
            fontSize: notationVisuals.onBoardFontSize,
            fontWeight: notationVisuals.fontWeight,
            fontFamily: notationVisuals.fontFamily,
            color: isLight ? lightSqColor : darkSqColor,
            opacity: notationVisuals.opacity,
            userSelect: "none",
            lineHeight: 1
          },
          children: r
        },
        `r-${r}`
      );
    })
  ] });
}
var PROMO_PIECES = ["q", "r", "b", "n"];
var PROMO_LABELS = {
  q: "Queen",
  r: "Rook",
  b: "Bishop",
  n: "Knight"
};
var PromotionDialog = memo(function PromotionDialog2({
  promotion,
  pieceSet,
  flipPieces = false,
  visuals = {},
  onSelect,
  onDismiss
}) {
  const piecePath = pieceSet?.path;
  const panelRadius = visuals.panelRadius || "10px";
  const optionRadius = visuals.optionRadius || "8px";
  const renderPiece = useCallback(
    (color, piece) => {
      const key = `${color}${piece.toUpperCase()}`;
      const src = resolvePieceImageSrc(key, piecePath);
      return /* @__PURE__ */ jsx(CachedPieceImg, { src, alt: key });
    },
    [piecePath]
  );
  return /* @__PURE__ */ jsx(
    "div",
    {
      style: {
        position: "absolute",
        inset: 0,
        backgroundColor: visuals.backdropColor || "rgba(17, 24, 39, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 20
      },
      onMouseDown: (e) => e.stopPropagation(),
      onTouchStart: (e) => e.stopPropagation(),
      onClick: onDismiss,
      children: /* @__PURE__ */ jsxs(
        "div",
        {
          onClick: (e) => e.stopPropagation(),
          style: {
            backgroundColor: visuals.panelColor || "rgba(248, 244, 236, 0.98)",
            borderRadius: panelRadius,
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            minWidth: "220px",
            boxShadow: visuals.panelShadow || "0 18px 40px rgba(0, 0, 0, 0.25)",
            border: `1px solid ${visuals.panelBorderColor || "rgba(139, 107, 74, 0.25)"}`
          },
          children: [
            /* @__PURE__ */ jsx("span", { style: { fontSize: "0.95rem", fontWeight: 400, color: visuals.titleColor || "#3B2F23" }, children: "Select promotion piece" }),
            /* @__PURE__ */ jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }, children: PROMO_PIECES.map((piece) => /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => onSelect(piece),
                style: {
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "10px 12px",
                  border: `1px solid ${visuals.optionBorderColor || "rgba(139, 107, 74, 0.25)"}`,
                  borderRadius: optionRadius,
                  backgroundColor: visuals.optionBackground || "rgba(255, 255, 255, 0.85)",
                  cursor: "pointer"
                },
                children: [
                  /* @__PURE__ */ jsx(
                    "div",
                    {
                      style: {
                        width: "42px",
                        height: "42px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transform: flipPieces ? "rotate(180deg)" : void 0,
                        transformOrigin: "center center"
                      },
                      children: renderPiece(promotion.color, piece)
                    }
                  ),
                  /* @__PURE__ */ jsx("span", { style: { fontSize: "0.85rem", fontWeight: 400, color: visuals.optionTextColor || "#4B3621" }, children: PROMO_LABELS[piece] })
                ]
              },
              piece
            )) }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: onDismiss,
                style: {
                  alignSelf: "center",
                  padding: "6px 12px",
                  backgroundColor: "transparent",
                  border: "none",
                  color: visuals.cancelTextColor || "rgba(107, 83, 59, 0.9)",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  textDecoration: "underline"
                },
                children: "Cancel"
              }
            )
          ]
        }
      )
    }
  );
});
var DragGhost = memo(forwardRef(function DragGhost2({
  piece,
  x,
  y,
  squareSize,
  pieceSet,
  customPieces,
  flipPieces = false,
  scale = 1,
  liftSquares = 0
}, ref) {
  const piecePath = pieceSet?.path;
  const key = `${piece.color}${piece.role.toUpperCase()}`;
  let content;
  if (customPieces?.[key]) {
    content = customPieces[key]();
  } else {
    const src = resolvePieceImageSrc(key, piecePath);
    content = /* @__PURE__ */ jsx(CachedPieceImg, { src, alt: key });
  }
  const offset = squareSize / 2;
  const lift = liftSquares * squareSize;
  const liftTransform = [
    lift !== 0 ? `translate(0, ${-lift}px)` : "",
    scale !== 1 ? `scale(${scale})` : "",
    flipPieces ? "rotate(180deg)" : ""
  ].filter(Boolean).join(" ") || void 0;
  const ghost = /* @__PURE__ */ jsx(
    "div",
    {
      ref,
      style: {
        position: "fixed",
        width: squareSize,
        height: squareSize,
        left: 0,
        top: 0,
        transform: `translate(${x - offset}px, ${y - offset}px)`,
        pointerEvents: "none",
        zIndex: 100,
        willChange: "transform",
        cursor: "grabbing"
      },
      children: /* @__PURE__ */ jsx(
        "div",
        {
          style: {
            width: "100%",
            height: "100%",
            transform: liftTransform,
            transformOrigin: "center center",
            transition: "transform 80ms ease-out"
          },
          children: content
        }
      )
    }
  );
  if (typeof document === "undefined") return ghost;
  return createPortal(ghost, document.body);
}));
var Badge = memo(function Badge2({ badge, orientation, squareSize }) {
  const file = badge.square.charCodeAt(0) - 97;
  const rank = parseInt(badge.square[1]) - 1;
  const asWhite = orientation === "white";
  const col = asWhite ? file : 7 - file;
  const row = asWhite ? 7 - rank : rank;
  const isTopEdge = row === 0;
  const isRightEdge = col === 7;
  const size = Math.max(16, Math.min(28, squareSize * 0.45));
  let top;
  let right;
  let transform;
  if (isTopEdge && isRightEdge) {
    top = "5%";
    right = "5%";
  } else if (isTopEdge) {
    top = "5%";
    right = "0";
    transform = "translateX(50%)";
  } else if (isRightEdge) {
    top = "0";
    right = "5%";
    transform = "translateY(-50%)";
  } else {
    top = "0";
    right = "0";
    transform = "translate(50%, -50%)";
  }
  const x = col * squareSize;
  const y = row * squareSize;
  return /* @__PURE__ */ jsx(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        width: squareSize,
        height: squareSize,
        pointerEvents: "none",
        zIndex: 10,
        overflow: "visible"
      },
      children: /* @__PURE__ */ jsx(
        "img",
        {
          src: badge.icon,
          alt: badge.label || "",
          draggable: false,
          style: {
            position: "absolute",
            width: size,
            height: size,
            top,
            right,
            transform,
            pointerEvents: "none"
          }
        }
      )
    }
  );
});
var OverlaysLayer = memo(function OverlaysLayer2({
  overlays,
  orientation,
  boardWidth,
  boardHeight,
  renderer,
  visuals
}) {
  if (overlays.length === 0) return null;
  const asWhite = orientation === "white";
  return /* @__PURE__ */ jsx("div", { style: { position: "absolute", inset: 0, pointerEvents: "none", zIndex: 15 }, children: overlays.map((overlay) => /* @__PURE__ */ jsx(
    OverlayItem,
    {
      overlay,
      asWhite,
      boardWidth,
      boardHeight,
      renderer,
      visuals
    },
    overlay.id
  )) });
});
var OverlayItem = memo(function OverlayItem2({
  overlay,
  asWhite,
  boardWidth,
  boardHeight,
  renderer,
  visuals
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(true);
  }, [
    overlay.id,
    overlay.text,
    overlay.square,
    overlay.duration,
    overlay.position?.x,
    overlay.position?.y
  ]);
  useEffect(() => {
    if (overlay.duration && overlay.duration > 0) {
      const timer = setTimeout(() => setVisible(false), overlay.duration);
      return () => clearTimeout(timer);
    }
  }, [overlay.duration]);
  if (!visible) return null;
  if (renderer) {
    return /* @__PURE__ */ jsx(Fragment, { children: renderer(overlay) });
  }
  let style = {
    position: "absolute",
    pointerEvents: "none",
    transition: "opacity 300ms ease",
    ...overlay.style
  };
  if (overlay.square) {
    const pos = square2pos(overlay.square);
    const [x, y] = pos2translate(pos, asWhite, boardWidth, boardHeight);
    const sqW = boardWidth / 8;
    style = {
      ...style,
      left: x + sqW / 2,
      top: y - 4,
      transform: "translateX(-50%)"
    };
  } else if (overlay.position) {
    style = { ...style, left: overlay.position.x, top: overlay.position.y };
  }
  return /* @__PURE__ */ jsx("div", { className: overlay.className, style, children: /* @__PURE__ */ jsx(
    "span",
    {
      style: {
        background: visuals?.background || "rgba(0,0,0,0.75)",
        color: visuals?.color || "#fff",
        padding: visuals?.padding || "2px 8px",
        borderRadius: visuals?.borderRadius || "4px",
        fontSize: visuals?.fontSize || "12px",
        fontWeight: visuals?.fontWeight || 500,
        whiteSpace: "nowrap"
      },
      children: overlay.text
    }
  ) });
});
var DEFAULT_THEME = {
  id: "Chessiro",
  name: "Chessiro",
  darkSquare: "#785E45",
  lightSquare: "#DFC29A",
  margin: "#66503B",
  lastMoveHighlight: "#DFAA4E",
  selectedPiece: "#B57340"
};
var EMPTY_ARRAY = [];
var EMPTY_OBJECT = {};
function hasActiveRadius(radius) {
  if (typeof radius === "number") return radius > 0;
  const trimmed = radius.trim();
  if (trimmed.length === 0) return false;
  const parsed = Number.parseFloat(trimmed);
  if (Number.isFinite(parsed)) return parsed > 0;
  return true;
}
var ChessiroCanvas = forwardRef(
  function ChessiroCanvas2(props, ref) {
    const {
      position = INITIAL_FEN,
      orientation = "white",
      interactive = true,
      turnColor,
      movableColor,
      onMove,
      lastMove,
      dests,
      autoPromoteTo,
      expectedMove,
      onWrongMove,
      wrongMoveFeedback = "shake",
      premovable,
      arrows = EMPTY_ARRAY,
      onArrowsChange,
      arrowBrushes,
      snapArrowsToValidMoves = true,
      markedSquares,
      onMarkedSquaresChange,
      plyIndex,
      plyArrows,
      onPlyArrowsChange,
      plyMarks,
      onPlyMarksChange,
      theme = DEFAULT_THEME,
      pieceSet,
      flipPieces = false,
      showMargin = true,
      marginThickness = 24,
      marginRadius = 4,
      boardRadius = 0,
      showNotation = true,
      highlightedSquares = EMPTY_OBJECT,
      squareVisuals,
      arrowVisuals,
      notationVisuals,
      promotionVisuals,
      overlayVisuals,
      check,
      moveQualityBadge,
      ghostPieces = EMPTY_ARRAY,
      squareLabels,
      allowDragging = true,
      allowDrawingArrows = true,
      animationDurationMs = 200,
      showAnimations = true,
      blockTouchScroll = false,
      selectedPieceScale,
      dragScale = 1,
      touchDragScale = 1.9,
      dragLiftSquares = 0,
      touchDragLiftSquares = 0.6,
      onPrevious,
      onNext,
      onFirst,
      onLast,
      onFlipBoard,
      onShowThreat,
      onDeselect,
      onSquareClick,
      onClearOverlays,
      overlays = EMPTY_ARRAY,
      overlayRenderer,
      pieces: customPieces,
      className,
      style
    } = props;
    const boardRef = useRef(null);
    const piecesLayerRef = useRef(null);
    const teachingRef = useRef(null);
    const cinematicRef = useRef(null);
    const cameraControllerRef = useRef(null);
    const playbackRef = useRef(null);
    const { bounds, getFreshBounds } = useBoardSize(boardRef);
    const orientationRef = useRef(orientation);
    orientationRef.current = orientation;
    const getCameraController = useCallback(() => {
      if (!cameraControllerRef.current) {
        cameraControllerRef.current = createCameraController(
          () => boardRef.current,
          () => orientationRef.current === "white"
        );
      }
      return cameraControllerRef.current;
    }, []);
    const handleImpactShake = useCallback((options) => {
      void getCameraController().shake(options);
    }, [getCameraController]);
    useEffect(() => {
      return () => {
        playbackRef.current?.cancel();
        playbackRef.current = null;
      };
    }, []);
    const piecesMap = useMemo(() => readFen(position || INITIAL_FEN), [position]);
    const boundsToDomRect = useCallback((b) => {
      return {
        left: b.left,
        top: b.top,
        width: b.width,
        height: b.height,
        right: b.left + b.width,
        bottom: b.top + b.height,
        x: b.left,
        y: b.top,
        toJSON: () => ({})
      };
    }, []);
    const boardDomRect = useMemo(() => {
      if (!bounds) return null;
      return boundsToDomRect(bounds);
    }, [bounds, boundsToDomRect]);
    const getFreshDomRect = useCallback(() => {
      const fresh = getFreshBounds();
      return fresh ? boundsToDomRect(fresh) : null;
    }, [getFreshBounds, boundsToDomRect]);
    const guardedOnMove = useCallback(
      (from, to, promotion) => {
        if (expectedMove) {
          const accepted = (Array.isArray(expectedMove) ? expectedMove : [expectedMove]).some(
            (m) => m.from === from && m.to === to && (m.promotion === void 0 || m.promotion === promotion)
          );
          if (!accepted) {
            if (wrongMoveFeedback === "shake") {
              teachingRef.current?.shakePiece(from);
            }
            onWrongMove?.(from, to);
            return false;
          }
        }
        return onMove?.(from, to, promotion) ?? false;
      },
      [expectedMove, onMove, onWrongMove, wrongMoveFeedback]
    );
    const interaction = useInteraction({
      position,
      pieces: piecesMap,
      orientation,
      interactive,
      allowDragging,
      allowDrawingArrows,
      boardRef,
      boardBounds: boardDomRect,
      onMove: onMove ? guardedOnMove : void 0,
      dests,
      autoPromoteTo,
      turnColor,
      movableColor,
      premovable,
      arrows,
      onArrowsChange,
      arrowBrushes,
      snapArrowsToValidMoves,
      markedSquares,
      onMarkedSquaresChange,
      plyIndex,
      plyArrows,
      onPlyArrowsChange,
      plyMarks,
      onPlyMarksChange,
      onSquareClick,
      onClearOverlays,
      blockTouchScroll,
      getFreshBounds: getFreshDomRect
    });
    const occupiedSquares = useMemo(() => {
      if (interaction.legalSquares.length === 0 && interaction.premoveSquares.length === 0) {
        return void 0;
      }
      const set = /* @__PURE__ */ new Set();
      for (const sq2 of piecesMap.keys()) set.add(sq2);
      return set;
    }, [piecesMap, interaction.legalSquares, interaction.premoveSquares]);
    const getPieceElement = useCallback((square) => {
      return piecesLayerRef.current?.getPieceElement(square) ?? null;
    }, []);
    const handleDeselect = useCallback(() => {
      interaction.clearSelection();
      onDeselect?.();
    }, [interaction.clearSelection, onDeselect]);
    useKeyboard({
      onPrevious,
      onNext,
      onFirst,
      onLast,
      onFlipBoard,
      onShowThreat,
      onDeselect: handleDeselect
    });
    useImperativeHandle(ref, () => ({
      getSquareRect(square) {
        if (!bounds) return null;
        const file = square.charCodeAt(0) - 97;
        const rank = parseInt(square[1]) - 1;
        const asWhite = orientation === "white";
        const col = asWhite ? file : 7 - file;
        const row = asWhite ? 7 - rank : rank;
        const sqW = bounds.width / 8;
        const sqH = bounds.height / 8;
        return new DOMRect(bounds.left + col * sqW, bounds.top + row * sqH, sqW, sqH);
      },
      getBoardRect() {
        return boardRef.current?.getBoundingClientRect() ?? null;
      },
      getSquareAtPoint(clientX, clientY) {
        const fresh = getFreshDomRect();
        if (!fresh) return null;
        return screenPos2square(clientX, clientY, orientation === "white", fresh) ?? null;
      },
      animateMove(from, to, options) {
        return teachingRef.current?.animateMove(from, to, options) ?? Promise.resolve();
      },
      pulseSquare(square, options) {
        return teachingRef.current?.pulseSquare(square, options) ?? Promise.resolve();
      },
      shakePiece(square) {
        return teachingRef.current?.shakePiece(square) ?? Promise.resolve();
      },
      clearTeachingEffects() {
        teachingRef.current?.clearEffects();
      },
      cinematicMove(from, to, options) {
        return cinematicRef.current?.cinematicMove(from, to, options) ?? Promise.resolve();
      },
      squareBurst(square, options) {
        return cinematicRef.current?.squareBurst(square, options) ?? Promise.resolve();
      },
      popBadge(square, options) {
        return cinematicRef.current?.popBadge(square, options) ?? Promise.resolve();
      },
      celebrate(options) {
        return cinematicRef.current?.celebrate(options) ?? Promise.resolve();
      },
      popBanner(options) {
        return cinematicRef.current?.popBanner(options) ?? Promise.resolve();
      },
      promotionBeam(square, options) {
        return cinematicRef.current?.promotionBeam(square, options) ?? Promise.resolve();
      },
      implode(square, options) {
        return cinematicRef.current?.implode(square, options) ?? Promise.resolve();
      },
      castleSwap(kingFrom, kingTo, rookFrom, rookTo, options) {
        return cinematicRef.current?.castleSwap(kingFrom, kingTo, rookFrom, rookTo, options) ?? Promise.resolve();
      },
      spotlight(squares, options) {
        return cinematicRef.current?.spotlight(squares, options) ?? { clear: () => Promise.resolve() };
      },
      drawLaser(from, to, options) {
        return cinematicRef.current?.drawLaser(from, to, options) ?? Promise.resolve();
      },
      clearCinematics() {
        playbackRef.current?.cancel();
        playbackRef.current = null;
        cinematicRef.current?.clearCinematics();
        cameraControllerRef.current?.reset();
      },
      playCinematic(steps, options) {
        playbackRef.current?.cancel();
        const playback = playCinematicScript(
          {
            getLayer: () => cinematicRef.current,
            getCamera: getCameraController,
            peekCamera: () => cameraControllerRef.current
          },
          steps,
          options
        );
        playbackRef.current = playback;
        return playback;
      },
      camera: {
        zoomTo: (square, options) => getCameraController().zoomTo(square, options),
        zoomOut: (options) => getCameraController().zoomOut(options),
        tilt: (options) => getCameraController().tilt(options),
        shake: (options) => getCameraController().shake(options),
        drift: (options) => getCameraController().drift(options),
        reset: () => cameraControllerRef.current?.reset()
      }
    }), [bounds, orientation, getFreshDomRect, getCameraController]);
    const hasValidSize = bounds && bounds.width > 0;
    const boardWidth = bounds?.width ?? 0;
    const boardHeight = bounds?.height ?? 0;
    const squareSize = boardWidth / 8;
    const isDragging = !!interaction.drag;
    const cursor = !interactive ? "default" : isDragging ? "grabbing" : allowDragging ? "grab" : "pointer";
    const marginPx = showMargin ? marginThickness : 0;
    const clipBoardContent = hasActiveRadius(boardRadius);
    return /* @__PURE__ */ jsxs(
      "div",
      {
        className,
        style: {
          position: "relative",
          ...style
        },
        tabIndex: -1,
        children: [
          marginPx > 0 && /* @__PURE__ */ jsx(
            "div",
            {
              style: {
                position: "absolute",
                inset: 0,
                background: theme.margin || theme.darkSquare,
                borderRadius: marginRadius,
                pointerEvents: "none"
              }
            }
          ),
          /* @__PURE__ */ jsx(
            "div",
            {
              style: {
                position: "relative",
                padding: marginPx
              },
              children: /* @__PURE__ */ jsxs(
                "div",
                {
                  ref: boardRef,
                  style: {
                    position: "relative",
                    width: "100%",
                    paddingBottom: "100%",
                    borderRadius: boardRadius,
                    overflow: "visible",
                    cursor,
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    touchAction: blockTouchScroll ? "none" : void 0
                  },
                  onMouseDown: interaction.handlePointerDown,
                  onTouchStart: interaction.handlePointerDown,
                  children: [
                    /* @__PURE__ */ jsxs(
                      "div",
                      {
                        style: {
                          position: "absolute",
                          inset: 0,
                          borderRadius: boardRadius,
                          overflow: clipBoardContent ? "hidden" : "visible"
                        },
                        children: [
                          /* @__PURE__ */ jsx(
                            Squares,
                            {
                              theme,
                              orientation,
                              lastMove,
                              selectedSquare: interaction.selectedSquare,
                              draggingSquare: interaction.drag?.origSquare,
                              dragHoverSquare: interaction.dragHoverSquare,
                              legalSquares: interaction.legalSquares,
                              premoveSquares: interaction.premoveSquares,
                              premoveCurrent: interaction.premoveCurrent,
                              occupiedSquares,
                              markedSquares: interaction.activeMarkedSquares,
                              highlightedSquares,
                              squareVisuals,
                              check
                            }
                          ),
                          ghostPieces.length > 0 && /* @__PURE__ */ jsx(
                            GhostPiecesLayer,
                            {
                              ghosts: ghostPieces,
                              orientation,
                              pieceSet,
                              customPieces,
                              flipPieces
                            }
                          ),
                          /* @__PURE__ */ jsx(
                            PiecesLayer,
                            {
                              ref: piecesLayerRef,
                              position,
                              pieces: piecesMap,
                              orientation,
                              pieceSet,
                              customPieces,
                              flipPieces,
                              animationDurationMs: showAnimations ? animationDurationMs : 0,
                              showAnimations,
                              draggingSquare: interaction.drag?.origSquare,
                              selectedSquare: interaction.selectedSquare,
                              selectedPieceScale
                            }
                          ),
                          squareLabels && /* @__PURE__ */ jsx(SquareLabelsLayer, { labels: squareLabels, orientation }),
                          /* @__PURE__ */ jsx(
                            TeachingLayer,
                            {
                              ref: teachingRef,
                              orientation,
                              pieces: piecesMap,
                              pieceSet,
                              customPieces,
                              flipPieces,
                              getPieceElement
                            }
                          ),
                          /* @__PURE__ */ jsx(
                            CinematicLayer,
                            {
                              ref: cinematicRef,
                              orientation,
                              pieces: piecesMap,
                              pieceSet,
                              customPieces,
                              flipPieces,
                              getPieceElement,
                              onImpactShake: handleImpactShake
                            }
                          ),
                          hasValidSize && /* @__PURE__ */ jsxs(Fragment, { children: [
                            /* @__PURE__ */ jsx(
                              ArrowsLayer,
                              {
                                arrows: interaction.renderedArrows,
                                orientation,
                                boardWidth,
                                boardHeight,
                                visuals: arrowVisuals
                              }
                            ),
                            moveQualityBadge && /* @__PURE__ */ jsx(
                              Badge,
                              {
                                badge: moveQualityBadge,
                                orientation,
                                squareSize
                              }
                            ),
                            overlays.length > 0 && /* @__PURE__ */ jsx(
                              OverlaysLayer,
                              {
                                overlays,
                                orientation,
                                boardWidth,
                                boardHeight,
                                renderer: overlayRenderer,
                                visuals: overlayVisuals
                              }
                            ),
                            interaction.pendingPromotion && /* @__PURE__ */ jsx(
                              PromotionDialog,
                              {
                                promotion: interaction.pendingPromotion,
                                pieceSet,
                                flipPieces,
                                visuals: promotionVisuals,
                                onSelect: interaction.handlePromotionSelect,
                                onDismiss: interaction.handlePromotionDismiss
                              }
                            )
                          ] })
                        ]
                      }
                    ),
                    showNotation && /* @__PURE__ */ jsx(
                      Notation,
                      {
                        orientation,
                        theme,
                        showOnMargin: showMargin,
                        marginThickness,
                        marginRadius,
                        visuals: notationVisuals
                      }
                    )
                  ]
                }
              )
            }
          ),
          interaction.drag && /* @__PURE__ */ jsx(
            DragGhost,
            {
              ref: interaction.dragGhostRef,
              piece: interaction.drag.piece,
              x: interaction.drag.startPos[0],
              y: interaction.drag.startPos[1],
              squareSize,
              pieceSet,
              customPieces,
              flipPieces,
              scale: interaction.drag.isTouch ? touchDragScale : dragScale,
              liftSquares: interaction.drag.isTouch ? touchDragLiftSquares : dragLiftSquares
            }
          )
        ]
      }
    );
  }
);

export { ChessiroCanvas, DEFAULT_ARROW_BRUSHES, INITIAL_FEN, INITIAL_GAME_FEN, preloadPieceSet, premoveDests, readFen, resolvePieceImageSrc, writeFen };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map