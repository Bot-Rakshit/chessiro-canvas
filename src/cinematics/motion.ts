// Shared WAAPI helpers for the cinematic toolkit. Everything here is lazy:
// no DOM, no listeners and no media-query subscriptions are created until a
// cinematic actually plays.

export function canAnimate(el: Element): el is HTMLElement & { animate: Element['animate'] } {
  return typeof (el as HTMLElement).animate === 'function';
}

/**
 * Resolve when an animation settles (finish or cancel). Tolerates
 * environments where animate() returns an object without `.finished`
 * (old Safari): falls back to the onfinish/oncancel events, and as a last
 * resort to a timer slightly longer than the expected duration.
 */
export function waitForAnimation(anim: Animation | null | undefined, fallbackMs: number): Promise<void> {
  if (!anim) {
    return new Promise<void>((resolve) => setTimeout(resolve, fallbackMs));
  }
  return new Promise<void>((resolve) => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      resolve();
    };
    // Frameless environments (headless capture, backgrounded/throttled tabs)
    // stop producing rendering frames, so WAAPI timelines freeze and
    // `finished` never resolves. The watchdog guarantees cinematics can never
    // deadlock a replay script; in a rendering browser it never fires first.
    const watchdog = setTimeout(settle, fallbackMs * 2 + 1000);
    const finished = (anim as Partial<Animation>).finished;
    if (finished && typeof finished.then === 'function') {
      finished.then(settle, settle);
      return;
    }
    try {
      anim.onfinish = settle;
      anim.oncancel = settle;
    } catch {
      // Property assignment can throw on exotic stubs; the watchdog covers us.
    }
  });
}

/**
 * Live prefers-reduced-motion check. The MediaQueryList is created lazily on
 * first use and never subscribed to — `.matches` is read fresh every call.
 */
let reducedMotionQuery: MediaQueryList | null | undefined;
export function prefersReducedMotion(): boolean {
  if (reducedMotionQuery === undefined) {
    reducedMotionQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
  }
  return reducedMotionQuery?.matches ?? false;
}
