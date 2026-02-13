import type { Square, Piece, ScreenPos } from '../types';
import { screenPos2square } from '../utils/coords';

export type { ScreenPos };

export interface DragState {
  origSquare: Square;
  piece: Piece;
  startPos: ScreenPos;
  currentPos: ScreenPos;
  started: boolean; // true once moved past threshold
}

export interface PointerState {
  drag: DragState | null;
  arrowStart: Square | null; // right-click arrow draw start
}

const DRAG_THRESHOLD = 4; // pixels before drag activates

export function getSquareFromEvent(
  e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent,
  asWhite: boolean,
  boardBounds: DOMRect,
): Square | undefined {
  let clientX: number;
  let clientY: number;

  if ('touches' in e && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else if ('changedTouches' in e && e.changedTouches.length > 0) {
    clientX = e.changedTouches[0].clientX;
    clientY = e.changedTouches[0].clientY;
  } else if ('clientX' in e) {
    clientX = e.clientX;
    clientY = e.clientY;
  } else {
    return undefined;
  }

  return screenPos2square(clientX, clientY, asWhite, boardBounds);
}

export function getClientPos(
  e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent,
): ScreenPos | undefined {
  if ('touches' in e && e.touches.length > 0) {
    return [e.touches[0].clientX, e.touches[0].clientY];
  }
  if ('changedTouches' in e && e.changedTouches.length > 0) {
    return [e.changedTouches[0].clientX, e.changedTouches[0].clientY];
  }
  if ('clientX' in e) {
    return [e.clientX, e.clientY];
  }
  return undefined;
}

export function isRightButton(e: MouseEvent | React.MouseEvent): boolean {
  return e.button === 2;
}

export function distanceBetween(a: ScreenPos, b: ScreenPos): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
}

export function hasDragStarted(drag: DragState): boolean {
  return distanceBetween(drag.startPos, drag.currentPos) >= DRAG_THRESHOLD;
}
