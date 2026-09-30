'use strict';

var react = require('react');
var reactNative = require('react-native');
var reactNativeGestureHandler = require('react-native-gesture-handler');
var Animated2 = require('react-native-reanimated');
var Svg = require('react-native-svg');
var jsxRuntime = require('react/jsx-runtime');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var Animated2__default = /*#__PURE__*/_interopDefault(Animated2);
var Svg__default = /*#__PURE__*/_interopDefault(Svg);

// src/ChessiroBoard.tsx

// ../src/types.ts
var FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
var RANKS = ["1", "2", "3", "4", "5", "6", "7", "8"];
var DEFAULT_ARROW_BRUSHES = {
  green: "#15781B",
  red: "#882020",
  blue: "#003088",
  yellow: "#e68f00"
};

// ../src/utils/fen.ts
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
    const num2 = ch.charCodeAt(0);
    if (num2 >= 49 && num2 <= 56) {
      file += num2 - 48;
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

// ../src/utils/premove.ts
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

// ../src/utils/coords.ts
var ALL_SQUARES = FILES.flatMap(
  (f) => RANKS.map((r) => `${f}${r}`)
);

// ../src/animation/anim.ts
function pieceKey(p) {
  return p.color + p.role;
}
function dist2(a, b) {
  const df = a.charCodeAt(0) - b.charCodeAt(0);
  const dr = a.charCodeAt(1) - b.charCodeAt(1);
  return df * df + dr * dr;
}
function computeAnimPlan(prevPieces, nextPieces) {
  const vacated = /* @__PURE__ */ new Map();
  const arrivals = [];
  for (const sq2 of ALL_SQUARES) {
    const prev = prevPieces.get(sq2);
    const next = nextPieces.get(sq2);
    if (prev && next && prev.color === next.color && prev.role === next.role) continue;
    if (prev) {
      const key = pieceKey(prev);
      const list = vacated.get(key);
      if (list) list.push({ square: sq2, piece: prev });
      else vacated.set(key, [{ square: sq2, piece: prev }]);
    }
    if (next) arrivals.push({ square: sq2, piece: next });
  }
  const moves = [];
  const appears = [];
  for (const arrival of arrivals) {
    const candidates = vacated.get(pieceKey(arrival.piece));
    if (!candidates || candidates.length === 0) {
      appears.push(arrival);
      continue;
    }
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const d = dist2(candidates[i].square, arrival.square);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const [origin] = candidates.splice(best, 1);
    moves.push({ from: origin.square, to: arrival.square, piece: arrival.piece });
  }
  const captures = [];
  for (const list of vacated.values()) {
    for (const left of list) captures.push(left);
  }
  return { moves, captures, appears };
}

// ../src/defaultPieceDataUris.ts
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
({
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
});

// ../src/core/boardSvg.ts
var DEFAULT_BOARD_THEME = {
  id: "Chessiro",
  name: "Chessiro",
  darkSquare: "#785E45",
  lightSquare: "#DFC29A",
  margin: "#66503B",
  lastMoveHighlight: "#DFAA4E",
  selectedPiece: "#B57340"
};
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function num(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}
function isSquare(s) {
  return !!s && s.length === 2 && s[0] >= "a" && s[0] <= "h" && s[1] >= "1" && s[1] <= "8";
}
function toSymbol(id, svg) {
  const cleaned = svg.replace(/<\?xml[^>]*\?>/g, "").replace(/<!DOCTYPE[^>]*>/gi, "").trim();
  const open = /<svg\b([^>]*)>/i.exec(cleaned);
  const close = cleaned.lastIndexOf("</svg>");
  if (!open || close < 0) return "";
  const attrs = open[1];
  const inner = cleaned.slice(open.index + open[0].length, close);
  const viewBox = /viewBox\s*=\s*"([^"]+)"/i.exec(attrs)?.[1] ?? "0 0 45 45";
  return `<symbol id="${id}" viewBox="${esc(viewBox)}">${inner}</symbol>`;
}
function renderBoardSvg(options = {}) {
  const theme = { ...DEFAULT_BOARD_THEME, ...options.theme };
  const asWhite = (options.orientation ?? "white") === "white";
  const size = options.size ?? 512;
  const showMargin = options.showMargin ?? true;
  const m = showMargin ? options.marginSquares ?? 0.375 : 0;
  const total = 8 + 2 * m;
  const unit = size / total;
  const prefix = options.idPrefix ?? "cc";
  const pieces = readFen(options.position || INITIAL_FEN);
  const brushes = { ...DEFAULT_ARROW_BRUSHES, ...options.arrowBrushes };
  const font = options.fontFamily ?? "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  const xy = (sq2) => {
    const f = sq2.charCodeAt(0) - 97;
    const r = sq2.charCodeAt(1) - 49;
    return [m + (asWhite ? f : 7 - f), m + (asWhite ? 7 - r : r)];
  };
  const center = (sq2) => {
    const [x, y] = xy(sq2);
    return [x + 0.5, y + 0.5];
  };
  const out = [];
  const title = options.title ?? `Chess position, ${asWhite ? "white" : "black"} at the bottom`;
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${num(size)}" height="${num(size)}" viewBox="0 0 ${num(total)} ${num(total)}" role="img" aria-label="${esc(title)}">`,
    `<title>${esc(title)}</title>`
  );
  const used = /* @__PURE__ */ new Set();
  for (const p of pieces.values()) used.add(`${p.color}${p.role}`);
  const defs = [];
  for (const code of used) {
    if (options.pieceUrls?.[code] && !options.pieceSvgs?.[code]) continue;
    const svg = options.pieceSvgs?.[code] ?? DEFAULT_PIECE_SVGS[code];
    defs.push(toSymbol(`${prefix}-${code}`, svg));
  }
  defs.push(
    `<radialGradient id="${prefix}-check" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ff0000" stop-opacity="1"/><stop offset="25%" stop-color="#e70000" stop-opacity="1"/><stop offset="89%" stop-color="#a90000" stop-opacity="0"/><stop offset="100%" stop-color="#9e0000" stop-opacity="0"/></radialGradient>`
  );
  out.push(`<defs>${defs.join("")}</defs>`);
  if (options.background) {
    out.push(`<rect width="${num(total)}" height="${num(total)}" fill="${esc(options.background)}"/>`);
  }
  if (m > 0) {
    const rx = (options.marginRadius ?? 4) / unit;
    out.push(`<rect width="${num(total)}" height="${num(total)}" rx="${num(rx)}" fill="${esc(theme.margin || theme.darkSquare)}"/>`);
  }
  out.push(`<rect x="${num(m)}" y="${num(m)}" width="8" height="8" fill="${esc(theme.lightSquare)}"/>`);
  let dark = "";
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) dark += `M${num(m + col)} ${num(m + row)}h1v1h-1z`;
    }
  }
  out.push(`<path d="${dark}" fill="${esc(theme.darkSquare)}"/>`);
  const fill = (sq2, color, opacity2) => {
    if (!isSquare(sq2)) return;
    const [x, y] = xy(sq2);
    out.push(`<rect x="${num(x)}" y="${num(y)}" width="1" height="1" fill="${esc(color)}"${opacity2 !== void 0 ? ` fill-opacity="${num(opacity2)}"` : ""}/>`);
  };
  if (options.lastMove) {
    const color = theme.lastMoveHighlight ?? "#DFAA4E";
    const opacity2 = options.lastMoveOpacity ?? 0.5;
    fill(options.lastMove.from, color, opacity2);
    fill(options.lastMove.to, color, opacity2);
  }
  for (const [sq2, color] of Object.entries(options.highlightedSquares ?? {})) fill(sq2, color);
  for (const sq2 of options.markedSquares ?? []) fill(sq2, "rgba(235, 64, 52, 0.65)");
  if (isSquare(options.check)) {
    const [x, y] = xy(options.check);
    out.push(`<rect x="${num(x)}" y="${num(y)}" width="1" height="1" fill="url(#${prefix}-check)"/>`);
  }
  if (options.showCoordinates ?? true) {
    const files = "abcdefgh";
    if (m > 0) {
      const fs = Math.min(m * 0.62, 0.3);
      const color = esc(theme.lightSquare);
      for (let i = 0; i < 8; i++) {
        const file = files[asWhite ? i : 7 - i];
        const rank = String(asWhite ? 8 - i : i + 1);
        out.push(
          `<text x="${num(m + i + 0.5)}" y="${num(m + 8 + m / 2)}" font-size="${num(fs)}" fill="${color}" font-family="${esc(font)}" font-weight="600" text-anchor="middle" dominant-baseline="central">${file}</text>`,
          `<text x="${num(m / 2)}" y="${num(m + i + 0.5)}" font-size="${num(fs)}" fill="${color}" font-family="${esc(font)}" font-weight="600" text-anchor="middle" dominant-baseline="central">${rank}</text>`
        );
      }
    } else {
      const fs = 0.2;
      for (let i = 0; i < 8; i++) {
        const file = files[asWhite ? i : 7 - i];
        const rank = String(asWhite ? 8 - i : i + 1);
        const fileColor = (7 + i) % 2 === 1 ? theme.lightSquare : theme.darkSquare;
        const rankColor = i % 2 === 1 ? theme.lightSquare : theme.darkSquare;
        out.push(
          `<text x="${num(m + i + 0.94)}" y="${num(m + 7.94)}" font-size="${fs}" fill="${esc(fileColor)}" font-family="${esc(font)}" font-weight="600" text-anchor="end">${file}</text>`,
          `<text x="${num(m + 0.05)}" y="${num(m + i + 0.22)}" font-size="${fs}" fill="${esc(rankColor)}" font-family="${esc(font)}" font-weight="600">${rank}</text>`
        );
      }
    }
  }
  for (const [sq2, p] of pieces) {
    const code = `${p.color}${p.role}`;
    const [x, y] = xy(sq2);
    const flip = options.flipPieces ? ` transform="rotate(180 ${num(x + 0.5)} ${num(y + 0.5)})"` : "";
    const url = !options.pieceSvgs?.[code] ? options.pieceUrls?.[code] : void 0;
    if (url) {
      out.push(`<image href="${esc(url)}" xlink:href="${esc(url)}" x="${num(x)}" y="${num(y)}" width="1" height="1"${flip}/>`);
    } else {
      out.push(`<use href="#${prefix}-${code}" xlink:href="#${prefix}-${code}" x="${num(x)}" y="${num(y)}" width="1" height="1"${flip}/>`);
    }
  }
  const opacity = options.arrowOpacity ?? 0.85;
  const lw = 0.13;
  for (const a of options.arrows ?? []) {
    if (!isSquare(a.startSquare) || !isSquare(a.endSquare) || a.startSquare === a.endSquare) continue;
    const color = esc(a.color || (a.brush ? brushes[a.brush] : brushes.green));
    const [sx, sy] = center(a.startSquare);
    const [ex, ey] = center(a.endSquare);
    const df = Math.abs(a.endSquare.charCodeAt(0) - a.startSquare.charCodeAt(0));
    const dr = Math.abs(a.endSquare.charCodeAt(1) - a.startSquare.charCodeAt(1));
    const knight = (options.knightArrowsLShaped ?? true) && (df === 1 && dr === 2 || df === 2 && dr === 1);
    const points = [[sx, sy]];
    if (knight) {
      const longIsX = Math.abs(ex - sx) > Math.abs(ey - sy);
      points.push(longIsX ? [ex, sy] : [sx, ey]);
    }
    const [px, py] = points[points.length - 1];
    const len = Math.hypot(ex - px, ey - py);
    const ux = (ex - px) / len;
    const uy = (ey - py) / len;
    const headLen = 0.4;
    const headHalf = 0.2;
    const tipX = ex - ux * 0.12;
    const tipY = ey - uy * 0.12;
    const baseX = tipX - ux * headLen;
    const baseY = tipY - uy * headLen;
    points.push([baseX + ux * 0.02, baseY + uy * 0.02]);
    const d = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${num(x)} ${num(y)}`).join("");
    out.push(
      `<g opacity="${num(opacity)}"><path d="${d}" fill="none" stroke="${color}" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round"/><path d="M${num(tipX)} ${num(tipY)}L${num(baseX - uy * headHalf)} ${num(baseY + ux * headHalf)}L${num(baseX + uy * headHalf)} ${num(baseY - ux * headHalf)}Z" fill="${color}"/></g>`
    );
  }
  out.push("</svg>");
  return out.join("");
}

