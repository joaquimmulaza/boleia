import React from 'react';
import ModalPortal from './ModalPortal';

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

  const handleOverlayClick = () => {
    if (dismissDisabled || !onDismiss) return;
    onDismiss();
  };

  return (
    <ModalPortal>
      <div
        data-testid={testId}
        className={`fixed inset-0 z-modal flex ${
          isBottom ? 'flex-col justify-end' : 'items-end sm:items-center justify-center'
        } p-4 ${isBottom ? 'p-0 sm:p-4' : ''}`}
      >
        <div
          className={`fixed inset-0 ${overlayClassName}`}
          aria-hidden="true"
          onClick={handleOverlayClick}
        />

        {isBottom ? (
          <div
            data-testid={panelTestId}
            className={`relative w-full max-w-md mx-auto max-h-[90dvh] overflow-y-auto rounded-t-xl sm:rounded-2xl pb-safe ${panelClassName}`}
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
