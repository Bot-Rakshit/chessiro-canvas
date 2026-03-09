import { memo, useMemo, useState, useEffect, useRef, useCallback, useLayoutEffect, forwardRef, useImperativeHandle } from 'react';
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
function useBoardSize(boardRef) {
  const [bounds, setBounds] = useState(null);
  const cachedBounds = useRef(null);
  const updateBounds = useCallback(() => {
    const el = boardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const newBounds = {
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top
    };
    const prev = cachedBounds.current;
    if (prev && prev.width === newBounds.width && prev.height === newBounds.height && prev.left === newBounds.left && prev.top === newBounds.top) {
      return;
    }
    cachedBounds.current = newBounds;
    setBounds(newBounds);
  }, [boardRef]);
  const getFreshBounds = useCallback(() => {
    const el = boardRef.current;
    if (!el) return cachedBounds.current;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return cachedBounds.current;
    const fresh = {
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top
    };
    cachedBounds.current = fresh;
    return fresh;
  }, [boardRef]);
  useEffect(() => {
    updateBounds();
    const el = boardRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateBounds);
    observer.observe(el);
    window.addEventListener("scroll", updateBounds, { passive: true, capture: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updateBounds, { capture: true });
    };
  }, [boardRef, updateBounds]);
  return { bounds, updateBounds, getFreshBounds };
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

