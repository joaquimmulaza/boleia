import React, { useEffect, useId, useRef } from 'react';
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
 *   dialogLabelledBy?: string,
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
  dialogLabelledBy,
}) {
  const isBottom = variant === 'bottom';
  const overlayId = useId();
  const onDismissRef = useRef(onDismiss);
  const dragEnabled = isBottom && Boolean(onDismiss) && !dismissDisabled;
  const { panelRef, backdropRef } = useSheetDrag({ enabled: dragEnabled, onDismiss });

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const handleOverlayClick = () => {
    if (dismissDisabled || !onDismissRef.current) return;
    onDismissRef.current();
  };

  useEffect(() => {
    if (!onDismiss || dismissDisabled) return undefined;

    const dismissFromStack = () => {
      onDismissRef.current?.();
    };

    pushOverlay(overlayId, dismissFromStack);

    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      const top = getTopOverlay();
      if (top?.id !== overlayId) return;
      e.preventDefault();
      e.stopPropagation();
      onDismissRef.current?.();
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      popOverlay(overlayId);
    };
  }, [onDismiss, dismissDisabled, overlayId]);

  const panelInner = (
    <div
      ref={panelRef}
      data-testid={panelTestId}
      data-geocoder-sheet-boundary
      className={`relative w-full max-w-md mx-auto max-h-[90dvh] overflow-y-auto overscroll-y-contain touch-pan-y rounded-[34px] ${panelClassName}`}
    >
      <div className="pb-sheet">{children}</div>
    </div>
  );

  return (
    <ModalPortal>
      <div
        data-testid={testId}
        className={`fixed inset-0 z-modal flex ${
          isBottom
            ? 'flex-col justify-end px-3 pb-[var(--sheet-bottom-inset)] sm:p-4'
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
          dialogLabelledBy ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={dialogLabelledBy}
              className="relative w-full max-w-md mx-auto pointer-events-none"
            >
              <div
                data-geocoder-sheet-portal
                data-testid="geocoder-sheet-portal"
                className="pointer-events-none [&_[data-geocoder-floating-list]]:pointer-events-auto"
              />
              <div className="pointer-events-auto">{panelInner}</div>
            </div>
          ) : (
            panelInner
          )
        ) : (
          <div className={`relative w-full max-w-md ${panelClassName}`}>{children}</div>
        )}
      </div>
    </ModalPortal>
  );
}

export default OverlayShell;
