import { useCallback, useEffect, useRef, useState } from 'react';

export interface BoardBounds {
  width: number;
  height: number;
  left: number;
  top: number;
}

// Snap to device pixel grid (from chessground) to prevent subpixel blurriness
function snapToGrid(value: number): number {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
  return (Math.floor((value * dpr) / 8) * 8) / dpr;
}

export function useBoardSize(boardRef: React.RefObject<HTMLDivElement | null>) {
  const [bounds, setBounds] = useState<BoardBounds | null>(null);
  const cachedBounds = useRef<BoardBounds | null>(null);

  const updateBounds = useCallback(() => {
    const el = boardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const snapped = snapToGrid(rect.width);
    const newBounds: BoardBounds = {
      width: snapped,
      height: snapped,
      left: rect.left,
      top: rect.top,
    };

    const prev = cachedBounds.current;
    if (
      prev &&
      prev.width === newBounds.width &&
      prev.height === newBounds.height &&
      prev.left === newBounds.left &&
      prev.top === newBounds.top
    ) {
      return;
    }

    cachedBounds.current = newBounds;
    setBounds(newBounds);
  }, [boardRef]);

  useEffect(() => {
    updateBounds();
    const el = boardRef.current;
    if (!el) return;

    const observer = new ResizeObserver(updateBounds);
    observer.observe(el);

    window.addEventListener('scroll', updateBounds, { passive: true, capture: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', updateBounds, { capture: true } as EventListenerOptions);
    };
  }, [boardRef, updateBounds]);

  return { bounds, updateBounds };
}
