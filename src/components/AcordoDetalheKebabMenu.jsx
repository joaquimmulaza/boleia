import React, { useEffect, useId, useRef, useState } from 'react';
import { Clock, CircleX, MoreHorizontal } from 'lucide-react';
import { Button } from './ui/button';

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
  const menuId = useId();
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [open, setOpen] = useState(false);
  const hasActions = podeRegistarFaltas || podeEncerrar;

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!hasActions) return null;

  const closeAnd = (fn) => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-10 w-10 rounded-full border-slate-200 dark:border-slate-700"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Mais acções do acordo"
        data-testid="acordo-detalhe-kebab-trigger"
        onClick={() => setOpen((prev) => !prev)}
      >
        <MoreHorizontal size={20} aria-hidden="true" />
      </Button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          data-testid="acordo-detalhe-kebab-menu"
          className="absolute right-0 top-full z-10 mt-2 min-w-[12.5rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {podeRegistarFaltas ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50 dark:text-white dark:hover:bg-slate-800"
              onClick={() => closeAnd(onRegistarFalta)}
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
              onClick={() => closeAnd(onEncerrar)}
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
