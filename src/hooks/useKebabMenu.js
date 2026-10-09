import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { popOverlay, pushOverlay } from '../utils/overlayStack';

/**
 * Comportamento partilhado dos menus «Mais acções».
 * @returns {{
 *   open: boolean,
 *   close: (options?: { returnFocus?: boolean }) => void,
 *   toggle: (event?: React.SyntheticEvent) => void,
 *   rootRef: React.RefObject<HTMLDivElement | null>,
 *   triggerRef: React.RefObject<HTMLButtonElement | null>,
 *   menuId: string,
 *   triggerAria: {
 *     'aria-haspopup': 'menu',
 *     'aria-expanded': boolean,
 *     'aria-controls': string,
 *   },
 *   menuProps: {
 *     id: string,
 *     role: 'menu',
 *   },
 * }}
 */
export function useKebabMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const triggerRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const wasOpenRef = useRef(false);
  const returnFocusOnCloseRef = useRef(true);
  const menuId = useId();
  const overlayId = useId();

  /** @param {{ returnFocus?: boolean }} [options] */
  const close = useCallback((options = {}) => {
    if (options.returnFocus === false) {
      returnFocusOnCloseRef.current = false;
    }
    setOpen(false);
  }, []);

  const toggle = useCallback((event) => {
    event?.stopPropagation?.();
    setOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!open) {
      popOverlay(overlayId);
      if (wasOpenRef.current && returnFocusOnCloseRef.current) {
        triggerRef.current?.focus();
      }
      returnFocusOnCloseRef.current = true;
      wasOpenRef.current = false;
      return undefined;
    }

    wasOpenRef.current = true;
    pushOverlay(overlayId, close);

    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        close();
      }
    };

    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
      popOverlay(overlayId);
    };
  }, [open, close, overlayId]);

  return {
    open,
    close,
    toggle,
    rootRef,
    triggerRef,
    menuId,
    triggerAria: {
      'aria-haspopup': 'menu',
      'aria-expanded': open,
      'aria-controls': menuId,
    },
    menuProps: {
      id: menuId,
      role: 'menu',
    },
  };
}
