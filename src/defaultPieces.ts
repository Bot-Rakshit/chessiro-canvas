import { DEFAULT_PIECE_DATA_URIS } from './defaultPieceDataUris';

type DefaultPieceCode =
  | 'wp'
  | 'wn'
  | 'wb'
  | 'wr'
  | 'wq'
  | 'wk'
  | 'bp'
  | 'bn'
  | 'bb'
  | 'br'
  | 'bq'
  | 'bk';

const DEFAULT_PIECE_SOURCES: Record<DefaultPieceCode, string> = DEFAULT_PIECE_DATA_URIS;

export function resolvePieceImageSrc(pieceKey: string, piecePath?: string): string {
  const normalized = pieceKey.toLowerCase() as DefaultPieceCode;
  if (piecePath) return `${piecePath}/${normalized}.svg`;
  return DEFAULT_PIECE_SOURCES[normalized] ?? DEFAULT_PIECE_SOURCES.wq;
}
