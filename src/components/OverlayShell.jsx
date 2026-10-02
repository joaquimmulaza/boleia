import React, { useEffect, useId } from 'react';
import ModalPortal from './ModalPortal';
import { useSheetDrag } from '../hooks/useSheetDrag';
import { getTopOverlay, popOverlay, pushOverlay } from '../utils/overlayStack';

/**
 * Overlay full-screen acima da bottom nav (portal + z-modal).
 * @param {{
 *   children: import('react').ReactNode,
 *   variant?: 'center' | 'bottom',
 *   onDismiss?: () => void,
 *   dismissDisabled?: boolean,
 *   overlayClassName?: string,
 *   panelClassName?: string,
 *   testId?: string,
 *   panelTestId?: string,
 * }} props
 */
function OverlayShell({
  children,
  variant = 'center',
  onDismiss,
  dismissDisabled = false,
  overlayClassName = 'bg-black/80',
  panelClassName = '',
  testId,
  panelTestId,
}) {
  const isBottom = variant === 'bottom';
  const overlayId = useId();
  const dragEnabled = isBottom && Boolean(onDismiss) && !dismissDisabled;
  const { panelRef, backdropRef } = useSheetDrag({ enabled: dragEnabled, onDismiss });

  const handleOverlayClick = () => {
    if (dismissDisabled || !onDismiss) return;
    onDismiss();
  };

  useEffect(() => {
    if (!onDismiss || dismissDisabled) return undefined;

    pushOverlay(overlayId, onDismiss);

    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      const top = getTopOverlay();
      if (top?.id !== overlayId) return;
      e.preventDefault();
      onDismiss();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      popOverlay(overlayId);
    };
  }, [onDismiss, dismissDisabled, overlayId]);

  return (
    <ModalPortal>
      <div
        data-testid={testId}
        className={`fixed inset-0 z-modal flex ${
          isBottom
            ? 'flex-col justify-end px-2 pb-[var(--sheet-bottom-inset)] sm:p-4'
            : 'items-end sm:items-center justify-center p-4'
        }`}
      >
        <div
          ref={backdropRef}
          className={`fixed inset-0 ${overlayClassName}`}
          aria-hidden="true"
          onClick={handleOverlayClick}
        />

        {isBottom ? (
          <div
            ref={panelRef}
            data-testid={panelTestId}
            className={`relative w-full max-w-md mx-auto max-h-[90dvh] overflow-y-auto overscroll-y-contain touch-pan-y rounded-t-[20px] rounded-b-[20px] pb-safe ${panelClassName}`}
          >
            {children}
          </div>
        ) : (
          <div className={`relative w-full max-w-md ${panelClassName}`}>{children}</div>
        )}
      </div>
    </ModalPortal>
  );
}

export default OverlayShell;
