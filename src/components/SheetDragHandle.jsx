import React from 'react';

/**
 * Handle cinzento no topo de bottom sheets (padrão global).
 * @param {{ className?: string }} props
 */
export default function SheetDragHandle({ className = '' }) {
  return (
    <div
      data-testid="sheet-drag-handle"
      className={`flex justify-center pt-3 pb-1 ${className}`}
      aria-hidden="true"
    >
      <span className="block h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
    </div>
  );
}