// ../src/core/motion.ts
function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t) => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  const solveT = (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-6) return t;
      const d = sampleDX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 30; i++) {
      const v = sampleX(t);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };
  return (x) => x <= 0 ? 0 : x >= 1 ? 1 : sampleY(solveT(x));
}
function bounceOut(t) {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}
var SPRING_END = 1 - Math.exp(-6.5) * Math.cos(11);
function springOut(t) {
  if (t >= 1) return 1;
  return (1 - Math.exp(-6.5 * t) * Math.cos(11 * t)) / SPRING_END;
}
var EASINGS = {
  linear: (t) => t,
  ease: cubicBezier(0.25, 0.1, 0.25, 1),
  easeIn: (t) => t * t * t,
  easeOut: (t) => 1 - (1 - t) ** 3,
  // The board's historical curve — kept bit-for-bit for the 'classic' preset.
  easeInOut: (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  snappy: (t) => 1 - (1 - t) ** 5,
  smooth: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  backOut: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
  spring: springOut,
  // Winds back a touch, then overshoots and settles: the cartoon
  // anticipation/follow-through pair.
  anticipate: cubicBezier(0.6, -0.28, 0.35, 1.3),
  bounce: bounceOut,
  elastic: (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
  }
};
function resolveEasing(easing, fallback) {
  if (typeof easing === "function") return easing;
  if (easing && EASINGS[easing]) return EASINGS[easing];
  return fallback;
}
var MOVE_ANIMATION_PRESETS = {
  classic: {
    easing: "easeInOut",
    durationScale: 1,
    distanceScaling: 0,
    arc: 0,
    knightArc: 0,
    liftScale: 1,
    capture: "fade",
    landing: "none",
    appear: "none",
    flip: "none",
    stagger: 0
  },
  snappy: {
    easing: "snappy",
    durationScale: 0.85,
    distanceScaling: 0.5,
    arc: 0,
    knightArc: 0,
    liftScale: 1,
    capture: "fade",
    landing: "none",
    appear: "fade",
    flip: "rotate",
    stagger: 0
  },
  smooth: {
    easing: "smooth",
    durationScale: 1.4,
    distanceScaling: 0.6,
    arc: 0,
    knightArc: 0.12,
    liftScale: 1.04,
    capture: "shrink",
    landing: "settle",
    appear: "fade",
    flip: "rotate",
    stagger: 12
  },
  playful: {
    easing: "anticipate",
    durationScale: 1.6,
    distanceScaling: 0.7,
    arc: 0.1,
    knightArc: 0.45,
    liftScale: 1.12,
    capture: "knockout",
    landing: "squash",
    appear: "pop",
    flip: "rotate",
    stagger: 18
  },
  arcade: {
    easing: "spring",
    durationScale: 1.9,
    distanceScaling: 0.8,
    arc: 0.28,
    knightArc: 0.6,
    liftScale: 1.2,
    capture: "poof",
    landing: "bounce",
    appear: "drop",
    flip: "rotate",
    stagger: 26
  },
  elegant: {
    easing: "ease",
    durationScale: 1.9,
    distanceScaling: 1,
    arc: 0.06,
    knightArc: 0.18,
    liftScale: 1.05,
    capture: "sink",
    landing: "settle",
    appear: "rise",
    flip: "fade",
    stagger: 22
  },
  minimal: {
    easing: "easeOut",
    durationScale: 0.6,
    distanceScaling: 0,
    arc: 0,
    knightArc: 0,
    liftScale: 1,
    capture: "fade",
    landing: "none",
    appear: "none",
    flip: "none",
    stagger: 0
  }
};
var OVERSHOOTING = /* @__PURE__ */ new Set(["backOut", "spring", "elastic", "anticipate"]);
function resolveMoveAnimation(options, ctx = {}) {
  const opts = typeof options === "string" ? { preset: options } : options ?? {};
  const base = ctx.baseDurationMs ?? 200;
  const wantsNone = opts.preset === "none";
  const reduce = !!ctx.reducedMotion && opts.respectReducedMotion !== false;
  const presetName = reduce ? "minimal" : opts.preset === void 0 || opts.preset === "none" ? "classic" : opts.preset;
  const p = MOVE_ANIMATION_PRESETS[presetName] ?? MOVE_ANIMATION_PRESETS.classic;
  const pick = (key, fallback) => reduce ? fallback : opts[key] ?? fallback;
  const durationMs = Math.max(0, opts.durationMs ?? base * p.durationScale);
  const easingOpt = reduce ? p.easing : opts.easing ?? p.easing;
  return {
    enabled: ctx.enabled !== false && !wantsNone && durationMs >= 16,
    durationMs,
    distanceScaling: clamp(pick("distanceScaling", p.distanceScaling), 0, 1),
    easing: resolveEasing(easingOpt, EASINGS.easeInOut),
    overshoots: typeof easingOpt === "function" ? true : OVERSHOOTING.has(easingOpt),
    arc: Math.max(0, pick("arc", p.arc)),
    knightArc: Math.max(0, pick("knightArc", p.knightArc)),
    liftScale: Math.max(0.5, pick("liftScale", p.liftScale)),
    capture: pick("capture", p.capture),
    landing: pick("landing", p.landing),
    appear: pick("appear", p.appear),
    flip: pick("flip", p.flip),
    stagger: Math.max(0, pick("stagger", p.stagger)),
    snapBack: opts.snapBack ?? true
  };
}
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function frame(offset, x, y, sx = 1, sy = 1, rotate = 0, opacity = 1) {
  return { offset, x, y, scaleX: sx, scaleY: sy, rotate, opacity };
}
function moveDurationMs(distance, m) {
  if (m.distanceScaling <= 0) return m.durationMs;
  const factor = clamp(Math.sqrt(Math.max(distance, 0.5) / 2.2), 0.65, 1.6);
  return m.durationMs * (1 + (factor - 1) * m.distanceScaling);
}
function isKnightJump(dx, dy) {
  const ax = Math.abs(Math.round(dx));
  const ay = Math.abs(Math.round(dy));
  return ax === 1 && ay === 2 || ax === 2 && ay === 1;
}
var LANDING_MS = { none: 0, squash: 170, bounce: 240, settle: 140 };
function landingFrames(at, landing) {
  const [x, y] = at;
  const planted = (t, sx, sy, lift = 0) => frame(t, x, y + (1 - sy) * 0.42 - lift, sx, sy);
  switch (landing) {
    case "squash":
      return [planted(0.3, 1.14, 0.84), planted(0.62, 0.95, 1.06), planted(1, 1, 1)];
    case "bounce":
      return [
        planted(0.16, 1.08, 0.9),
        planted(0.42, 0.97, 1.04, 0.14),
        planted(0.7, 1.03, 0.97),
        planted(0.84, 1, 1, 0.03),
        planted(1, 1, 1)
      ];
    case "settle":
      return [planted(0.45, 1.04, 0.96), planted(1, 1, 1)];
    case "none":
      return [];
  }
}
function planLandingTrack(at, m) {
  if (m.landing === "none") return null;
  return { delayMs: 0, durationMs: LANDING_MS[m.landing], frames: [frame(0, at[0], at[1]), ...landingFrames(at, m.landing)] };
}
function planMoveTrack(from, to, m, opts = {}) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const distance = Math.hypot(dx, dy);
  const travelMs = moveDurationMs(distance, m);
  const knight = opts.knight ?? isKnightJump(dx, dy);
  const arcBase = knight ? Math.max(m.knightArc, m.arc) : m.arc;
  const arcHeight = arcBase * clamp(0.55 + distance * 0.18, 0.6, 1.6);
  const landingMs = m.landing === "none" ? 0 : LANDING_MS[m.landing];
  const totalMs = travelMs + landingMs;
  const travelShare = totalMs > 0 ? travelMs / totalMs : 1;
  const samples = m.overshoots || arcHeight > 0 || m.liftScale !== 1 ? 28 : 14;
  const frames = [];
  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    const p = i === samples ? 1 : m.easing(u);
    const bump = 4 * u * (1 - u);
    const lift = 1 + (m.liftScale - 1) * Math.sin(Math.PI * u);
    frames.push(frame(
      u * travelShare,
      from[0] + dx * p,
      from[1] + dy * p - arcHeight * bump,
      lift,
      lift
    ));
  }
  if (landingMs > 0) {
    for (const f of landingFrames(to, m.landing)) {
      frames.push({ ...f, offset: travelShare + (1 - travelShare) * f.offset });
    }
  }
  return { delayMs: opts.delayMs ?? 0, durationMs: totalMs, frames };
}
function planCaptureTrack(at, m, opts = {}) {
  const [x, y] = at;
  const arrive = opts.arriveMs ?? m.durationMs;
  switch (m.capture) {
    case "none":
      return null;
    case "fade":
      return {
        delayMs: 0,
        durationMs: Math.max(arrive, 140),
        frames: [frame(0, x, y), frame(0.5, x, y, 1, 1, 0, 0.5), frame(1, x, y, 1, 1, 0, 0)]
      };
    case "shrink":
      return {
        delayMs: arrive * 0.55,
        durationMs: 220,
        frames: [frame(0, x, y), frame(1, x, y, 0.2, 0.2, 0, 0)]
      };
    case "sink":
      return {
        delayMs: arrive * 0.6,
        durationMs: 320,
        frames: [frame(0, x, y), frame(0.6, x, y + 0.12, 0.92, 0.8, 0, 0.45), frame(1, x, y + 0.22, 0.85, 0.6, 0, 0)]
      };
    case "poof":
      return {
        delayMs: arrive * 0.8,
        durationMs: 260,
        frames: [
          frame(0, x, y),
          frame(0.35, x, y, 1.28, 1.28, 0, 0.75),
          frame(1, x, y, 1.6, 1.6, 0, 0)
        ]
      };
    case "knockout": {
      const [px, py] = opts.push ?? [0, -1];
      const len = Math.hypot(px, py) || 1;
      const nx = px / len;
      const ny = py / len;
      const spin = nx >= 0 ? 1 : -1;
      return {
        delayMs: arrive * 0.85,
        durationMs: 420,
        frames: [
          frame(0, x, y),
          frame(0.3, x + nx * 0.35, y + ny * 0.35 - 0.3, 1.05, 1.05, 28 * spin, 0.95),
          frame(1, x + nx * 0.9, y + ny * 0.9 + 0.1, 0.7, 0.7, 110 * spin, 0)
        ]
      };
    }
  }
}
var APPEAR_MS = { none: 0, fade: 220, pop: 320, drop: 380, rise: 360 };
function planAppearTrack(at, m, delayMs = 0) {
  const [x, y] = at;
  const durationMs = APPEAR_MS[m.appear];
  switch (m.appear) {
    case "none":
      return null;
    case "fade":
      return { delayMs, durationMs, frames: [frame(0, x, y, 1, 1, 0, 0), frame(1, x, y)] };
    case "pop":
      return {
        delayMs,
        durationMs,
        frames: [
          frame(0, x, y, 0.3, 0.3, 0, 0),
          frame(0.55, x, y, 1.14, 1.14, 0, 1),
          frame(0.8, x, y, 0.96, 0.96),
          frame(1, x, y)
        ]
      };
    case "drop":
      return {
        delayMs,
        durationMs,
        frames: [
          frame(0, x, y - 0.9, 1, 1, 0, 0),
          frame(0.55, x, y, 1, 1, 0, 1),
          frame(0.7, x, y + 0.07, 1.1, 0.86),
          frame(0.86, x, y - 0.04, 0.97, 1.04),
          frame(1, x, y)
        ]
      };
    case "rise":
      return {
        delayMs,
        durationMs,
        frames: [frame(0, x, y + 0.25, 0.94, 0.94, 0, 0), frame(0.7, x, y - 0.02, 1, 1, 0, 1), frame(1, x, y)]
      };
  }
}
function planSnapBackTrack(from, home) {
  const distance = Math.hypot(home[0] - from[0], home[1] - from[1]);
  const durationMs = clamp(120 + distance * 35, 140, 320);
  const ease = EASINGS.snappy;
  const frames = [];
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    const p = ease(u);
    frames.push(frame(u, from[0] + (home[0] - from[0]) * p, from[1] + (home[1] - from[1]) * p));
  }
  return { delayMs: 0, durationMs, frames };
}
function planFlipFadeTrack(at, durationMs) {
  const [x, y] = at;
  return {
    delayMs: 0,
    durationMs,
    frames: [frame(0, x, y, 0.9, 0.9, 0, 0), frame(1, x, y)]
  };
}
function sampleTrack(track, ms) {
  const frames = track.frames;
  const t = track.durationMs > 0 ? clamp((ms - track.delayMs) / track.durationMs, 0, 1) : 1;
  if (t <= frames[0].offset) return frames[0];
  for (let i = 1; i < frames.length; i++) {
    const b = frames[i];
    if (t <= b.offset) {
      const a = frames[i - 1];
      const span = b.offset - a.offset;
      const k = span > 0 ? (t - a.offset) / span : 1;
      return {
        offset: t,
        x: a.x + (b.x - a.x) * k,
        y: a.y + (b.y - a.y) * k,
        scaleX: a.scaleX + (b.scaleX - a.scaleX) * k,
        scaleY: a.scaleY + (b.scaleY - a.scaleY) * k,
        rotate: a.rotate + (b.rotate - a.rotate) * k,
        opacity: a.opacity + (b.opacity - a.opacity) * k
      };
    }
  }
  return frames[frames.length - 1];
}
function staggerRank(x, y) {
  return (7 - y) * 8 + x;
}

