import React from 'react';
import { LogOut, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { useKebabMenu } from '../hooks/useKebabMenu';

/**
 * Acções do grupo — kebab com 2+ itens; botão directo quando só há uma.
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

  const accoes = [
    canEditar
      ? { key: 'editar', label: 'Editar', icon: Pencil, onClick: onEditar, destructive: false }
      : null,
    canSair
      ? { key: 'sair', label: 'Sair do grupo', icon: LogOut, onClick: onSair, destructive: false }
      : null,
    canApagar
      ? {
          key: 'apagar',
          label: 'Apagar grupo',
          icon: Trash2,
          onClick: onApagar,
          destructive: true,
        }
      : null,
  ].filter(Boolean);

  if (accoes.length === 0) return null;

  if (accoes.length === 1) {
    const unica = accoes[0];
    const Icon = unica.icon;
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        aria-label={unica.label}
        data-testid={`grupo-acao-directa-${unica.key}`}
        className={`h-9 gap-1.5 px-2 font-semibold ${
          unica.destructive
            ? 'text-red-600 hover:text-red-700 dark:text-red-400'
            : 'text-slate-700 dark:text-slate-200'
        }`}
        onClick={unica.onClick}
      >
        <Icon size={16} aria-hidden="true" />
        {unica.label}
      </Button>
    );
  }

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
        className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
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
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-slate-900 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:text-white dark:hover:bg-slate-800 dark:focus:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
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
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-slate-900 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:text-white dark:hover:bg-slate-800 dark:focus:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
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
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50 focus:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:text-red-400 dark:hover:bg-red-950/30 dark:focus:bg-red-950/30 dark:focus-visible:ring-offset-slate-900"
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
