import { useEffect } from 'react';

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
          opts.onPrevious?.();
          break;
        case 'ArrowRight':
          e.preventDefault();
          e.stopPropagation();
          opts.onNext?.();
          break;
        case 'ArrowUp':
        case 'Home':
          e.preventDefault();
          e.stopPropagation();
          opts.onFirst?.();
          break;
        case 'ArrowDown':
        case 'End':
          e.preventDefault();
          e.stopPropagation();
          opts.onLast?.();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          opts.onFlipBoard?.();
          break;
        case 'x':
        case 'X':
          e.preventDefault();
          opts.onShowThreat?.();
          break;
        case 'Escape':
          e.preventDefault();
          opts.onDeselect?.();
          break;
      }
    };

    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [opts.onPrevious, opts.onNext, opts.onFirst, opts.onLast, opts.onFlipBoard, opts.onShowThreat, opts.onDeselect]);
}