// ../src/core/index.ts
function squareToPoint(square, orientation = "white") {
  const f = square.charCodeAt(0) - 97;
  const r = square.charCodeAt(1) - 49;
  return orientation === "white" ? [f, 7 - r] : [7 - f, r];
}
function pointToSquare(x, y, orientation = "white") {
  const col = Math.floor(x);
  const row = Math.floor(y);
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  const f = orientation === "white" ? col : 7 - col;
  const r = orientation === "white" ? 7 - row : row;
  return `${String.fromCharCode(97 + f)}${r + 1}`;
}
function isSquare2(s) {
  return !!s && s.length === 2 && s[0] >= "a" && s[0] <= "h" && s[1] >= "1" && s[1] <= "8";
}
var BoardSquares = react.memo(function BoardSquares2({ size, orientation, theme, showCoordinates }) {
  const s = size / 8;
  const darkPath = react.useMemo(() => {
    let d = "";
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 1) d += `M${col * s} ${row * s}h${s}v${s}h${-s}z`;
      }
    }
    return d;
  }, [s]);
  const asWhite = orientation === "white";
  const labels = [];
  if (showCoordinates) {
    const fs = Math.max(8, s * 0.2);
    for (let i = 0; i < 8; i++) {
      const file = "abcdefgh"[asWhite ? i : 7 - i];
      const rank = String(asWhite ? 8 - i : i + 1);
      const fileColor = (7 + i) % 2 === 1 ? theme.lightSquare : theme.darkSquare;
      const rankColor = i % 2 === 1 ? theme.lightSquare : theme.darkSquare;
      labels.push(
        /* @__PURE__ */ jsxRuntime.jsx(Svg.Text, { x: (i + 0.95) * s, y: 8 * s - s * 0.07, fontSize: fs, fontWeight: "600", fill: fileColor, textAnchor: "end", children: file }, `f${i}`),
        /* @__PURE__ */ jsxRuntime.jsx(Svg.Text, { x: s * 0.05, y: i * s + fs * 1.02, fontSize: fs, fontWeight: "600", fill: rankColor, children: rank }, `r${i}`)
      );
    }
  }
  return /* @__PURE__ */ jsxRuntime.jsxs(Svg__default.default, { width: size, height: size, style: styles.layer, children: [
    /* @__PURE__ */ jsxRuntime.jsx(Svg.Rect, { x: 0, y: 0, width: size, height: size, fill: theme.lightSquare }),
    /* @__PURE__ */ jsxRuntime.jsx(Svg.Path, { d: darkPath, fill: theme.darkSquare }),
    labels
  ] });
});
var SquareOverlay = react.memo(function SquareOverlay2(props) {
  const {
    size,
    orientation,
    theme,
    visuals,
    lastMove,
    check,
    highlightedSquares,
    markedSquares,
    selected,
    legal,
    premoveDests: premoveDests2,
    premoveCurrent,
    occupied,
    gradientId
  } = props;
  const s = size / 8;
  const out = [];
  const at = (sq2) => {
    const [c, r] = squareToPoint(sq2, orientation);
    return [c * s, r * s];
  };
  const fill = (key, sq2, color, opacity) => {
    if (!isSquare2(sq2)) return;
    const [x, y] = at(sq2);
    out.push(/* @__PURE__ */ jsxRuntime.jsx(Svg.Rect, { x, y, width: s, height: s, fill: color, fillOpacity: opacity }, key));
  };
  if (lastMove) {
    fill("lm-f", lastMove.from, theme.lastMoveHighlight, 0.5);
    fill("lm-t", lastMove.to, theme.lastMoveHighlight, 0.5);
  }
  if (highlightedSquares) {
    for (const sq2 in highlightedSquares) fill(`hl-${sq2}`, sq2, highlightedSquares[sq2]);
  }
  if (markedSquares) for (const sq2 of markedSquares) fill(`mk-${sq2}`, sq2, visuals.markOverlay);
  if (premoveCurrent) {
    fill("pc-f", premoveCurrent[0], visuals.premoveCurrent);
    fill("pc-t", premoveCurrent[1], visuals.premoveCurrent);
  }
  if (selected) fill("sel", selected, visuals.selected);
  if (isSquare2(check)) {
    const [x, y] = at(check);
    out.push(/* @__PURE__ */ jsxRuntime.jsx(Svg.Rect, { x, y, width: s, height: s, fill: `url(#${gradientId})` }, "check"));
  }
  const hint = (key, sq2, dot, ring) => {
    if (!isSquare2(sq2)) return;
    const [x, y] = at(sq2);
    if (occupied.has(sq2)) {
      const w = Math.max(2, s * 0.05);
      if (visuals.legalCaptureRingShape === "circle") {
        out.push(/* @__PURE__ */ jsxRuntime.jsx(Svg.Circle, { cx: x + s / 2, cy: y + s / 2, r: s / 2 - w / 2, stroke: ring, strokeWidth: w, fill: "none" }, key));
      } else {
        const rx = s * 0.14;
        out.push(/* @__PURE__ */ jsxRuntime.jsx(Svg.Rect, { x: x + w / 2, y: y + w / 2, width: s - w, height: s - w, rx, ry: rx, stroke: ring, strokeWidth: w, fill: "none" }, key));
      }
    } else if (visuals.legalMoveStyle === "dot") {
      out.push(/* @__PURE__ */ jsxRuntime.jsx(Svg.Circle, { cx: x + s / 2, cy: y + s / 2, r: s * 0.16, fill: dot }, key));
    } else {
      out.push(/* @__PURE__ */ jsxRuntime.jsx(Svg.Circle, { cx: x + s / 2, cy: y + s / 2, r: s * 0.205, stroke: dot, strokeWidth: s * 0.07, fill: "none" }, key));
    }
  };
  for (const sq2 of new Set(legal)) hint(`lg-${sq2}`, sq2, visuals.legalDot, visuals.legalCaptureRing);
  for (const sq2 of new Set(premoveDests2)) hint(`pm-${sq2}`, sq2, visuals.premoveDot, visuals.premoveCaptureRing);
  if (out.length === 0) return null;
  return /* @__PURE__ */ jsxRuntime.jsxs(Svg__default.default, { width: size, height: size, style: styles.layer, children: [
    isSquare2(check) ? /* @__PURE__ */ jsxRuntime.jsx(Svg.Defs, { children: /* @__PURE__ */ jsxRuntime.jsxs(Svg.RadialGradient, { id: gradientId, cx: "50%", cy: "50%", r: "50%", children: [
      /* @__PURE__ */ jsxRuntime.jsx(Svg.Stop, { offset: "0%", stopColor: "#ff0000", stopOpacity: 1 }),
      /* @__PURE__ */ jsxRuntime.jsx(Svg.Stop, { offset: "25%", stopColor: "#e70000", stopOpacity: 1 }),
      /* @__PURE__ */ jsxRuntime.jsx(Svg.Stop, { offset: "89%", stopColor: "#a90000", stopOpacity: 0 }),
      /* @__PURE__ */ jsxRuntime.jsx(Svg.Stop, { offset: "100%", stopColor: "#9e0000", stopOpacity: 0 })
    ] }) }) : null,
    out
  ] });
});
var Arrows = react.memo(function Arrows2({ size, orientation, arrows, brushes }) {
  const s = size / 8;
  const palette = { ...DEFAULT_ARROW_BRUSHES, ...brushes };
  const nodes = [];
  for (const a of arrows) {
    if (!isSquare2(a.startSquare) || !isSquare2(a.endSquare) || a.startSquare === a.endSquare) continue;
    const color = a.color || (a.brush ? palette[a.brush] : palette.green);
    const [sc, sr] = squareToPoint(a.startSquare, orientation);
    const [ec, er] = squareToPoint(a.endSquare, orientation);
    const sx = (sc + 0.5) * s;
    const sy = (sr + 0.5) * s;
    const ex = (ec + 0.5) * s;
    const ey = (er + 0.5) * s;
    const df = Math.abs(ec - sc);
    const dr = Math.abs(er - sr);
    const knight = df === 1 && dr === 2 || df === 2 && dr === 1;
    const points = [[sx, sy]];
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
    const d = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join("");
    const head = `M${tipX} ${tipY}L${baseX - uy * headHalf} ${baseY + ux * headHalf}L${baseX + uy * headHalf} ${baseY - ux * headHalf}Z`;
    nodes.push(
      /* @__PURE__ */ jsxRuntime.jsxs(Svg.G, { opacity: 0.85, children: [
        /* @__PURE__ */ jsxRuntime.jsx(Svg.Path, { d, fill: "none", stroke: color, strokeWidth: 0.16 * s, strokeLinecap: "round", strokeLinejoin: "round" }),
        /* @__PURE__ */ jsxRuntime.jsx(Svg.Path, { d: head, fill: color })
      ] }, a.id ?? `${a.startSquare}-${a.endSquare}-${color}`)
    );
  }
  if (nodes.length === 0) return null;
  return /* @__PURE__ */ jsxRuntime.jsx(Svg__default.default, { width: size, height: size, style: styles.layer, children: nodes });
});
var styles = reactNative.StyleSheet.create({
  layer: { ...reactNative.StyleSheet.absoluteFillObject, pointerEvents: "none" }
});

