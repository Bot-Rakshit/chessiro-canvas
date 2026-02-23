import { memo, useEffect, useState } from 'react';
import type { TextOverlay, Orientation } from '../types';
import { square2pos, pos2translate } from '../utils/coords';
import type { Square } from '../types';

interface OverlaysProps {
  overlays: TextOverlay[];
  orientation: Orientation;
  boardWidth: number;
  boardHeight: number;
  renderer?: (overlay: TextOverlay) => React.ReactNode;
}

export const OverlaysLayer = memo(function OverlaysLayer({
  overlays,
  orientation,
  boardWidth,
  boardHeight,
  renderer,
}: OverlaysProps) {
  if (overlays.length === 0) return null;

  const asWhite = orientation === 'white';

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 15 }}>
      {overlays.map((overlay) => (
        <OverlayItem
          key={overlay.id}
          overlay={overlay}
          asWhite={asWhite}
          boardWidth={boardWidth}
          boardHeight={boardHeight}
          renderer={renderer}
        />
      ))}
    </div>
  );
});

const OverlayItem = memo(function OverlayItem({
  overlay,
  asWhite,
  boardWidth,
  boardHeight,
  renderer,
}: {
  overlay: TextOverlay;
  asWhite: boolean;
  boardWidth: number;
  boardHeight: number;
  renderer?: (overlay: TextOverlay) => React.ReactNode;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
  }, [
    overlay.id,
    overlay.text,
    overlay.square,
    overlay.duration,
    overlay.position?.x,
    overlay.position?.y,
  ]);

  useEffect(() => {
    if (overlay.duration && overlay.duration > 0) {
      const timer = setTimeout(() => setVisible(false), overlay.duration);
      return () => clearTimeout(timer);
    }
  }, [overlay.duration]);

  if (!visible) return null;

  if (renderer) {
    return <>{renderer(overlay)}</>;
  }

  // Default: position near square or at absolute position
  let style: React.CSSProperties = {
    position: 'absolute',
    pointerEvents: 'none',
    transition: 'opacity 300ms ease',
    ...overlay.style,
  };

  if (overlay.square) {
    const pos = square2pos(overlay.square as Square);
    const [x, y] = pos2translate(pos, asWhite, boardWidth, boardHeight);
    const sqW = boardWidth / 8;
    style = {
      ...style,
      left: x + sqW / 2,
      top: y - 4,
      transform: 'translateX(-50%)',
    };
  } else if (overlay.position) {
    style = { ...style, left: overlay.position.x, top: overlay.position.y };
  }

  return (
    <div className={overlay.className} style={style}>
      <span
        style={{
          background: 'rgba(0,0,0,0.75)',
          color: '#fff',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}
      >
        {overlay.text}
      </span>
    </div>
  );
});
