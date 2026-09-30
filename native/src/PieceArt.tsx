import { memo } from 'react';
import type { ReactNode } from 'react';
import { SvgXml } from 'react-native-svg';
import { DEFAULT_PIECE_SVGS } from './core';
import type { PieceCode } from './core';
import type { PieceRenderFn } from './types';

// react-native-svg's XML parser only needs the <svg> element; drop the prolog
// and the percentage size (the element is sized by props) once, at load.
const PIECE_XML = Object.fromEntries(
  (Object.keys(DEFAULT_PIECE_SVGS) as PieceCode[]).map((code) => [
    code,
    DEFAULT_PIECE_SVGS[code]
      .replace(/<\?xml[^>]*\?>/, '')
      .replace(/\s(width|height)="100%"/g, '')
      .trim(),
  ]),
) as Record<PieceCode, string>;

interface PieceArtProps {
  code: PieceCode;
  size: number;
  renderPiece?: PieceRenderFn;
}

/**
 * Artwork for one piece. Memoised on (code, size, renderer), so the SVG XML is
 * parsed when a piece mounts or the board resizes — never while it moves:
 * motion is applied to the wrapping Animated.View on the UI thread.
 */
export const PieceArt = memo(function PieceArt({ code, size, renderPiece }: PieceArtProps): ReactNode {
  if (renderPiece) return renderPiece(code, size);
  return <SvgXml xml={PIECE_XML[code]} width={size} height={size} />;
});

export const ALL_PIECE_CODES: readonly PieceCode[] = [
  'wp', 'wn', 'wb', 'wr', 'wq', 'wk',
  'bp', 'bn', 'bb', 'br', 'bq', 'bk',
];