// src/motionState.ts
var DROP_HINT_TTL_MS = 5e3;
var lastId = 0;
var lastKey = 0;
var nextTrackKey = () => ++lastKey;
var codeOf = (p) => `${p.color}${p.role}`;
function initialMotionState(placement, pieces, orientation) {
  const entries = [];
  for (const [square, piece] of pieces) {
    entries.push({ id: ++lastId, code: codeOf(piece), square, track: null, trackKey: 0, startedAt: 0, exiting: false });
  }
  return { placement, pieces, orientation, entries, spin: null };
}
function currentPoint(e, orientation, now) {
  if (e.track) {
    const f = sampleTrack(e.track, now - e.startedAt);
    return [f.x, f.y];
  }
  return squareToPoint(e.square, orientation);
}
function withTrack(e, track, now, patch) {
  return { ...e, ...patch, track, trackKey: track ? nextTrackKey() : e.trackKey, startedAt: now };
}
function lastFrame(t) {
  return t.frames[t.frames.length - 1];
}
function transition(prev, placement, pieces, orientation, m, drop, now) {
  const positionChanged = prev.placement !== placement;
  const flipped = prev.orientation !== orientation;
  const base = { placement, pieces, orientation, entries: prev.entries, spin: null };
  if (!positionChanged && !flipped) return prev;
  if (!positionChanged) return planFlip(prev, base, m, now);
  const plan = computeAnimPlan(prev.pieces, pieces);
  const live = /* @__PURE__ */ new Map();
  const next = [];
  for (const e of prev.entries) {
    if (e.exiting) {
      if (!flipped && m.enabled) next.push(e);
    } else {
      live.set(e.square, e);
    }
  }
  const take = (sq2, code) => {
    const e = live.get(sq2);
    if (e) {
      live.delete(sq2);
      return e;
    }
    return { id: ++lastId, code, square: sq2, track: null, trackKey: 0, startedAt: 0, exiting: false };
  };
  const at = (sq2) => squareToPoint(sq2, orientation);
  const freshDrop = drop && now - drop.at < DROP_HINT_TTL_MS ? drop : null;
  if (!m.enabled) {
    for (const mv of plan.moves) next.push({ ...take(mv.from, codeOf(mv.piece)), square: mv.to, track: null });
    for (const cap of plan.captures) live.delete(cap.square);
    for (const ap of plan.appears) next.push({ ...take("--", codeOf(ap.piece)), square: ap.square });
    for (const e of live.values()) next.push(e.track ? { ...e, track: null } : e);
    return { ...base, entries: next };
  }
  const origin = (sq2) => {
    const e = live.get(sq2);
    return e ? currentPoint(e, prev.orientation, now) : squareToPoint(sq2, prev.orientation);
  };
  const byRank = (a, b) => {
    const [ax, ay] = at(a);
    const [bx, by] = at(b);
    return staggerRank(ax, ay) - staggerRank(bx, by);
  };
  const moves = plan.moves.length > 1 && m.stagger > 0 ? [...plan.moves].sort((a, b) => byRank(a.to, b.to)) : plan.moves;
  const appears = plan.appears.length > 1 && m.stagger > 0 ? [...plan.appears].sort((a, b) => byRank(a.square, b.square)) : plan.appears;
  const count = plan.moves.length + plan.appears.length;
  const step = count > 2 ? Math.min(m.stagger, 450 / count) : 0;
  const arrivals = /* @__PURE__ */ new Map();
  let order = 0;
  for (const mv of moves) {
    const to = at(mv.to);
    if (freshDrop && freshDrop.from === mv.from && freshDrop.to === mv.to) {
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
    if (freshDrop && cap.square === freshDrop.from) continue;
    const from = origin(cap.square);
    const pos = flipped ? at(cap.square) : from;
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
      push: hit ? [hit.to[0] - hit.from[0], hit.to[1] - hit.from[1]] : void 0
    });
    if (t) next.push(withTrack(e, t, now, { exiting: true }));
  }
  for (const ap of appears) {
    const e = take("--", codeOf(ap.piece));
    const t = planAppearTrack(at(ap.square), m, step * order++);
    next.push(t ? withTrack(e, t, now, { square: ap.square }) : { ...e, square: ap.square });
  }
  for (const e of live.values()) {
    if (!e.track) {
      next.push(e);
    } else if (flipped) {
      next.push({ ...e, track: null });
    } else {
      const end = lastFrame(e.track);
      const home = at(e.square);
      const off = Math.abs(end.x - home[0]) + Math.abs(end.y - home[1]) > 1e-3;
      next.push(off ? withTrack(e, planMoveTrack(currentPoint(e, orientation, now), home, m), now) : e);
    }
  }
  return { ...base, entries: next };
}
function planFlip(prev, base, m, now) {
  const orientation = base.orientation;
  const resting = prev.entries.filter((e) => !e.exiting);
  if (!m.enabled || m.flip === "none") {
    return { ...base, entries: resting.map((e) => e.track ? { ...e, track: null } : e) };
  }
  if (m.flip === "fade") {
    const d = Math.max(220, m.durationMs);
    return { ...base, entries: resting.map((e) => withTrack(e, planFlipFadeTrack(squareToPoint(e.square, orientation), d), now)) };
  }
  const durationMs = Math.max(420, m.durationMs * 2);
  const steps = 16;
  const offsets = [];
  const angles = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    offsets.push(u);
    angles.push(180 * (1 - EASINGS.smooth(u)));
  }
  const spin = { key: nextTrackKey(), durationMs, offsets, angles };
  const entries = resting.map((e) => {
    const [x, y] = squareToPoint(e.square, orientation);
    const t = {
      delayMs: 0,
      durationMs,
      frames: offsets.map((offset, i) => ({ offset, x, y, scaleX: 1, scaleY: 1, rotate: -angles[i], opacity: 1 }))
    };
    return withTrack(e, t, now);
  });
  return { ...base, entries, spin };
}
function retrack(state, square, make, now) {
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
function removeEntry(state, id) {
  const entries = state.entries.filter((e) => e.id !== id);
  return entries.length === state.entries.length ? state : { ...state, entries };
}
function shakeTrack(at, delayMs) {
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
      opacity: 1
    }))
  };
}
var PIECE_XML = Object.fromEntries(
  Object.keys(DEFAULT_PIECE_SVGS).map((code) => [
    code,
    DEFAULT_PIECE_SVGS[code].replace(/<\?xml[^>]*\?>/, "").replace(/\s(width|height)="100%"/g, "").trim()
  ])
);
var PieceArt = react.memo(function PieceArt2({ code, size, renderPiece }) {
  if (renderPiece) return renderPiece(code, size);
  return /* @__PURE__ */ jsxRuntime.jsx(Svg.SvgXml, { xml: PIECE_XML[code], width: size, height: size });
});
var ALL_PIECE_CODES = [
  "wp",
  "wn",
  "wb",
  "wr",
  "wq",
  "wk",
  "bp",
  "bn",
  "bb",
  "br",
  "bq",
  "bk"
];
function toArrays(t) {
  const a = { offsets: [], x: [], y: [], sx: [], sy: [], rot: [], op: [] };
  let last = -Infinity;
  for (const f of t.frames) {
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
function segmentAt(p, offsets) {
  "worklet";
  const n = offsets.length;
  if (p <= offsets[0]) return [0, 0];
  if (p >= offsets[n - 1]) return [n - 2, 1];
  let i = 1;
  while (i < n - 1 && offsets[i] < p) i++;
  const a = offsets[i - 1];
  return [i - 1, (p - a) / (offsets[i] - a)];
}
function lerpAt(values, seg) {
  "worklet";
  const i = seg[0];
  return values[i] + (values[i + 1] - values[i]) * seg[1];
}
var EMPTY = [0, 1];
var PieceView = react.memo(function PieceView2({
  entry,
  orientation,
  size,
  renderPiece,
  flipPieces,
  dragId,
  dropIdx,
  originOpacity,
  onExitDone
}) {
  const { id, track, trackKey, exiting } = entry;
  const s = size / 8;
  const [col, row] = squareToPoint(entry.square, orientation);
  const baseX = col * s;
  const baseY = row * s;
  const myIdx = row * 8 + col;
  const progress = Animated2.useSharedValue(1);
  const activeKey = Animated2.useSharedValue(-1);
  const arrays = react.useMemo(() => track ? toArrays(track) : null, [track]);
  const hasTrack = arrays !== null;
  const offsets = arrays?.offsets ?? EMPTY;
  const xs = arrays?.x ?? EMPTY;
  const ys = arrays?.y ?? EMPTY;
  const sxs = arrays?.sx ?? EMPTY;
  const sys = arrays?.sy ?? EMPTY;
  const rots = arrays?.rot ?? EMPTY;
  const ops = arrays?.op ?? EMPTY;
  const animatedStyle = Animated2.useAnimatedStyle(() => {
    "worklet";
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
    if (dragId.value === id && dropIdx.value !== myIdx) opacity *= originOpacity;
    return {
      opacity,
      transform: [
        { translateX: x },
        { translateY: y },
        { scaleX },
        { scaleY },
        { rotate: `${rotate}deg` }
      ]
    };
  }, [hasTrack, trackKey, baseX, baseY, s, id, myIdx, originOpacity, offsets, xs, ys, sxs, sys, rots, ops, progress, activeKey, dragId, dropIdx]);
  react.useEffect(() => {
    if (!track) return;
    Animated2.cancelAnimation(progress);
    progress.value = 0;
    activeKey.value = trackKey;
    progress.value = Animated2.withDelay(
      track.delayMs,
      Animated2.withTiming(1, { duration: Math.max(1, track.durationMs), easing: Animated2.Easing.linear })
    );
    entry.startedAt = Date.now();
    if (!exiting) return;
    const timer = setTimeout(() => onExitDone(id), track.delayMs + track.durationMs + 34);
    return () => clearTimeout(timer);
  }, [trackKey]);
  react.useEffect(() => () => Animated2.cancelAnimation(progress), [progress]);
  return /* @__PURE__ */ jsxRuntime.jsx(
    Animated2__default.default.View,
    {
      testID: `${exiting ? "exiting" : "piece"}-${entry.square}`,
      style: [styles2.piece, { width: s, height: s, zIndex: exiting ? 1 : track ? 3 : 2 }, animatedStyle],
      children: /* @__PURE__ */ jsxRuntime.jsx(reactNative.View, { style: flipPieces ? styles2.flipped : void 0, children: /* @__PURE__ */ jsxRuntime.jsx(PieceArt, { code: entry.code, size: s, renderPiece }) })
    }
  );
});
var styles2 = reactNative.StyleSheet.create({
  piece: { position: "absolute", left: 0, top: 0, pointerEvents: "none" },
  flipped: { transform: [{ rotate: "180deg" }] }
});
var GhostArt = react.memo(function GhostArt2({ code, index, size, dragCode, renderPiece }) {
  const style = Animated2.useAnimatedStyle(() => {
    "worklet";
    return { opacity: dragCode.value === index ? 1 : 0 };
  }, [index, dragCode]);
  return /* @__PURE__ */ jsxRuntime.jsx(Animated2__default.default.View, { style: [reactNative.StyleSheet.absoluteFill, style], children: /* @__PURE__ */ jsxRuntime.jsx(PieceArt, { code, size, renderPiece }) });
});
var DragGhost = react.memo(function DragGhost2({ size, drag, dragScale, liftSquares, flipPieces, renderPiece }) {
  const s = size / 8;
  const { dragId, dragX, dragY, lift, dropIdx, snapP, snapping, snapFrames } = drag;
  const style = Animated2.useAnimatedStyle(() => {
    "worklet";
    if (dragId.value < 0) return { opacity: 0, transform: [{ translateX: -4 * s }, { translateY: -4 * s }, { scale: 1 }] };
    const k = lift.value;
    const scale = 1 + (dragScale - 1) * k;
    let x;
    let y;
    if (snapping.value) {
      const f = snapFrames.value;
      const seg = segmentAt(snapP.value, f.offsets);
      x = lerpAt(f.x, seg) * s;
      y = lerpAt(f.y, seg) * s;
    } else if (dropIdx.value >= 0) {
      x = dropIdx.value % 8 * s;
      y = Math.floor(dropIdx.value / 8) * s;
    } else {
      x = dragX.value - s / 2;
      y = dragY.value - s / 2 - liftSquares * s * k;
    }
    return { opacity: 1, transform: [{ translateX: x }, { translateY: y }, { scale }] };
  }, [s, dragScale, liftSquares, dragId, dragX, dragY, lift, dropIdx, snapP, snapping, snapFrames]);
  return /* @__PURE__ */ jsxRuntime.jsx(Animated2__default.default.View, { style: [styles3.ghost, { width: s, height: s }, style], children: /* @__PURE__ */ jsxRuntime.jsx(reactNative.View, { style: [reactNative.StyleSheet.absoluteFill, flipPieces ? styles3.flipped : null], children: ALL_PIECE_CODES.map((code, i) => /* @__PURE__ */ jsxRuntime.jsx(GhostArt, { code, index: i, size: s, dragCode: drag.dragCode, renderPiece }, code)) }) });
});
var HoverSquare = react.memo(function HoverSquare2({ size, hoverIdx, color }) {
  const s = size / 8;
  const style = Animated2.useAnimatedStyle(() => {
    "worklet";
    const i = hoverIdx.value;
    if (i < 0) return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }] };
    return { opacity: 1, transform: [{ translateX: i % 8 * s }, { translateY: Math.floor(i / 8) * s }] };
  }, [s, hoverIdx]);
  return /* @__PURE__ */ jsxRuntime.jsx(Animated2__default.default.View, { style: [styles3.cell, { width: s, height: s, backgroundColor: color }, style] });
});
var Pulse = react.memo(function Pulse2({ spec, size, orientation }) {
  const s = size / 8;
  const [col, row] = squareToPoint(spec.square, orientation);
  const t = Animated2.useSharedValue(0);
  react.useEffect(() => {
    const half = spec.durationMs / 2;
    const ease = Animated2.Easing.inOut(Animated2.Easing.quad);
    t.value = Animated2.withRepeat(
      Animated2.withSequence(Animated2.withTiming(1, { duration: half, easing: ease }), Animated2.withTiming(0, { duration: half, easing: ease })),
      spec.times,
      false
    );
  }, [spec, t]);
  const style = Animated2.useAnimatedStyle(() => {
    "worklet";
    return { opacity: t.value };
  }, [t]);
  return /* @__PURE__ */ jsxRuntime.jsx(
    Animated2__default.default.View,
    {
      style: [styles3.cell, { width: s, height: s, left: col * s, top: row * s, backgroundColor: spec.color }, style]
    }
  );
});
var PROMOTION_ORDER = ["q", "n", "r", "b"];
var PromotionChooser = react.memo(function PromotionChooser2({
  size,
  orientation,
  square,
  color,
  renderPiece,
  onSelect,
  onDismiss
}) {
  const s = size / 8;
  const [col, row] = squareToPoint(square, orientation);
  const down = row < 4;
  const appear = Animated2.useSharedValue(0);
  react.useEffect(() => {
    appear.value = Animated2.withTiming(1, { duration: 150, easing: Animated2.Easing.out(Animated2.Easing.cubic) });
  }, [appear]);
  const backdrop = Animated2.useAnimatedStyle(() => {
    "worklet";
    return { opacity: appear.value };
  }, [appear]);
  const column = Animated2.useAnimatedStyle(() => {
    "worklet";
    const k = appear.value;
    return {
      opacity: k,
      transform: [{ translateY: (down ? -1 : 1) * (1 - k) * s * 0.35 }, { scale: 0.85 + 0.15 * k }]
    };
  }, [appear, down, s]);
  return /* @__PURE__ */ jsxRuntime.jsxs(reactNative.View, { style: reactNative.StyleSheet.absoluteFill, children: [
    /* @__PURE__ */ jsxRuntime.jsx(Animated2__default.default.View, { style: [reactNative.StyleSheet.absoluteFill, styles3.backdrop, backdrop], children: /* @__PURE__ */ jsxRuntime.jsx(reactNative.Pressable, { style: reactNative.StyleSheet.absoluteFill, onPress: onDismiss, accessibilityLabel: "Cancel promotion" }) }),
    /* @__PURE__ */ jsxRuntime.jsx(
      Animated2__default.default.View,
      {
        style: [
          styles3.column,
          { left: col * s, top: down ? row * s : (row - 3) * s, width: s, height: 4 * s, borderRadius: s * 0.12 },
          column
        ],
        children: (down ? PROMOTION_ORDER : [...PROMOTION_ORDER].reverse()).map((role) => /* @__PURE__ */ jsxRuntime.jsxs(
          reactNative.Pressable,
          {
            onPress: () => onSelect(role),
            accessibilityRole: "button",
            accessibilityLabel: `Promote to ${ROLE_NAMES[role]}`,
            style: ({ pressed }) => [styles3.option, { width: s, height: s }, pressed && styles3.optionPressed],
            children: [
              /* @__PURE__ */ jsxRuntime.jsx(reactNative.View, { style: [styles3.optionDisc, { borderRadius: s / 2 }] }),
              /* @__PURE__ */ jsxRuntime.jsx(reactNative.View, { style: { transform: [{ scale: 0.86 }] }, children: /* @__PURE__ */ jsxRuntime.jsx(PieceArt, { code: `${color}${role}`, size: s, renderPiece }) })
            ]
          },
          role
        ))
      }
    )
  ] });
});
var ROLE_NAMES = { q: "queen", r: "rook", b: "bishop", n: "knight" };
var styles3 = reactNative.StyleSheet.create({
  ghost: { position: "absolute", left: 0, top: 0, zIndex: 20, pointerEvents: "none" },
  flipped: { transform: [{ rotate: "180deg" }] },
  cell: { position: "absolute", left: 0, top: 0, pointerEvents: "none" },
  backdrop: { backgroundColor: "rgba(15, 18, 25, 0.35)" },
  column: {
    position: "absolute",
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    shadowColor: "#0f172a",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8
  },
  option: { alignItems: "center", justifyContent: "center" },
  optionPressed: { backgroundColor: "rgba(15, 23, 42, 0.1)" },
  optionDisc: { ...reactNative.StyleSheet.absoluteFillObject, margin: "8%", backgroundColor: "rgba(15, 23, 42, 0.06)" }
});
var DRAG_THRESHOLD = 6;
var PARK_TTL_MS = 5e3;
var EMPTY_SQUARES = [];
var EMPTY_ARROWS = [];
var ZERO_TO_ONE = [0, 1];
var NO_ANGLE = [0, 0];
var EMPTY_SNAPSHOT = {
  ids: new Array(64).fill(-1),
  codes: new Array(64).fill(-1),
  movable: new Array(64).fill(false)
};
function hexToRgba(hex, alpha, fallback) {
  const clean = (hex ?? "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return fallback;
  const n = parseInt(clean, 16);
  return `rgba(${n >> 16 & 255}, ${n >> 8 & 255}, ${n & 255}, ${alpha})`;
}
function sameSquares(a, b) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function useReduceMotionSetting() {
  const initial = Animated2.useReducedMotion();
  const [reduced, setReduced] = react.useState(initial);
  react.useEffect(() => {
    let alive = true;
    reactNative.AccessibilityInfo.isReduceMotionEnabled?.().then((v) => alive && setReduced(v)).catch(() => {
    });
    const sub = reactNative.AccessibilityInfo.addEventListener?.("reduceMotionChanged", (v) => setReduced(v));
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}
var ChessiroBoard = react.forwardRef(function ChessiroBoard2(props, ref) {
  const {
    position,
    orientation = "white",
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
    wrongMoveFeedback = "shake",
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
    testID
  } = props;
  const [measured, setMeasured] = react.useState(0);
  const size = sizeProp ?? measured;
  const s = size / 8;
  const onLayout = react.useCallback(
    (e) => {
      if (sizeProp !== void 0) return;
      const w = Math.floor(e.nativeEvent.layout.width);
      setMeasured((prev) => prev === w ? prev : w);
    },
    [sizeProp]
  );
  const placement = react.useMemo(() => {
    const p = (position || INITIAL_FEN).trim().split(/\s+/)[0];
    return p === "start" ? INITIAL_FEN : p;
  }, [position]);
  const pieces = react.useMemo(() => readFen(placement), [placement]);
  const occupied = react.useMemo(() => new Set(pieces.keys()), [pieces]);
  const { darkSquare, lightSquare, lastMoveHighlight, selectedPiece } = { ...DEFAULT_BOARD_THEME, ...themeProp };
  const theme = react.useMemo(
    () => ({
      ...DEFAULT_BOARD_THEME,
      darkSquare,
      lightSquare,
      lastMoveHighlight: lastMoveHighlight ?? "#DFAA4E",
      selectedPiece: selectedPiece ?? "#B57340"
    }),
    [darkSquare, lightSquare, lastMoveHighlight, selectedPiece]
  );
  const arrowsKey = arrows?.map((a) => `${a.id ?? ""}:${a.startSquare}${a.endSquare}:${a.color}:${a.brush ?? ""}`).join("|") ?? "";
  const stableArrows = react.useMemo(() => arrows ?? EMPTY_ARROWS, [arrowsKey]);
  const visuals = react.useMemo(
    () => ({
      legalDot: "rgba(80, 37, 19, 0.65)",
      legalMoveStyle: "ring",
      legalCaptureRing: "rgba(80, 37, 19, 0.8)",
      legalCaptureRingShape: "square",
      premoveDot: "rgba(20, 85, 30, 0.5)",
      premoveCaptureRing: "rgba(20, 85, 30, 0.6)",
      premoveCurrent: "rgba(20, 30, 85, 0.4)",
      markOverlay: "rgba(235, 64, 52, 0.65)",
      selected: hexToRgba(theme.selectedPiece, 0.5, "rgba(181, 115, 64, 0.5)"),
      dragOverHighlight: hexToRgba(theme.selectedPiece, 0.35, "rgba(181, 115, 64, 0.35)"),
      dragOriginOpacity: 0.3,
      ...squareVisuals
    }),
    [theme.selectedPiece, squareVisuals]
  );
  const gradientId = `cc-check-${react.useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const reducedMotion = useReduceMotionSetting();
  const motion = react.useMemo(
    () => resolveMoveAnimation(moveAnimation, { baseDurationMs: animationDurationMs, enabled: showAnimations, reducedMotion }),
    [moveAnimation, animationDurationMs, showAnimations, reducedMotion]
  );
  const motionRef = react.useRef(motion);
  motionRef.current = motion;
  const dropHintRef = react.useRef(null);
  const [motionState, setMotionState] = react.useState(() => initialMotionState(placement, pieces, orientation));
  let ms = motionState;
  if (ms.placement !== placement || ms.orientation !== orientation) {
    ms = transition(ms, placement, pieces, orientation, motion, dropHintRef.current, Date.now());
    setMotionState(ms);
  }
  const onExitDone = react.useCallback((id) => setMotionState((st) => removeEntry(st, id)), []);
  const dragId = Animated2.useSharedValue(-1);
  const dragCode = Animated2.useSharedValue(-1);
  const dragX = Animated2.useSharedValue(0);
  const dragY = Animated2.useSharedValue(0);
  const lift = Animated2.useSharedValue(0);
  const dropIdx = Animated2.useSharedValue(-1);
  const hoverIdx = Animated2.useSharedValue(-1);
  const snapP = Animated2.useSharedValue(0);
  const snapping = Animated2.useSharedValue(false);
  const snapFrames = Animated2.useSharedValue({ offsets: ZERO_TO_ONE, x: ZERO_TO_ONE, y: ZERO_TO_ONE });
  const drag = react.useMemo(
    () => ({ dragId, dragCode, dragX, dragY, lift, dropIdx, hoverIdx, snapP, snapping, snapFrames }),
    [dragId, dragCode, dragX, dragY, lift, dropIdx, hoverIdx, snapP, snapping, snapFrames]
  );
  const snapshot = Animated2.useSharedValue(EMPTY_SNAPSHOT);
  const candidate = Animated2.useSharedValue(-1);
  const dragging = Animated2.useSharedValue(false);
  const leftOrigin = Animated2.useSharedValue(false);
  const startX = Animated2.useSharedValue(0);
  const startY = Animated2.useSharedValue(0);
  const parkedRef = react.useRef(false);
  const parkTimerRef = react.useRef(null);
  const snapUntilRef = react.useRef(0);
  const promoDragRef = react.useRef(null);
  const [selected, setSelected] = react.useState(null);
  const [legal, setLegal] = react.useState(EMPTY_SQUARES);
  const [premoveSquares, setPremoveSquares] = react.useState(EMPTY_SQUARES);
  const [premoveCurrent, setPremoveCurrent] = react.useState(null);
  const [pendingPromotion, setPendingPromotion] = react.useState(null);
  const [pulses, setPulses] = react.useState([]);
  const pulseKeyRef = react.useRef(0);
  const freeMode = turnColor === void 0 && movableColor === void 0;
  const canMoveColor = react.useCallback(
    (color) => {
      if (freeMode) return true;
      const effective = movableColor ?? turnColor ?? "w";
      if (effective === "both") return true;
      return color === effective && (turnColor === void 0 || color === turnColor);
    },
    [freeMode, movableColor, turnColor]
  );
  const canPremoveColor = react.useCallback(
    (color) => {
      if (freeMode || !premovable?.enabled) return false;
      const effective = movableColor ?? turnColor ?? "w";
      if (effective === "both") return false;
      return color === effective && turnColor !== void 0 && color !== turnColor;
    },
    [freeMode, movableColor, turnColor, premovable?.enabled]
  );
  react.useEffect(() => {
    const ids = new Array(64).fill(-1);
    const codes = new Array(64).fill(-1);
    const movable = new Array(64).fill(false);
    for (const e of ms.entries) {
      if (e.exiting) continue;
      const [c, r] = squareToPoint(e.square, orientation);
      const i = r * 8 + c;
      ids[i] = e.id;
      codes[i] = ALL_PIECE_CODES.indexOf(e.code);
      const color = e.code[0];
      movable[i] = interactive && (canMoveColor(color) || canPremoveColor(color));
    }
    snapshot.value = { ids, codes, movable };
  }, [ms.entries, orientation, interactive, canMoveColor, canPremoveColor, snapshot]);
  const clearDrag = react.useCallback(() => {
    parkedRef.current = false;
    if (parkTimerRef.current) clearTimeout(parkTimerRef.current);
    parkTimerRef.current = null;
    Animated2.cancelAnimation(snapP);
    snapping.value = false;
    dropIdx.value = -1;
    hoverIdx.value = -1;
    lift.value = 0;
    dragId.value = -1;
  }, [snapP, snapping, dropIdx, hoverIdx, lift, dragId]);
  const park = react.useCallback(
    (idx) => {
      parkedRef.current = true;
      dropIdx.value = idx;
      lift.value = Animated2.withTiming(0, { duration: 90 });
      if (parkTimerRef.current) clearTimeout(parkTimerRef.current);
      parkTimerRef.current = setTimeout(() => {
        if (parkedRef.current) clearDrag();
      }, PARK_TTL_MS);
    },
    [dropIdx, lift, clearDrag]
  );
  const snapBack = react.useCallback(
    (home, release) => {
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
        y: t.frames.map((f) => f.y)
      };
      Animated2.cancelAnimation(snapP);
      snapP.value = 0;
      snapping.value = true;
      dropIdx.value = -1;
      lift.value = Animated2.withTiming(0, { duration: t.durationMs });
      snapUntilRef.current = Date.now() + t.durationMs;
      snapP.value = Animated2.withTiming(1, { duration: t.durationMs, easing: Animated2.Easing.linear }, (finished) => {
        "worklet";
        if (!finished) return;
        snapping.value = false;
        dragId.value = -1;
      });
    },
    [orientation, clearDrag, snapFrames, snapP, snapping, dropIdx, lift, dragId]
  );
  react.useEffect(() => {
    dropHintRef.current = null;
    if (parkedRef.current) clearDrag();
  }, [placement, clearDrag]);
  const selectedRef = react.useRef(selected);
  selectedRef.current = selected;
  const legalRef = react.useRef(legal);
  legalRef.current = legal;
  const premoveSquaresRef = react.useRef(premoveSquares);
  premoveSquaresRef.current = premoveSquares;
  const piecesRef = react.useRef(pieces);
  piecesRef.current = pieces;
  react.useEffect(() => {
    const sel = selectedRef.current;
    if (sel !== null) {
      const piece = piecesRef.current.get(sel);
      if (piece && canMoveColor(piece.color)) {
        const next = dests?.get(sel) ?? EMPTY_SQUARES;
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
  const shakeRef = react.useRef(() => Promise.resolve());
  const guardedOnMove = react.useCallback(
    (from, to, promotion) => {
      if (expectedMove) {
        const ok = (Array.isArray(expectedMove) ? expectedMove : [expectedMove]).some(
          (m) => m.from === from && m.to === to && (m.promotion === void 0 || m.promotion === promotion)
        );
        if (!ok) {
          if (wrongMoveFeedback === "shake") void shakeRef.current(from);
          onWrongMove?.(from, to);
          return false;
        }
      }
      return onMove?.(from, to, promotion) ?? false;
    },
    [expectedMove, onMove, onWrongMove, wrongMoveFeedback]
  );
  const attemptMove = react.useCallback(
    (from, to, promotion, viaDrop) => {
      if (!interactive) return false;
      if (dests && !(dests.get(from) ?? EMPTY_SQUARES).includes(to)) return false;
      const piece = piecesRef.current.get(from);
      if (piece?.role === "p" && !promotion && (to[1] === "8" || to[1] === "1")) {
        if (!autoPromoteTo) {
          setPendingPromotion({ from, to, color: piece.color });
          return "pending";
        }
        promotion = autoPromoteTo;
      }
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
    [interactive, dests, autoPromoteTo, guardedOnMove]
  );
  const attemptPremove = react.useCallback(
    (from, to) => {
      if (!premovable?.enabled) return;
      setPremoveCurrent([from, to]);
      premovable.events?.set?.(from, to);
      setSelected(null);
      setLegal(EMPTY_SQUARES);
      setPremoveSquares(EMPTY_SQUARES);
    },
    [premovable]
  );
  const clearSelection = react.useCallback(() => {
    setSelected(null);
    setLegal(EMPTY_SQUARES);
    setPremoveSquares(EMPTY_SQUARES);
    setPendingPromotion(null);
    if (premoveCurrent) {
      setPremoveCurrent(null);
      premovable?.events?.unset?.();
    }
  }, [premoveCurrent, premovable]);
  react.useLayoutEffect(() => {
    if (!premoveCurrent || !premovable?.enabled) return;
    const [from, to] = premoveCurrent;
    const piece = piecesRef.current.get(from);
    if (!piece || piece.color !== turnColor) return;
    setPremoveCurrent(null);
    premovable.events?.unset?.();
    if (!dests || (dests.get(from) ?? EMPTY_SQUARES).includes(to)) onMove?.(from, to);
  }, [turnColor, premoveCurrent, premovable, dests, onMove]);
  react.useEffect(() => {
    if (!premovable || !Object.prototype.hasOwnProperty.call(premovable, "current")) return;
    const next = premovable.current ?? null;
    setPremoveCurrent((prev) => prev === next || prev && next && prev[0] === next[0] && prev[1] === next[1] ? prev : next);
    if (next === null) setPremoveSquares((prev) => prev.length === 0 ? prev : EMPTY_SQUARES);
  }, [premovable]);
  react.useEffect(() => {
    if (premovable?.enabled) return;
    setPremoveCurrent((prev) => prev === null ? prev : null);
    setPremoveSquares((prev) => prev.length === 0 ? prev : EMPTY_SQUARES);
  }, [premovable?.enabled]);
  const selectPiece = react.useCallback(
    (sq2) => {
      const piece = piecesRef.current.get(sq2);
      if (!piece) return false;
      if (canMoveColor(piece.color)) {
        const targets = dests ? dests.get(sq2) ?? EMPTY_SQUARES : EMPTY_SQUARES;
        if (targets.length > 0 || !dests) {
          setSelected(sq2);
          setLegal((prev) => sameSquares(prev, targets) ? prev : [...targets]);
          setPremoveSquares(EMPTY_SQUARES);
          return true;
        }
      }
      if (canPremoveColor(piece.color)) {
        const targets = premoveDests(sq2, piecesRef.current, piece.color);
        if (targets.length > 0) {
          setSelected(sq2);
          setLegal(EMPTY_SQUARES);
          setPremoveSquares(premovable?.showDests === false ? EMPTY_SQUARES : targets);
          return true;
        }
      }
      return false;
    },
    [canMoveColor, canPremoveColor, dests, premovable?.showDests]
  );
  const handleSquare = react.useCallback(
    (sq2) => {
      if (!interactive) {
        onSquarePress?.(sq2);
        return;
      }
      const sel = selectedRef.current;
      if (premoveCurrent) {
        setPremoveCurrent(null);
        premovable?.events?.unset?.();
      }
      if (sel && sel !== sq2) {
        const piece = piecesRef.current.get(sel);
        const offer = legalRef.current.includes(sq2) || !dests && !!piece && canMoveColor(piece.color);
        if (offer) {
          const result = attemptMove(sel, sq2, void 0, false);
          if (result === "pending" || result) return;
        }
        if (premoveSquaresRef.current.includes(sq2)) {
          attemptPremove(sel, sq2);
          return;
        }
      }
      if (sel === sq2) {
        clearSelection();
        return;
      }
      if (selectPiece(sq2)) {
        onSquarePress?.(sq2);
        return;
      }
      clearSelection();
      onSquarePress?.(sq2);
    },
    [interactive, onSquarePress, premoveCurrent, premovable, dests, canMoveColor, attemptMove, attemptPremove, clearSelection, selectPiece]
  );
  const idxToSquare = react.useCallback(
    (idx) => idx < 0 ? null : pointToSquare(idx % 8, Math.floor(idx / 8), orientation),
    [orientation]
  );
  const handlers = {
    tap(idx) {
      const sq2 = idxToSquare(idx);
      if (sq2 && !pendingPromotion) handleSquare(sq2);
    },
    liftPiece(idx) {
      const sq2 = idxToSquare(idx);
      if (!sq2) return;
      if (parkedRef.current) {
        parkedRef.current = false;
        if (parkTimerRef.current) clearTimeout(parkTimerRef.current);
      }
      selectPiece(sq2);
      onPieceLift?.(sq2);
    },
    drop(fromIdx, toIdx, vx, vy, moved) {
      const from = idxToSquare(fromIdx);
      if (!from) return;
      const to = idxToSquare(toIdx);
      const piece = piecesRef.current.get(from);
      let result = "rejected";
      if (to && to !== from && piece && interactive) {
        if (canMoveColor(piece.color)) {
          const r = attemptMove(from, to, void 0, true);
          result = r === "pending" ? "pending" : r ? "accepted" : "rejected";
        }
        if (result === "rejected" && canPremoveColor(piece.color)) {
          if (premoveDests(from, piecesRef.current, piece.color).includes(to)) attemptPremove(from, to);
        }
      } else if (moved) {
        setSelected(null);
        setLegal(EMPTY_SQUARES);
        setPremoveSquares(EMPTY_SQUARES);
      }
      if (result === "accepted" || result === "pending") {
        park(toIdx);
        if (result === "pending" && to) promoDragRef.current = { from, to, toIdx };
        else onPieceDrop?.(from, to, true);
        return;
      }
      snapBack(from, [vx, vy]);
      onPieceDrop?.(from, to, false);
    }
  };
  const handlersRef = react.useRef(handlers);
  handlersRef.current = handlers;
  const onTapJS = react.useCallback((idx) => handlersRef.current.tap(idx), []);
  const onLiftJS = react.useCallback((idx) => handlersRef.current.liftPiece(idx), []);
  const onDropJS = react.useCallback(
    (from, to, vx, vy, moved) => handlersRef.current.drop(from, to, vx, vy, moved),
    []
  );
  const resolvePromotion = react.useCallback(
    (choice) => {
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
    [pendingPromotion, attemptMove, clearSelection, snapBack, onPieceDrop]
  );
  const onPromotionSelect = react.useCallback((p) => resolvePromotion(p), [resolvePromotion]);
  const onPromotionDismiss = react.useCallback(() => resolvePromotion(null), [resolvePromotion]);
  const gestureEnabled = size > 0 && (interactive || !!onSquarePress) && !pendingPromotion;
  const pan = react.useMemo(() => {
    const indexAt = (x, y) => {
      "worklet";
      if (!(x >= 0 && y >= 0 && x < size && y < size)) return -1;
      return Math.floor(y / s) * 8 + Math.floor(x / s);
    };
    return reactNativeGestureHandler.Gesture.Pan().enabled(gestureEnabled).minDistance(0).maxPointers(1).onBegin((e) => {
      "worklet";
      const idx = indexAt(e.x, e.y);
      candidate.value = -1;
      dragging.value = false;
      leftOrigin.value = false;
      if (idx < 0) return;
      if (snapshot.value.movable[idx]) {
        candidate.value = idx;
        startX.value = e.x;
        startY.value = e.y;
      } else {
        Animated2.runOnJS(onTapJS)(idx);
      }
    }).onUpdate((e) => {
      "worklet";
      const from = candidate.value;
      if (from < 0) return;
      if (!dragging.value) {
        const dx = e.x - startX.value;
        const dy = e.y - startY.value;
        if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return;
        dragging.value = true;
        Animated2.cancelAnimation(snapP);
        snapping.value = false;
        dropIdx.value = -1;
        dragCode.value = snapshot.value.codes[from];
        dragId.value = snapshot.value.ids[from];
        lift.value = Animated2.withTiming(1, { duration: 110, easing: Animated2.Easing.out(Animated2.Easing.cubic) });
        Animated2.runOnJS(onLiftJS)(from);
      }
      dragX.value = e.x;
      dragY.value = e.y;
      const idx = indexAt(e.x, e.y);
      if (idx !== from && idx >= 0) leftOrigin.value = true;
      const hover = idx === from ? -1 : idx;
      if (hoverIdx.value !== hover) hoverIdx.value = hover;
    }).onFinalize((e, success) => {
      "worklet";
      const from = candidate.value;
      candidate.value = -1;
      if (from < 0) return;
      if (!dragging.value) {
        Animated2.runOnJS(onTapJS)(from);
        return;
      }
      dragging.value = false;
      hoverIdx.value = -1;
      const target = success ? indexAt(e.x, e.y) : -1;
      const vx = (dragX.value - s / 2) / s;
      const vy = (dragY.value - s / 2 - dragLiftSquares * s * lift.value) / s;
      Animated2.runOnJS(onDropJS)(from, target, vx, vy, leftOrigin.value);
    });
  }, [
    gestureEnabled,
    size,
    s,
    dragLiftSquares,
    onTapJS,
    onLiftJS,
    onDropJS,
    candidate,
    dragging,
    leftOrigin,
    startX,
    startY,
    snapshot,
    snapP,
    snapping,
    dropIdx,
    dragCode,
    dragId,
    lift,
    dragX,
    dragY,
    hoverIdx
  ]);
  const spin = ms.spin;
  const spinKey = spin?.key ?? 0;
  const spinOffsets = spin?.offsets ?? ZERO_TO_ONE;
  const spinAngles = spin?.angles ?? NO_ANGLE;
  const spinP = Animated2.useSharedValue(1);
  const spinActive = Animated2.useSharedValue(-1);
  const spinStyle = Animated2.useAnimatedStyle(() => {
    "worklet";
    const p = spinActive.value === spinKey ? spinP.value : 0;
    return { transform: [{ rotate: `${lerpAt(spinAngles, segmentAt(p, spinOffsets))}deg` }] };
  }, [spinKey, spinOffsets, spinAngles, spinP, spinActive]);
  react.useEffect(() => {
    if (!spin) return;
    Animated2.cancelAnimation(spinP);
    spinP.value = 0;
    spinActive.value = spin.key;
    spinP.value = Animated2.withTiming(1, { duration: spin.durationMs, easing: Animated2.Easing.linear });
  }, [spinKey]);
  const shakePiece = react.useCallback((square) => {
    const delay = Math.max(0, snapUntilRef.current - Date.now());
    const now = Date.now();
    setMotionState((st) => retrack(st, square, (e) => shakeTrack(squareToPoint(e.square, st.orientation), delay), now));
    return new Promise((resolve) => setTimeout(resolve, delay + 380));
  }, []);
  shakeRef.current = shakePiece;
  react.useImperativeHandle(
    ref,
    () => ({
      pulseSquare(square, options = {}) {
        const durationMs = options.durationMs ?? 600;
        const times = Math.max(1, Math.round(options.times ?? 2));
        const spec = {
          key: ++pulseKeyRef.current,
          square,
          color: options.color ?? "rgba(255, 215, 0, 0.55)",
          durationMs,
          times
        };
        setPulses((p) => [...p, spec]);
        return new Promise(
          (resolve) => setTimeout(() => {
            setPulses((p) => p.filter((x) => x !== spec));
            resolve();
          }, durationMs * times + 32)
        );
      },
      shakePiece,
      animateMove(from, to, options = {}) {
        const m = motionRef.current;
        let durationMs = options.durationMs ?? Math.max(700, animationDurationMs * 3.5);
        if (reducedMotion) durationMs = Math.min(durationMs, 160);
        const now = Date.now();
        setMotionState(
          (st) => retrack(
            st,
            from,
            (e) => planMoveTrack(currentPoint(e, st.orientation, now), squareToPoint(to, st.orientation), {
              ...m,
              durationMs,
              distanceScaling: 0,
              liftScale: reducedMotion ? 1 : Math.max(m.liftScale, 1.08)
            }),
            now
          )
        );
        return new Promise((resolve) => setTimeout(resolve, durationMs + 16));
      },
      getSquareAtPoint(x, y) {
        return s > 0 ? pointToSquare(x / s, y / s, orientation) : null;
      },
      clearSelection
    }),
    [shakePiece, animationDurationMs, reducedMotion, s, orientation, clearSelection]
  );
  const label = accessibilityLabel ?? `Chess board, ${orientation} at the bottom`;
  const board = size > 0 ? /* @__PURE__ */ jsxRuntime.jsxs(reactNative.View, { style: { width: size, height: size }, collapsable: false, children: [
    /* @__PURE__ */ jsxRuntime.jsx(BoardSquares, { size, orientation, theme, showCoordinates }),
    /* @__PURE__ */ jsxRuntime.jsx(
      SquareOverlay,
      {
        size,
        orientation,
        theme,
        visuals,
        lastMove,
        check,
        highlightedSquares,
        markedSquares,
        selected,
        legal,
        premoveDests: premoveSquares,
        premoveCurrent,
        occupied,
        gradientId
      }
    ),
    interactive ? /* @__PURE__ */ jsxRuntime.jsx(HoverSquare, { size, hoverIdx, color: visuals.dragOverHighlight }) : null,
    pulses.map((p) => /* @__PURE__ */ jsxRuntime.jsx(Pulse, { spec: p, size, orientation }, p.key)),
    /* @__PURE__ */ jsxRuntime.jsx(Animated2__default.default.View, { style: [reactNative.StyleSheet.absoluteFill, styles4.passThrough, spinStyle], children: ms.entries.map((e) => /* @__PURE__ */ jsxRuntime.jsx(
      PieceView,
      {
        entry: e,
        orientation,
        size,
        renderPiece,
        flipPieces,
        dragId,
        dropIdx,
        originOpacity: visuals.dragOriginOpacity,
        onExitDone
      },
      e.id
    )) }),
    /* @__PURE__ */ jsxRuntime.jsx(Arrows, { size, orientation, arrows: stableArrows, brushes: arrowBrushes }),
    interactive ? /* @__PURE__ */ jsxRuntime.jsx(
      DragGhost,
      {
        size,
        drag,
        dragScale,
        liftSquares: dragLiftSquares,
        flipPieces,
        renderPiece
      }
    ) : null,
    pendingPromotion ? /* @__PURE__ */ jsxRuntime.jsx(
      PromotionChooser,
      {
        size,
        orientation,
        square: pendingPromotion.to,
        color: pendingPromotion.color,
        renderPiece,
        onSelect: onPromotionSelect,
        onDismiss: onPromotionDismiss
      }
    ) : null
  ] }) : null;
  return /* @__PURE__ */ jsxRuntime.jsx(
    reactNative.View,
    {
      style: [sizeProp !== void 0 ? { width: sizeProp, height: sizeProp } : styles4.auto, style],
      onLayout: sizeProp === void 0 ? onLayout : void 0,
      accessible: !pendingPromotion,
      accessibilityRole: "image",
      accessibilityLabel: label,
      testID,
      children: board ? /* @__PURE__ */ jsxRuntime.jsx(reactNativeGestureHandler.GestureDetector, { gesture: pan, children: board }) : null
    }
  );
});
var ChessiroCanvas = ChessiroBoard;
var styles4 = reactNative.StyleSheet.create({
  auto: { width: "100%", aspectRatio: 1 },
  passThrough: { pointerEvents: "none" }
});

exports.ChessiroBoard = ChessiroBoard;
exports.ChessiroCanvas = ChessiroCanvas;
exports.DEFAULT_ARROW_BRUSHES = DEFAULT_ARROW_BRUSHES;
exports.DEFAULT_BOARD_THEME = DEFAULT_BOARD_THEME;
exports.DEFAULT_PIECE_SVGS = DEFAULT_PIECE_SVGS;
exports.EASINGS = EASINGS;
exports.INITIAL_FEN = INITIAL_FEN;
exports.INITIAL_GAME_FEN = INITIAL_GAME_FEN;
exports.MOVE_ANIMATION_PRESETS = MOVE_ANIMATION_PRESETS;
exports.PieceArt = PieceArt;
exports.computeAnimPlan = computeAnimPlan;
exports.pointToSquare = pointToSquare;
exports.premoveDests = premoveDests;
exports.readFen = readFen;
exports.renderBoardSvg = renderBoardSvg;
exports.resolveMoveAnimation = resolveMoveAnimation;
exports.squareToPoint = squareToPoint;
exports.writeFen = writeFen;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map