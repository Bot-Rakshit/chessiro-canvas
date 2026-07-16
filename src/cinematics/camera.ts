import type {
  CameraController, CameraDriftOptions, CameraShakeOptions,
  CameraTiltOptions, CameraZoomOptions, Square,
} from '../types';
import { canAnimate, prefersReducedMotion, waitForAnimation } from './motion';

const DEFAULT_ZOOM_SCALE = 1.6;
const DEFAULT_ZOOM_DURATION_MS = 600;
const DEFAULT_ZOOM_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
const DEFAULT_TILT_DEG = 18;
const DEFAULT_SHAKE_INTENSITY_PX = 6;
const DEFAULT_SHAKE_DURATION_MS = 400;
const DEFAULT_DRIFT_SCALE = 1.06;
const DEFAULT_DRIFT_DURATION_MS = 6000;

function squareColRow(sq: string, asWhite: boolean): [number, number] {
  const f = sq.charCodeAt(0) - 97;
  const r = sq.charCodeAt(1) - 49;
  return [asWhite ? f : 7 - f, asWhite ? 7 - r : r];
}

function isValidSquare(sq: string): sq is Square {
  return typeof sq === 'string' && /^[a-h][1-8]$/.test(sq);
}

/**
 * Cinematic "camera" implemented as WAAPI transforms on the board root
 * element. Holds no DOM, listeners or animations until a method is called.
 *
 * IMPORTANT: camera transforms change getBoundingClientRect, so
 * pointer-to-square math is wrong while zoomed/tilted — use the camera on
 * non-interactive replay boards (`interactive={false}`); `reset()` restores
 * correctness. Board METRICS are unaffected because useBoardSize measures
 * offsetWidth/offsetHeight, which ignore CSS transforms.
 *
 * zoomTo moves the transform-origin, so start zooms from the identity state
 * (or after zoomOut/reset) for exact framing.
 */
export function createCameraController(
  getRoot: () => HTMLElement | null,
  getAsWhite: () => boolean,
): CameraController {
  const state = { scale: 1, rotateX: 0, rotateY: 0 };
  const active = new Set<Animation>();

  const composeTransform = (): string => {
    const parts: string[] = [];
    if (state.rotateX !== 0 || state.rotateY !== 0) {
      parts.push('perspective(1000px)');
      if (state.rotateX !== 0) parts.push(`rotateX(${state.rotateX}deg)`);
      if (state.rotateY !== 0) parts.push(`rotateY(${state.rotateY}deg)`);
    }
    if (state.scale !== 1) parts.push(`scale(${state.scale})`);
    return parts.length > 0 ? parts.join(' ') : 'none';
  };

  const applyEndState = (root: HTMLElement, target: string): void => {
    root.style.transform = target === 'none' ? '' : target;
  };

  const animateTo = (root: HTMLElement, target: string, durationMs: number, easing: string): Promise<void> => {
    if (!canAnimate(root) || durationMs <= 0) {
      applyEndState(root, target);
      return Promise.resolve();
    }
    const from = (typeof getComputedStyle === 'function' && getComputedStyle(root).transform) || 'none';
    const anim = root.animate(
      [{ transform: from }, { transform: target }],
      { duration: durationMs, easing },
    );
    active.add(anim);
    return waitForAnimation(anim, durationMs).then(() => {
      if (active.has(anim)) {
        active.delete(anim);
        applyEndState(root, target);
        anim.cancel();
      }
    });
  };

  const skip = (force?: boolean): boolean => prefersReducedMotion() && !force;

  return {
    zoomTo(square: Square, options?: CameraZoomOptions): Promise<void> {
      const root = getRoot();
      if (!root || !isValidSquare(square) || skip(options?.force)) return Promise.resolve();
      const [col, row] = squareColRow(square, getAsWhite());
      root.style.transformOrigin = `${(col + 0.5) * 12.5}% ${(row + 0.5) * 12.5}%`;
      state.scale = options?.scale ?? DEFAULT_ZOOM_SCALE;
      return animateTo(
        root,
        composeTransform(),
        options?.durationMs ?? DEFAULT_ZOOM_DURATION_MS,
        options?.easing ?? DEFAULT_ZOOM_EASING,
      );
    },

    zoomOut(options?: CameraZoomOptions): Promise<void> {
      const root = getRoot();
      if (!root || skip(options?.force)) return Promise.resolve();
      state.scale = 1;
      return animateTo(
        root,
        composeTransform(),
        options?.durationMs ?? DEFAULT_ZOOM_DURATION_MS,
        options?.easing ?? DEFAULT_ZOOM_EASING,
      );
    },

    tilt(options?: CameraTiltOptions): Promise<void> {
      const root = getRoot();
      if (!root || skip(options?.force)) return Promise.resolve();
      state.rotateX = options?.rotateX ?? DEFAULT_TILT_DEG;
      state.rotateY = options?.rotateY ?? 0;
      return animateTo(
        root,
        composeTransform(),
        options?.durationMs ?? DEFAULT_ZOOM_DURATION_MS,
        options?.easing ?? DEFAULT_ZOOM_EASING,
      );
    },

    shake(options?: CameraShakeOptions): Promise<void> {
      const root = getRoot();
      if (!root || !canAnimate(root) || skip(options?.force)) return Promise.resolve();
      const intensity = options?.intensity ?? DEFAULT_SHAKE_INTENSITY_PX;
      const durationMs = options?.durationMs ?? DEFAULT_SHAKE_DURATION_MS;
      const steps = 6;
      const frames: Keyframe[] = [{ transform: 'translate(0px, 0px)' }];
      for (let i = 1; i <= steps; i++) {
        const amp = intensity * (1 - i / (steps + 1));
        const sign = i % 2 === 0 ? 1 : -1;
        frames.push({ transform: `translate(${sign * amp}px, ${-sign * amp * 0.6}px)` });
      }
      frames.push({ transform: 'translate(0px, 0px)' });
      let anim: Animation;
      try {
        // composite: 'add' shakes on top of any zoom/tilt transform.
        anim = root.animate(frames, { duration: durationMs, easing: 'ease-out', composite: 'add' });
      } catch {
        anim = root.animate(frames, { duration: durationMs, easing: 'ease-out' });
      }
      active.add(anim);
      return waitForAnimation(anim, durationMs).then(() => {
        active.delete(anim);
      });
    },

    drift(options?: CameraDriftOptions): { stop: () => void } {
      const root = getRoot();
      if (!root || !canAnimate(root) || skip(options?.force)) return { stop: () => {} };
      const scale = options?.scale ?? DEFAULT_DRIFT_SCALE;
      const durationMs = options?.durationMs ?? DEFAULT_DRIFT_DURATION_MS;
      const base = composeTransform();
      const prefix = base === 'none' ? '' : `${base} `;
      const wander = (scale - 1) * 100;
      const anim = root.animate(
        [
          { transform: `${prefix}translate(0%, 0%) scale(1)` },
          { transform: `${prefix}translate(${-wander / 2}%, ${wander / 3}%) scale(${scale})` },
        ],
        { duration: Math.max(500, durationMs), easing: 'ease-in-out', direction: 'alternate', iterations: Infinity },
      );
      active.add(anim);
      return {
        stop: () => {
          if (active.has(anim)) {
            active.delete(anim);
            anim.cancel();
          }
        },
      };
    },

    reset(): void {
      for (const anim of Array.from(active)) anim.cancel();
      active.clear();
      state.scale = 1;
      state.rotateX = 0;
      state.rotateY = 0;
      const root = getRoot();
      if (root) {
        root.style.transform = '';
        root.style.transformOrigin = '';
      }
    },
  };
}
