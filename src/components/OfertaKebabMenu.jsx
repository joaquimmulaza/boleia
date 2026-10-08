import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { useKebabMenu } from '../hooks/useKebabMenu';

/**
 * Kebab motorista oferta — só Editar / Despublicar (Figma B3 / KebabCard).
 * @param {{
 *   canEdit: boolean,
 *   canDespublicar: boolean,
 *   onEditar: () => void,
 *   onDespublicar: () => void,
 *   disabled?: boolean,
 * }} props
 */
function OfertaKebabMenu({
  canEdit,
  canDespublicar,
  onEditar,
  onDespublicar,
  disabled = false,
}) {
  const { open, close, toggle, rootRef, triggerRef, triggerAria, menuProps } = useKebabMenu();

  if (!canEdit && !canDespublicar) return null;

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
        aria-label="Mais acções"
        disabled={disabled}
        className="rounded-lg p-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <MoreHorizontal size={20} aria-hidden="true" />
      </button>

      {open ? (
        <div
          {...menuProps}
          className="absolute right-0 top-full z-10 mt-1 min-w-[11rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          onClick={(e) => e.stopPropagation()}
        >
          {canEdit ? (
            <button
              type="button"
              role="menuitem"
              className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
              onClick={() => fecharE(onEditar)}
            >
              Editar oferta
            </button>
          ) : null}
          {canDespublicar ? (
            <>
              {canEdit ? <div className="my-1 border-t border-slate-100 dark:border-slate-800" /> : null}
              <button
                type="button"
                role="menuitem"
                className="w-full px-4 py-2.5 text-left text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={() => fecharE(onDespublicar)}
              >
                Despublicar oferta
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default OfertaKebabMenu;
