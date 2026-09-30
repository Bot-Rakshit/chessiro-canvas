import type { PieceCode } from '../core/boardSvg';

export interface RasterOptions {
  /** Output width/height in CSS px. Default: the SVG's own size. */
  size?: number;
  /** Device-pixel multiplier for crisp output on retina screens. Default: 2. */
  pixelRatio?: number;
  /** Image MIME type. Default: 'image/png'. */
  type?: 'image/png' | 'image/jpeg' | 'image/webp';
  /** Encoder quality for jpeg/webp (0..1). */
  quality?: number;
}

const PIECE_CODES: PieceCode[] = ['wp', 'wn', 'wb', 'wr', 'wq', 'wk', 'bp', 'bn', 'bb', 'br', 'bq', 'bk'];
const pieceSetCache = new Map<string, Promise<Partial<Record<PieceCode, string>>>>();

/**
 * Fetch a piece set's SVG sources so they can be inlined — a rasterised SVG
 * can't load external images, and inlining keeps the export self-contained.
 * Pieces that fail to load fall back to the built-in set.
 */
export function loadPieceSetSvgs(path: string): Promise<Partial<Record<PieceCode, string>>> {
  let pending = pieceSetCache.get(path);
  if (!pending) {
    pending = Promise.all(
      PIECE_CODES.map(async (code) => {
        try {
          const res = await fetch(`${path}/${code}.svg`);
          if (!res.ok) return null;
          const text = await res.text();
          return text.includes('<svg') ? ([code, text] as const) : null;
        } catch {
          return null;
        }
      }),
    ).then((entries) => {
      const out: Partial<Record<PieceCode, string>> = {};
      for (const e of entries) if (e) out[e[0]] = e[1];
      return out;
    });
    pieceSetCache.set(path, pending);
  }
  return pending;
}

/** Rasterise an SVG string to an image Blob (PNG by default) in the browser. */
export async function svgToImageBlob(svg: string, options: RasterOptions = {}): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('svgToImageBlob needs a DOM (use renderBoardSvg on the server).');
  }
  const intrinsic = Number(/<svg[^>]*\swidth="([\d.]+)"/.exec(svg)?.[1] ?? 512);
  const size = options.size ?? intrinsic;
  const ratio = options.pixelRatio ?? 2;
  const img = new Image();
  img.decoding = 'async';
  // A data URL (not a blob URL) keeps Safari from tainting the canvas.
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Board SVG failed to load for rasterising.'));
  });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(size * ratio);
  canvas.height = Math.round(size * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable.');
  if (options.type === 'image/jpeg') {
    // JPEG has no alpha: paint the transparent frame corners white.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas encoding failed.'))),
      options.type ?? 'image/png',
      options.quality,
    );
  });
}
