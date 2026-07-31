import { useEffect, useRef } from 'react';

interface UseKeyboardOptions {
  onPrevious?: () => void;
  onNext?: () => void;
  onFirst?: () => void;
  onLast?: () => void;
  onFlipBoard?: () => void;
  onShowThreat?: () => void;
  onDeselect?: () => void;
}

export function useKeyboard(opts: UseKeyboardOptions) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          e.stopPropagation();
          optsRef.current.onPrevious?.();
          break;
        case 'ArrowRight':
          e.preventDefault();
          e.stopPropagation();
          optsRef.current.onNext?.();
          break;
        case 'ArrowUp':
        case 'Home':
          e.preventDefault();
          e.stopPropagation();
          optsRef.current.onFirst?.();
          break;
        case 'ArrowDown':
        case 'End':
          e.preventDefault();
          e.stopPropagation();
          optsRef.current.onLast?.();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          optsRef.current.onFlipBoard?.();
          break;
        case 'x':
        case 'X':
          e.preventDefault();
          optsRef.current.onShowThreat?.();
          break;
        case 'Escape':
          e.preventDefault();
          optsRef.current.onDeselect?.();
          break;
      }
    };

    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, []);
}
