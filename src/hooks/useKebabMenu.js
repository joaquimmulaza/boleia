import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { getFocusableElements } from '../utils/focusTrap';
import { popOverlay, pushOverlay } from '../utils/overlayStack';

/**
 * @param {HTMLElement | null} root
 * @returns {HTMLElement[]}
 */
function getMenuItems(root) {
  if (!root) return [];
  return Array.from(root.querySelectorAll('[role="menuitem"]')).filter(
    (el) => el instanceof HTMLElement && !el.hasAttribute('disabled'),
  );
}

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

    const focusFirstItem = () => {
      const items = getMenuItems(rootRef.current);
      if (items.length === 0) return;
      const active = document.activeElement;
      const inMenu =
        active instanceof HTMLElement
        && rootRef.current?.contains(active)
        && active !== triggerRef.current;
      if (inMenu) return;
      items[0]?.focus();
    };
    const raf = requestAnimationFrame(focusFirstItem);

    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        close();
      }
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }

      if (event.key === 'Tab') {
        const trigger = triggerRef.current;
        if (!(trigger instanceof HTMLElement)) return;

        const focusables = getFocusableElements(document.body).filter((el) => {
          if (el === trigger) return true;
          if (rootRef.current?.contains(el)) return false;
          return true;
        });
        const triggerIndex = focusables.indexOf(trigger);
        if (triggerIndex === -1) return;

        event.preventDefault();
        close({ returnFocus: false });
        const nextIndex = event.shiftKey ? triggerIndex - 1 : triggerIndex + 1;
        const next = focusables[nextIndex];
        next?.focus();
        return;
      }

      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

      const items = getMenuItems(rootRef.current);
      if (items.length === 0) return;

      event.preventDefault();
      const active = document.activeElement;
      let index = items.indexOf(/** @type {HTMLElement} */ (active));
      if (index === -1) index = 0;
      else if (event.key === 'ArrowDown') index = (index + 1) % items.length;
      else index = (index - 1 + items.length) % items.length;
      items[index]?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      cancelAnimationFrame(raf);
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
