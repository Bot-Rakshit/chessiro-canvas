import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Arrow, ArrowVisuals } from '../types';

/** Cubic ease matching piece animations: fast start, smooth end. */
function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

export interface PresentArrow {
  key: string;
  arrow: Arrow;
  /** Relative opacity 0..1 (multiplied by `arrowVisuals.opacity` when drawing). */
  alpha: number;
  /** True while the arrow is animating out after removal from props. */
  exiting: boolean;
}

interface TrackedArrow {
  key: string;
  arrow: Arrow;
  alpha: number;
  from: number;
  to: number;
  start: number;
  duration: number;
  exiting: boolean;
}

export function arrowPresenceKey(arrow: Arrow): string {
  return arrow.id ?? `${arrow.startSquare}-${arrow.endSquare}-${arrow.color}`;
}

function resolveFadeIn(arrow: Arrow, visuals: Partial<ArrowVisuals>): number {
  const value = arrow.fadeInMs ?? visuals.fadeInMs ?? 0;
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function resolveFadeOut(arrow: Arrow, visuals: Partial<ArrowVisuals>): number {
  const value = arrow.fadeOutMs ?? visuals.fadeOutMs ?? 0;
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function toPresent(tracked: TrackedArrow[]): PresentArrow[] {
  return tracked.map((item) => ({
    key: item.key,
    arrow: item.arrow,
    alpha: item.alpha,
    exiting: item.exiting,
  }));
}

/**
 * Keeps arrows mounted through enter/exit fades so controlled `arrows` can
 * appear and disappear with opacity animation.
 */
export function useArrowPresence(
  arrows: Arrow[],
  visuals: Partial<ArrowVisuals> = {},
): PresentArrow[] {
  const [present, setPresent] = useState<PresentArrow[]>([]);
  const trackedRef = useRef<TrackedArrow[]>([]);
  const visualsRef = useRef(visuals);
  const rafRef = useRef<number | null>(null);

  visualsRef.current = visuals;

  // Cancel rAF on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  // Layout effect so the first paint already includes enter/exit arrows (no flash).
  useLayoutEffect(() => {
    const now = performance.now();
    const nextVisuals = visualsRef.current;
    const prev = trackedRef.current;
    const prevByKey = new Map(prev.map((item) => [item.key, item]));
    const incomingKeys = new Set<string>();
    const next: TrackedArrow[] = [];

    // Keep first occurrence of each key (chess arrows are usually unique).
    for (const arrow of arrows) {
      const key = arrowPresenceKey(arrow);
      if (incomingKeys.has(key)) continue;
      incomingKeys.add(key);

      const existing = prevByKey.get(key);
      const fadeIn = resolveFadeIn(arrow, nextVisuals);

      if (!existing) {
        if (fadeIn <= 0) {
          next.push({
            key,
            arrow,
            alpha: 1,
            from: 1,
            to: 1,
            start: now,
            duration: 0,
            exiting: false,
          });
        } else {
          next.push({
            key,
            arrow,
            alpha: 0,
            from: 0,
            to: 1,
            start: now,
            duration: fadeIn,
            exiting: false,
          });
        }
        continue;
      }

      // Still present: refresh arrow data. If it was exiting, reverse to fade-in.
      if (existing.exiting) {
        const reverseIn = fadeIn > 0 ? fadeIn : resolveFadeOut(existing.arrow, nextVisuals);
        if (reverseIn <= 0) {
          next.push({
            key,
            arrow,
            alpha: 1,
            from: 1,
            to: 1,
            start: now,
            duration: 0,
            exiting: false,
          });
        } else {
          next.push({
            key,
            arrow,
            alpha: existing.alpha,
            from: existing.alpha,
            to: 1,
            start: now,
            duration: reverseIn,
            exiting: false,
          });
        }
      } else {
        next.push({
          ...existing,
          arrow,
          // Keep any in-progress enter animation; otherwise stay fully visible.
          exiting: false,
        });
      }
    }

    // Start exit animations for arrows that left the controlled list.
    for (const existing of prev) {
      if (incomingKeys.has(existing.key)) continue;
      if (existing.exiting) {
        next.push(existing);
        continue;
      }

      const fadeOut = resolveFadeOut(existing.arrow, nextVisuals);
      if (fadeOut <= 0) {
        // Drop immediately — no tracked entry.
        continue;
      }

      next.push({
        key: existing.key,
        arrow: existing.arrow,
        alpha: existing.alpha,
        from: existing.alpha,
        to: 0,
        start: now,
        duration: fadeOut,
        exiting: true,
      });
    }

    trackedRef.current = next;
    setPresent(toPresent(next));

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const needsFrames = next.some(
      (item) => item.duration > 0 && item.from !== item.to,
    );
    if (!needsFrames) return;

    const step = (frameNow: number) => {
      const current = trackedRef.current;
      let animating = false;
      const updated: TrackedArrow[] = [];

      for (const item of current) {
        if (item.duration <= 0 || item.from === item.to) {
          if (!(item.exiting && item.alpha <= 0)) {
            updated.push(item);
          }
          continue;
        }

        const t = Math.min(1, (frameNow - item.start) / item.duration);
        const alpha = item.from + (item.to - item.from) * ease(t);
        const done = t >= 1;

        if (item.exiting && done) {
          // Fully faded out — drop from the list.
          continue;
        }

        updated.push({
          ...item,
          alpha: done ? item.to : alpha,
          from: done ? item.to : item.from,
          duration: done ? 0 : item.duration,
        });

        if (!done) animating = true;
      }

      trackedRef.current = updated;
      setPresent(toPresent(updated));

      if (animating) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(step);
  }, [arrows, visuals.fadeInMs, visuals.fadeOutMs]);

  return present;
}
