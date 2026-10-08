import React from 'react';
import { Clock, CircleX, MoreHorizontal } from 'lucide-react';
import { Button } from './ui/button';
import { useKebabMenu } from '../hooks/useKebabMenu';

/**
 * Kebab do detalhe do acordo — só Registar falta + Encerrar acordo.
 * @param {{
 *   podeRegistarFaltas: boolean,
 *   podeEncerrar: boolean,
 *   onRegistarFalta: () => void,
 *   onEncerrar: () => void,
 * }} props
 */
export default function AcordoDetalheKebabMenu({
  podeRegistarFaltas,
  podeEncerrar,
  onRegistarFalta,
  onEncerrar,
}) {
  const { open, close, toggle, rootRef, triggerRef, triggerAria, menuProps } = useKebabMenu();
  const hasActions = podeRegistarFaltas || podeEncerrar;

  if (!hasActions) return null;

  const fecharE = (fn) => {
    close();
    fn();
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <Button
        type="button"
        ref={triggerRef}
        {...triggerAria}
        onClick={toggle}
        variant="outline"
        size="icon"
        className="h-10 w-10 rounded-full border-slate-200 dark:border-slate-700"
        aria-label="Mais acções do acordo"
        data-testid="acordo-detalhe-kebab-trigger"
      >
        <MoreHorizontal size={20} aria-hidden="true" />
      </Button>

      {open ? (
        <div
          {...menuProps}
          data-testid="acordo-detalhe-kebab-menu"
          className="absolute right-0 top-full z-10 mt-2 min-w-[12.5rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {podeRegistarFaltas ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50 dark:text-white dark:hover:bg-slate-800"
              onClick={() => fecharE(onRegistarFalta)}
            >
              <Clock size={18} aria-hidden="true" className="shrink-0 text-slate-600 dark:text-slate-300" />
              Registar falta
            </button>
          ) : null}
          {podeEncerrar ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
              onClick={() => fecharE(onEncerrar)}
            >
              <CircleX size={18} aria-hidden="true" className="shrink-0" />
              Encerrar acordo
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
