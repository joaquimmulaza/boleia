import React, { useRef } from 'react';

const DRAG_DISMISS_PX = 72;

/**
 * Handle cinzento no topo de bottom sheets (padrão global).
 * Com `onDismiss` opcional: drag-down fecha a sheet (Figma C2 / ProposalSheet).
 * @param {{ onDismiss?: () => void, className?: string }} props
 */
export default function SheetDragHandle({ onDismiss, className = '' }) {
  const startY = useRef(/** @type {number | null} */ (null));

  const reset = () => {
    startY.current = null;
  };

  return (
    <div
      data-testid="sheet-drag-handle"
      className={`flex justify-center pt-3 pb-1 touch-none ${className}`.trim()}
      aria-hidden="true"
      onPointerDown={(e) => {
        if (!onDismiss) return;
        startY.current = e.clientY;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (startY.current == null) return;
        const delta = e.clientY - startY.current;
        if (delta >= DRAG_DISMISS_PX) {
          e.currentTarget.releasePointerCapture(e.pointerId);
          reset();
          onDismiss();
        }
      }}
      onPointerUp={(e) => {
        if (startY.current == null) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        reset();
      }}
      onPointerCancel={reset}
    >
      <span className="block h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
    </div>
  );
}
