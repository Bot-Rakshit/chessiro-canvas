import type {
  CameraController, CameraShakeOptions, CameraTiltOptions, CameraZoomOptions,
  CinematicPlayback, CinematicStep, PlayCinematicOptions,
} from '../types';
import type { CinematicLayerRef } from '../render/CinematicLayer';

export interface DirectorContext {
  getLayer: () => CinematicLayerRef | null;
  /** Creates the camera on first use. */
  getCamera: () => CameraController;
  /** Returns the camera only if it was already created. */
  peekCamera: () => CameraController | null;
}

/**
 * Run a cinematic script: each step awaits the previous one ('parallel' runs
 * children concurrently). `cancel()` stops mid-sequence, clears all cinematic
 * effects and resets the camera. The caller is responsible for cancelling any
 * previous playback before starting a new one.
 */
export function playCinematicScript(
  ctx: DirectorContext,
  steps: CinematicStep[],
  options?: PlayCinematicOptions,
): CinematicPlayback {
  let cancelled = false;
  const cancelHooks = new Set<() => void>();
  const force = options?.force;

  const wait = (ms: number): Promise<void> => new Promise<void>((resolve) => {
    const hook = () => {
      clearTimeout(tid);
      resolve();
    };
    const tid = setTimeout(() => {
      cancelHooks.delete(hook);
      resolve();
    }, ms);
    cancelHooks.add(hook);
  });

  const runStep = async (step: CinematicStep): Promise<void> => {
    if (cancelled) return;
    switch (step.type) {
      case 'move': {
        await ctx.getLayer()?.cinematicMove(step.from, step.to, { force, ...step.options });
        break;
      }
      case 'camera': {
        const opts = step.options as Record<string, unknown> | undefined;
        switch (step.action) {
          case 'zoomTo':
            if (step.square) {
              await ctx.getCamera().zoomTo(step.square, { force, ...opts } as CameraZoomOptions);
            }
            break;
          case 'zoomOut':
            await ctx.getCamera().zoomOut({ force, ...opts } as CameraZoomOptions);
            break;
          case 'tilt':
            await ctx.getCamera().tilt({ force, ...opts } as CameraTiltOptions);
            break;
          case 'shake':
            await ctx.getCamera().shake({ force, ...opts } as CameraShakeOptions);
            break;
          case 'reset':
            ctx.peekCamera()?.reset();
            break;
        }
        break;
      }
      case 'burst': {
        await ctx.getLayer()?.squareBurst(step.square, { force, ...step.options });
        break;
      }
      case 'badge': {
        await ctx.getLayer()?.popBadge(step.square, { force, ...step.options });
        break;
      }
      case 'celebrate': {
        await ctx.getLayer()?.celebrate({ force, ...step.options });
        break;
      }
      case 'banner': {
        await ctx.getLayer()?.popBanner({ force, ...step.options });
        break;
      }
      case 'wait': {
        await wait(step.ms);
        break;
      }
      case 'parallel': {
        await Promise.all(step.steps.map(runStep));
        break;
      }
      case 'call': {
        await step.fn();
        break;
      }
    }
  };

  const finished = (async () => {
    for (const step of steps) {
      if (cancelled) break;
      await runStep(step);
    }
  })();

  const cancel = (): void => {
    if (cancelled) return;
    cancelled = true;
    for (const hook of Array.from(cancelHooks)) hook();
    cancelHooks.clear();
    ctx.getLayer()?.clearCinematics();
    ctx.peekCamera()?.reset();
  };

  return { finished, cancel };
}
