import { memo } from 'react';
import type { MoveQualityBadge, Orientation } from '../types';

interface BadgeProps {
  badge: MoveQualityBadge;
  orientation: Orientation;
  squareSize: number;
}

export const Badge = memo(function Badge({ badge, orientation, squareSize }: BadgeProps) {
  const file = badge.square.charCodeAt(0) - 97;
  const rank = parseInt(badge.square[1]) - 1;

  const asWhite = orientation === 'white';
  const col = asWhite ? file : 7 - file;
  const row = asWhite ? 7 - rank : rank;

  const isTopEdge = row === 0;
  const isRightEdge = col === 7;

  const size = Math.max(16, Math.min(28, squareSize * 0.45));

  let top: string;
  let right: string;
  let transform: string | undefined;

  if (isTopEdge && isRightEdge) {
    top = '5%';
    right = '5%';
  } else if (isTopEdge) {
    top = '5%';
    right = '0';
    transform = 'translateX(50%)';
  } else if (isRightEdge) {
    top = '0';
    right = '5%';
    transform = 'translateY(-50%)';
  } else {
    top = '0';
    right = '0';
    transform = 'translate(50%, -50%)';
  }

  const x = col * squareSize;
  const y = row * squareSize;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: squareSize,
        height: squareSize,
        pointerEvents: 'none',
        zIndex: 10,
        overflow: 'visible',
      }}
    >
      <img
        src={badge.icon}
        alt={badge.label || ''}
        draggable={false}
        style={{
          position: 'absolute',
          width: size,
          height: size,
          top,
          right,
          transform,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
});
