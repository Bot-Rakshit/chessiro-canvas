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

const DEFAULT_PIECE_SOURCES: Record<DefaultPieceCode, string> = {
  wp: new URL('../assets/pieces/chessiro/wp.svg', import.meta.url).toString(),
  wn: new URL('../assets/pieces/chessiro/wn.svg', import.meta.url).toString(),
  wb: new URL('../assets/pieces/chessiro/wb.svg', import.meta.url).toString(),
  wr: new URL('../assets/pieces/chessiro/wr.svg', import.meta.url).toString(),
  wq: new URL('../assets/pieces/chessiro/wq.svg', import.meta.url).toString(),
  wk: new URL('../assets/pieces/chessiro/wk.svg', import.meta.url).toString(),
  bp: new URL('../assets/pieces/chessiro/bp.svg', import.meta.url).toString(),
  bn: new URL('../assets/pieces/chessiro/bn.svg', import.meta.url).toString(),
  bb: new URL('../assets/pieces/chessiro/bb.svg', import.meta.url).toString(),
  br: new URL('../assets/pieces/chessiro/br.svg', import.meta.url).toString(),
  bq: new URL('../assets/pieces/chessiro/bq.svg', import.meta.url).toString(),
  bk: new URL('../assets/pieces/chessiro/bk.svg', import.meta.url).toString(),
};

export function resolvePieceImageSrc(pieceKey: string, piecePath?: string): string {
  const normalized = pieceKey.toLowerCase() as DefaultPieceCode;
  if (piecePath) return `${piecePath}/${normalized}.svg`;
  return DEFAULT_PIECE_SOURCES[normalized] ?? DEFAULT_PIECE_SOURCES.wq;
}
