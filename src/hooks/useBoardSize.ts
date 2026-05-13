import { useCallback, useEffect, useRef, useState } from 'react';

export interface BoardBounds {
  width: number;
  height: number;
  left: number;
  top: number;
}

export function useBoardSize(boardRef: React.RefObject<HTMLDivElement | null>) {
  const [bounds, setBounds] = useState<BoardBounds | null>(null);
  const cachedBounds = useRef<BoardBounds | null>(null);

  // Read size from offsetWidth/offsetHeight so CSS transforms on the board (or
  // any ancestor — e.g. a modal's open zoom animation) don't shrink the size
  // we pass to the renderer. getBoundingClientRect returns transform-scaled
  // dimensions, which causes pieces to mis-align with squares when the board
  // is measured mid-animation.
  const readMetrics = useCallback((el: HTMLDivElement): BoardBounds | null => {
    const rect = el.getBoundingClientRect();
    const width = el.offsetWidth || rect.width;
    const height = el.offsetHeight || rect.height;
    if (width === 0 || height === 0) return null;
    return {
      width,
      height,
      left: rect.left,
      top: rect.top,
    };
  }, []);

  const updateBounds = useCallback(() => {
    const el = boardRef.current;
    if (!el) return;
    const newBounds = readMetrics(el);
    if (!newBounds) return;

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
  }, [boardRef, readMetrics]);

  // Returns fresh bounds directly from the DOM — use this for pointer events
  // to avoid stale cached bounds after scroll/layout shifts on mobile.
  const getFreshBounds = useCallback((): BoardBounds | null => {
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

    window.addEventListener('scroll', updateBounds, { passive: true, capture: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', updateBounds, { capture: true } as EventListenerOptions);
    };
  }, [boardRef, updateBounds]);

  return { bounds, updateBounds, getFreshBounds };
}
