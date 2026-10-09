import { useEffect } from 'react';
import { handleFocusTrapTabKey } from '../utils/focusTrap';

/**
 * Armadilha de foco mínima para dialogs (Tab/Shift+Tab + foco inicial).
 * @param {{
 *   containerRef: import('react').RefObject<HTMLElement | null>,
 *   active: boolean,
 *   initialFocusRef?: import('react').RefObject<HTMLElement | null>,
 * }} options
 */
export function useDialogFocusTrap({ containerRef, active, initialFocusRef }) {
  useEffect(() => {
    if (!active) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;

    const focusInitial = () => {
      const target = initialFocusRef?.current
        ?? container.querySelector('[data-testid="acordo-detalhe-fechar"]');
      if (target instanceof HTMLElement) {
        target.focus();
      }
    };

    const raf = requestAnimationFrame(focusInitial);

    const onKeyDown = (event) => {
      if (!containerRef.current) return;
      handleFocusTrapTabKey(event, containerRef.current);
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [active, containerRef, initialFocusRef]);
}
