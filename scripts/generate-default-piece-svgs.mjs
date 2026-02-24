import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultPieces as reactChessboardDefaultPieces } from 'react-chessboard';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'assets/pieces/chessiro');

const PIECE_CODES = ['wp', 'wn', 'wb', 'wr', 'wq', 'wk', 'bp', 'bn', 'bb', 'br', 'bq', 'bk'];

function toReactChessboardKey(code) {
  return `${code[0]}${code[1].toUpperCase()}`;
}

function renderPieceSvg(code) {
  const key = toReactChessboardKey(code);
  const PieceComponent = reactChessboardDefaultPieces[key];
  if (!PieceComponent) {
    throw new Error(`Missing piece renderer in react-chessboard defaultPieces for key: ${key}`);
  }

  const markup = renderToStaticMarkup(React.createElement(PieceComponent));
  return `<?xml version="1.0" encoding="UTF-8"?>\n${markup}\n`;
}

fs.mkdirSync(outDir, { recursive: true });

for (const code of PIECE_CODES) {
  const svg = renderPieceSvg(code);
  fs.writeFileSync(path.join(outDir, `${code}.svg`), svg, 'utf8');
}

console.log(`Generated ${PIECE_CODES.length} default piece SVGs from react-chessboard in ${outDir}`);
