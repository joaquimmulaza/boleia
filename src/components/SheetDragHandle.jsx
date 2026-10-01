import React from 'react';

/**
 * Indicador visual no topo dos bottom sheets.
 * O arrastar para fechar é do OverlayShell (`variant="bottom"`), para o painel
 * seguir o dedo. `onDismiss` mantém-se na API para não partir chamadas antigas.
 * @param {{ onDismiss?: () => void, className?: string }} props
 */
export default function SheetDragHandle({ className = '', onDismiss: _onDismiss }) {
  return (
    <div
      data-testid="sheet-drag-handle"
      className={`flex justify-center pt-3 pb-1 touch-none ${className}`.trim()}
      aria-hidden="true"
    >
      <span className="block h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
    </div>
  );
}