// src/utils/premove.ts
var isValid = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;
var sq = (f, r) => `${FILES[f]}${RANKS[r]}`;
function premoveDests(square, pieces, color) {
  const piece = pieces.get(square);
  if (!piece || piece.color !== color) return [];
  const f = square.charCodeAt(0) - 97;
  const r = parseInt(square[1]) - 1;
  const results = [];
  const canTarget = (tf, tr) => {
    const target = sq(tf, tr);
    const occupant = pieces.get(target);
    return !occupant || occupant.color !== color;
  };
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
        if (isValid(f + df, r + dr) && canTarget(f + df, r + dr)) {
          results.push(sq(f + df, r + dr));
        }
      }
      break;
    }
    case "b": {
      for (const [df, dr] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        for (let i = 1; i < 8; i++) {
          if (!isValid(f + df * i, r + dr * i)) break;
          if (canTarget(f + df * i, r + dr * i)) results.push(sq(f + df * i, r + dr * i));
        }
      }
      break;
    }
    case "r": {
      for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        for (let i = 1; i < 8; i++) {
          if (!isValid(f + df * i, r + dr * i)) break;
          if (canTarget(f + df * i, r + dr * i)) results.push(sq(f + df * i, r + dr * i));
        }
      }
      break;
    }
    case "q": {
      for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        for (let i = 1; i < 8; i++) {
          if (!isValid(f + df * i, r + dr * i)) break;
          if (canTarget(f + df * i, r + dr * i)) results.push(sq(f + df * i, r + dr * i));
        }
      }
      break;
    }
    case "k": {
      for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        if (isValid(f + df, r + dr) && canTarget(f + df, r + dr)) {
          results.push(sq(f + df, r + dr));
        }
      }
      const homeRank = color === "w" ? 0 : 7;
      if (f === 4 && r === homeRank) {
        if (canTarget(6, homeRank)) results.push(sq(6, homeRank));
        if (canTarget(2, homeRank)) results.push(sq(2, homeRank));
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
  const dragGhostRef = useRef(null);
  const [internalArrowsMap, setInternalArrowsMap] = useState(/* @__PURE__ */ new Map());
  const [internalMarksMap, setInternalMarksMap] = useState(/* @__PURE__ */ new Map());
  const arrowStartRef = useRef(null);
  const arrowColorRef = useRef(brushes.green);
  const arrowPosRef = useRef(null);
  const justDrewArrowRef = useRef(false);
  const dragKeyChangedRef = useRef(false);
  const isTouchRef = useRef(false);
  const lastTouchTsRef = useRef(0);
  const selectedRef = useRef(selectedSquare);
  const legalRef = useRef(legalSquares);
  const premoveRef = useRef(premoveSquares);
  const pendingPromotionRef = useRef(pendingPromotion);
  const piecesRef = useRef(pieces);
  const dragRef = useRef(null);
  const arrowsRef = useRef(arrows);
  const internalMarksMapRef = useRef(internalMarksMap);
  const internalArrowsMapRef = useRef(internalArrowsMap);
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
    if (selectedRef.current === null && legalRef.current.length === 0 && premoveRef.current.length === 0 && pendingPromotionRef.current === null) {
      return;
    }
    setSelectedSquare(null);
    setLegalSquares(EMPTY_SQUARES);
    setPremoveSquares(EMPTY_SQUARES);
    setPendingPromotion(null);
  }, [position]);
  useEffect(() => {
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
    if (premovable?.current) {
      setPremoveCurrent(premovable.current);
    }
  }, [premovable?.current]);
  const getDestsForSquare = useCallback((sq2) => {
    if (dests) return dests.get(sq2) || [];
    return [];
  }, [dests]);
  const attemptMove = useCallback((from, to, promotion) => {
    if (!onMove || !interactive) return false;
    const validDests = getDestsForSquare(from);
    if (dests && !validDests.includes(to)) return false;
    const piece = piecesRef.current.get(from);
    if (piece?.role === "p" && !promotion) {
      const toRank = parseInt(to[1]);
      if (piece.color === "w" && toRank === 8 || piece.color === "b" && toRank === 1) {
        setPendingPromotion({ from, to, color: piece.color });
        return "pending";
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
    if (!boardBounds) return void 0;
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
  const handlePointerDown = useCallback((e) => {
    const nativeEvent = e.nativeEvent;
    const isTouch = "touches" in nativeEvent;
    isTouchRef.current = isTouch;
    if (isTouch) {
      lastTouchTsRef.current = Date.now();
    } else if (Date.now() - lastTouchTsRef.current < TOUCH_MOUSE_SUPPRESS_MS) {
      return;
    }
    const activeBounds = isTouch && getFreshBounds ? getFreshBounds() : boardBounds;
    if (!activeBounds) return;
    if (pendingPromotion) return;
    const sq2 = getSquareFromEvent(nativeEvent, asWhite, activeBounds);
    if (!sq2) return;
    if ("button" in e && isRightButton(e)) {
      if (allowDrawingArrows) {
        e.preventDefault();
        arrowStartRef.current = sq2;
        arrowColorRef.current = eventBrushColor(nativeEvent, brushes);
        const pos2 = getClientPos(nativeEvent);
        arrowPosRef.current = pos2 ?? null;
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
          started: false
        };
        dragRef.current = newDrag;
        setDrag(newDrag);
        startedDragCandidate = true;
      }
    }
    if (blockTouchScroll && "touches" in e && piece) {
      e.preventDefault();
    }
    if (!startedDragCandidate) {
      handleSquareInteraction(sq2);
    }
  }, [
    boardBounds,
    getFreshBounds,
    pendingPromotion,
    asWhite,
    interactive,
    allowDragging,
    allowDrawingArrows,
    handleSquareInteraction,
    brushes,
    canMoveColor,
    canPremoveColor,
    blockTouchScroll
  ]);
  useEffect(() => {
    const handleMove = (e) => {
      const pos = getClientPos(e);
      if (!pos) return;
      if (arrowStartRef.current) {
        arrowPosRef.current = pos;
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
        if (dragRef.current.started && boardBounds) {
          const currentSq = screenPos2square(pos[0], pos[1], asWhite, boardBounds);
          if (currentSq && currentSq !== dragRef.current.origSquare) {
            dragKeyChangedRef.current = true;
          }
          setDragHoverSquare((prev) => {
            const next = currentSq && currentSq !== dragRef.current.origSquare ? currentSq : null;
            return prev === next ? prev : next;
          });
          if (dragGhostRef.current) {
            const squareSize = boardBounds.width / 8;
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
      if ("button" in e && isRightButton(e) && arrowStartRef.current && boardBounds) {
        const startSq = arrowStartRef.current;
        const color = arrowColorRef.current;
        const pos = arrowPosRef.current || getClientPos(e);
        arrowStartRef.current = null;
        arrowPosRef.current = null;
        if (pos) {
          const rawSq = screenPos2square(pos[0], pos[1], asWhite, boardBounds);
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
        return;
      }
      const capturedDrag = dragRef.current;
      setDrag(null);
      dragRef.current = null;
      setDragHoverSquare(null);
      if (capturedDrag && !capturedDrag.started) {
        handleSquareInteraction(capturedDrag.origSquare);
        return;
      }
      queueMicrotask(() => {
        if (!capturedDrag) return;
        const freshBounds = getFreshBounds ? getFreshBounds() : boardBounds;
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
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("touchmove", handleMove, { passive: !blockTouchScroll });
    document.addEventListener("mouseup", handleUp);
    document.addEventListener("touchend", handleUp);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("touchmove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      document.removeEventListener("touchend", handleUp);
    };
  }, [
    boardBounds,
    getFreshBounds,
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
    return final;
  }, [arrows, plyIndex, plyArrows, internalArrowsMap, onArrowsChange]);
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
  checkGradient: "radial-gradient(ellipse at center, rgba(255, 0, 0, 1) 0%, rgba(231, 0, 0, 1) 25%, rgba(169, 0, 0, 0) 89%, rgba(158, 0, 0, 0) 100%)",
  selectedStyle: "fill",
  selectedBorderWidth: 4,
  legalMoveStyle: "ring",
  legalRingOuterRadius: 24,
  legalRingInnerRadius: 17,
  legalCaptureRingWidth: 7,
  dragOverHighlight: ""
};
var EMPTY_SQUARES2 = [];
var EMPTY_MARKS = {};
var EMPTY_HIGHLIGHTS = {};
var EMPTY_SQUARE_VISUALS = {};
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
      children: squares.map(({ sq: sq2, isLight }) => {
        const isLastMoveFrom = lastMove?.from === sq2;
        const isLastMoveTo = lastMove?.to === sq2;
        const isSelected = selectedSquare === sq2;
        const isDragHover = dragHoverSquare === sq2;
        const isLegal = legalSet.has(sq2);
        const isPremoveDest = premoveSet.has(sq2);
        const isPremoveCurrent = premoveCurrentSet.has(sq2);
        const isMarked = !!markedSquares[sq2];
        const customHighlight = highlightedSquares[sq2];
        const isOccupied = occupiedSquares?.has(sq2);
        const isCheck = check === sq2;
        let bg = isLight ? theme.lightSquare : theme.darkSquare;
        let boxShadow;
        let outline;
        let outlineOffset;
        let backgroundImage;
        let borderRadius;
        if (isLastMoveFrom || isLastMoveTo) {
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
          bg = visuals.premoveCurrent;
        }
        if (isLegal) {
          if (isOccupied) {
            boxShadow = `inset 0 0 0 ${visuals.legalCaptureRingWidth}px ${visuals.legalCaptureRing}`;
            borderRadius = "50%";
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
            borderRadius = "50%";
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
          },
          sq2
        );
      })
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
function easing(t) {
  return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}
var PiecesLayer = memo(function PiecesLayer2({
  position,
  pieces,
  orientation,
  pieceSet,
  customPieces,
  boardWidth,
  boardHeight,
  animationDurationMs,
  showAnimations,
  draggingSquare
}) {
  const asWhite = orientation === "white";
  const piecePath = pieceSet?.path;
  const currentPos = position || INITIAL_FEN;
  const skipNextAnimRef = useRef(false);
  const prevDraggingRef = useRef(draggingSquare);
  const prevPositionRef = useRef(currentPos);
  const prevPiecesRef = useRef(pieces);
  const rafIdRef = useRef(null);
  const pieceElsRef = useRef(/* @__PURE__ */ new Map());
  const animRef = useRef(null);
  useEffect(() => {
    if (piecePath) preloadPieceSet(piecePath);
  }, [piecePath]);
  const applyTransforms = useCallback(() => {
    const sqW2 = boardWidth / 8;
    const sqH2 = boardHeight / 8;
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
    for (const [sq2, el] of pieceElsRef.current) {
      const basePos = square2pos(sq2);
      const [baseX, baseY] = pos2translate(basePos, asWhite, boardWidth, boardHeight);
      let x = baseX;
      let y = baseY;
      if (currentAnim) {
        const vec = currentAnim.plan.anims.get(sq2);
        if (vec) {
          const mult = asWhite ? 1 : -1;
          x += mult * (vec.fromPos[0] - vec.toPos[0]) * ease * sqW2;
          y -= mult * (vec.fromPos[1] - vec.toPos[1]) * ease * sqH2;
          el.style.zIndex = "8";
          el.style.willChange = "transform";
        } else {
          el.style.zIndex = "2";
          el.style.willChange = "";
        }
      } else {
        el.style.zIndex = "2";
        el.style.willChange = "";
      }
      x = Math.max(0, Math.min(boardWidth - sqW2, x));
      y = Math.max(0, Math.min(boardHeight - sqH2, y));
      el.style.transform = `translate(${x}px, ${y}px)`;
    }
    return !!animRef.current;
  }, [asWhite, boardWidth, boardHeight]);
  const animLoop = useCallback(() => {
    const stillAnimating = applyTransforms();
    if (stillAnimating) {
      rafIdRef.current = requestAnimationFrame(animLoop);
    } else {
      rafIdRef.current = null;
    }
  }, [applyTransforms]);
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
    } else if (positionChanged || !showAnimations || animationDurationMs < 50) {
      animRef.current = null;
    }
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    const stillAnimating = applyTransforms();
    if (stillAnimating) {
      rafIdRef.current = requestAnimationFrame(animLoop);
    }
  }, [
    currentPos,
    pieces,
    draggingSquare,
    showAnimations,
    animationDurationMs,
    applyTransforms,
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
        dragging: draggingSquare === square
      });
    }
    return states;
  }, [pieces, draggingSquare]);
  const setRef = useCallback((square) => (el) => {
    if (el) {
      pieceElsRef.current.set(square, el);
    } else {
      pieceElsRef.current.delete(square);
    }
  }, []);
  const renderPiece = useCallback(
    (piece) => {
      const key = `${piece.color}${piece.role.toUpperCase()}`;
      if (customPieces?.[key]) {
        return customPieces[key]();
      }
      const src = resolvePieceImageSrc(key, piecePath);
      return /* @__PURE__ */ jsx(CachedPieceImg, { src, alt: key });
    },
    [piecePath, customPieces]
  );
  const sqW = boardWidth / 8;
  const sqH = boardHeight / 8;
  return /* @__PURE__ */ jsx("div", { style: { position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }, children: pieceStates.map((ps) => /* @__PURE__ */ jsx(
    "div",
    {
      ref: setRef(ps.square),
      style: {
        position: "absolute",
        width: `${sqW}px`,
        height: `${sqH}px`,
        transform: "translate(0px, 0px)",
        opacity: ps.dragging ? 0.5 : 1,
        zIndex: ps.dragging ? 1 : 2,
        pointerEvents: "none"
      },
      children: renderPiece(ps.piece)
    },
    `${ps.square}-${ps.piece.color}${ps.piece.role}`
  )) });
});
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
var ArrowsLayer = memo(function ArrowsLayer2({
  arrows,
  orientation,
  boardWidth,
  boardHeight,
  visuals = {}
}) {
  const asWhite = orientation === "white";
  const lineWidth = visuals.lineWidth ?? 10 / 64;
  const margin = visuals.margin ?? 10 / 64;
  const lineOpacity = visuals.opacity ?? 0.9;
  const markerWidth = visuals.markerWidth ?? 4;
  const markerHeight = visuals.markerHeight ?? 4;
  const markerRefX = visuals.markerRefX ?? 2.05;
  const markerRefY = visuals.markerRefY ?? 2;
  const markerColors = useMemo(() => {
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
        /* @__PURE__ */ jsx("defs", { children: markerColors.map((color) => /* @__PURE__ */ jsx(
          "marker",
          {
            id: markerKey(color),
            orient: "auto",
            overflow: "visible",
            markerWidth,
            markerHeight,
            refX: markerRefX,
            refY: markerRefY,
            children: /* @__PURE__ */ jsx("path", { d: "M0,0 V4 L3,2 Z", fill: color })
          },
          markerKey(color)
        )) }),
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
          const angle = Math.atan2(dy, dx);
          const endX = to[0] - Math.cos(angle) * margin;
          const endY = to[1] - Math.sin(angle) * margin;
          return /* @__PURE__ */ jsx(
            "line",
            {
              x1: from[0],
              y1: from[1],
              x2: endX,
              y2: endY,
              stroke: arrow.color,
              strokeWidth: lineWidth,
              strokeLinecap: "round",
              markerEnd: `url(#${markerKey(arrow.color)})`,
              opacity: lineOpacity
            },
            `${arrow.startSquare}-${arrow.endSquare}-${arrow.color}-${i}`
          );
        })
      ]
    }
  );
});
function markerKey(color) {
  return `cc-ah-${color.replace(/[^a-zA-Z0-9]/g, "")}`;
}
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
            color: notationVisuals.color || (isLight ? theme.darkSquare : theme.lightSquare),
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
            color: notationVisuals.color || (isLight ? theme.darkSquare : theme.lightSquare),
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
                  /* @__PURE__ */ jsx("div", { style: { width: "42px", height: "42px", display: "flex", alignItems: "center", justifyContent: "center" }, children: renderPiece(promotion.color, piece) }),
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
  customPieces
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
      children: content
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
      allowDragging = true,
      allowDrawingArrows = true,
      animationDurationMs = 200,
      showAnimations = true,
      blockTouchScroll = false,
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
    const { bounds, getFreshBounds } = useBoardSize(boardRef);
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
    const interaction = useInteraction({
      position,
      pieces: piecesMap,
      orientation,
      interactive,
      allowDragging,
      allowDrawingArrows,
      boardRef,
      boardBounds: boardDomRect,
      onMove,
      dests,
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
      }
    }), [bounds, orientation]);
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
              children: /* @__PURE__ */ jsx(
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
                  children: hasValidSize && /* @__PURE__ */ jsxs(Fragment, { children: [
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
                          /* @__PURE__ */ jsx(
                            PiecesLayer,
                            {
                              position,
                              pieces: piecesMap,
                              orientation,
                              pieceSet,
                              customPieces,
                              boardWidth,
                              boardHeight,
                              animationDurationMs: showAnimations ? animationDurationMs : 0,
                              showAnimations,
                              draggingSquare: interaction.drag?.origSquare
                            }
                          ),
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
                              visuals: promotionVisuals,
                              onSelect: interaction.handlePromotionSelect,
                              onDismiss: interaction.handlePromotionDismiss
                            }
                          )
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
                  ] })
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
              customPieces
            }
          )
        ]
      }
    );
  }
);

export { ChessiroCanvas, DEFAULT_ARROW_BRUSHES, INITIAL_FEN, INITIAL_GAME_FEN, preloadPieceSet, premoveDests, readFen, writeFen };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map