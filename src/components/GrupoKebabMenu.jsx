import React from 'react';
import { LogOut, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useKebabMenu } from '../hooks/useKebabMenu';

/**
 * Kebab do grupo — só as acções que o papel permite.
 * @param {{
 *   canEditar: boolean,
 *   canApagar: boolean,
 *   canSair: boolean,
 *   onEditar: () => void,
 *   onApagar: () => void,
 *   onSair: () => void,
 *   disabled?: boolean,
 * }} props
 */
function GrupoKebabMenu({
  canEditar,
  canApagar,
  canSair,
  onEditar,
  onApagar,
  onSair,
  disabled = false,
}) {
  const { open, close, toggle, rootRef, triggerRef, triggerAria, menuProps } = useKebabMenu();

  if (!canEditar && !canApagar && !canSair) return null;

  const fecharE = (action) => {
    close();
    action();
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        ref={triggerRef}
        {...triggerAria}
        onClick={toggle}
        aria-label="Mais acções do grupo"
        disabled={disabled}
        data-testid="grupo-kebab-trigger"
        className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <MoreHorizontal size={20} aria-hidden="true" />
      </button>

      {open ? (
        <div
          {...menuProps}
          data-testid="grupo-kebab-menu"
          className="absolute right-0 top-full z-10 mt-1 min-w-[13.5rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          onClick={(event) => event.stopPropagation()}
        >
          {canEditar ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-slate-900 hover:bg-slate-50 dark:text-white dark:hover:bg-slate-800"
              onClick={() => fecharE(onEditar)}
            >
              <Pencil size={16} aria-hidden="true" />
              Editar
            </button>
          ) : null}
          {canSair ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-slate-900 hover:bg-slate-50 dark:text-white dark:hover:bg-slate-800"
              onClick={() => fecharE(onSair)}
            >
              <LogOut size={16} aria-hidden="true" />
              Sair do grupo
            </button>
          ) : null}
          {canApagar ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
              onClick={() => fecharE(onApagar)}
            >
              <Trash2 size={16} aria-hidden="true" />
              Apagar grupo
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default GrupoKebabMenu;
