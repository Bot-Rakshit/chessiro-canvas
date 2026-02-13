import type { Pieces, Piece, Square, AnimationPlan, AnimationVector, AnimationCurrent } from '../types';
import { ALL_SQUARES, square2pos, samePiece, distanceSq } from '../utils/coords';

// Cubic easing: fast start, smooth end
// https://gist.github.com/gre/1650294
function easing(t: number): number {
  return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

interface AnimPiece {
  square: Square;
  piece: Piece;
}

export function computeAnimPlan(prevPieces: Pieces, nextPieces: Pieces): AnimationPlan {
  const anims: Map<Square, AnimationVector> = new Map();
  const fadings: Map<Square, Piece> = new Map();
  const missings: AnimPiece[] = [];
  const news: AnimPiece[] = [];

  for (const sq of ALL_SQUARES) {
    const prev = prevPieces.get(sq);
    const next = nextPieces.get(sq);

    if (next) {
      if (prev) {
        if (!samePiece(prev, next)) {
          missings.push({ square: sq, piece: prev });
          news.push({ square: sq, piece: next });
        }
        // same piece at same square: no animation needed
      } else {
        news.push({ square: sq, piece: next });
      }
    } else if (prev) {
      missings.push({ square: sq, piece: prev });
    }
  }

  const animedOrigs: Square[] = [];

  for (const newP of news) {
    // Find closest missing piece of same type
    const candidates = missings.filter(
      m => samePiece(m.piece, newP.piece) && !animedOrigs.includes(m.square),
    );
    if (candidates.length === 0) continue;

    const newPos = square2pos(newP.square);
    candidates.sort(
      (a, b) => distanceSq(square2pos(a.square), newPos) - distanceSq(square2pos(b.square), newPos),
    );

    const closest = candidates[0];
    const fromPos = square2pos(closest.square);
    const toPos = newPos;
    const dx = fromPos[0] - toPos[0];
    const dy = fromPos[1] - toPos[1];

    anims.set(newP.square, {
      fromPos,
      toPos,
      currentX: dx,
      currentY: dy,
    });
    animedOrigs.push(closest.square);
  }

  // Unmatched missings become fading pieces
  for (const m of missings) {
    if (!animedOrigs.includes(m.square)) {
      fadings.set(m.square, m.piece);
    }
  }

  return { anims, fadings };
}

export interface AnimationController {
  start: (plan: AnimationPlan, durationMs: number) => void;
  cancel: () => void;
  isAnimating: () => boolean;
}

export function createAnimationController(
  onFrame: (current: AnimationCurrent) => void,
  onComplete: () => void,
): AnimationController {
  let current: AnimationCurrent | null = null;
  let rafId: number | null = null;

  function step(now: number) {
    if (!current) {
      onComplete();
      return;
    }

    const elapsed = now - current.start;
    const rest = 1 - elapsed * current.frequency;

    if (rest <= 0) {
      current = null;
      onComplete();
      return;
    }

    const ease = easing(rest);
    for (const vec of current.plan.anims.values()) {
      vec.currentX = (vec.fromPos[0] - vec.toPos[0]) * ease;
      vec.currentY = (vec.fromPos[1] - vec.toPos[1]) * ease;
    }

    onFrame(current);
    rafId = requestAnimationFrame(step);
  }

  return {
    start(plan, durationMs) {
      if (rafId !== null) cancelAnimationFrame(rafId);

      if (plan.anims.size === 0 && plan.fadings.size === 0) {
        onComplete();
        return;
      }

      current = {
        start: performance.now(),
        frequency: 1 / durationMs,
        plan,
      };

      rafId = requestAnimationFrame(step);
    },

    cancel() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      current = null;
    },

    isAnimating() {
      return current !== null;
    },
  };
}
