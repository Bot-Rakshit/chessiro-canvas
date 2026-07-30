import { useRef } from 'react';

function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
    if (!(key in b)) return false;
  }
  return true;
}

/**
 * Returns a reference-stable version of an object that is rebuilt every render.
 *
 * Config props are almost always written as inline literals:
 *
 *     <ChessiroCanvas squareVisuals={{ legalDot: '#fff' }} />
 *
 * That object has a fresh identity on every parent render. Anything memoized on
 * its reference — here, all 64 memoized square cells — is invalidated even when
 * no value actually changed. This keeps the previous object whenever a shallow
 * compare says the contents are equal, so `memo()` downstream stays effective
 * without asking callers to wrap every config in `useMemo`.
 *
 * Only sound for flat objects of primitives, which is what the visual configs
 * are. Pass the already-merged object; the temporary allocated to compare is
 * far cheaper than the re-render it prevents.
 */
export function useStableObject<T extends Record<string, unknown>>(next: T): T {
  const ref = useRef<T>(next);
  if (ref.current !== next && !shallowEqual(ref.current, next)) {
    ref.current = next;
  }
  return ref.current;
}
