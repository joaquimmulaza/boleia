import React from 'react';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { useKebabMenu } from '../hooks/useKebabMenu';

/**
 * Kebab por linha de notificação — só Apagar, sem confirm.
 * @param {{ onDelete: () => void }} props
 */
export default function NotificationRowKebab({ onDelete }) {
  const { open, close, toggle, rootRef, triggerRef, triggerAria, menuProps } = useKebabMenu();

  return (
    <div
      ref={rootRef}
      className="relative shrink-0"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation();
        }
      }}
    >
      <Button
        type="button"
        ref={triggerRef}
        {...triggerAria}
        onClick={toggle}
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        aria-label="Mais acções da notificação"
        data-testid="notification-row-kebab-trigger"
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </Button>

      {open ? (
        <div
          {...menuProps}
          data-testid="notification-row-kebab-menu"
          className="absolute right-0 top-full z-10 mt-1 min-w-[9rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50 focus:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:text-red-400 dark:hover:bg-red-950/30 dark:focus:bg-red-950/30 dark:focus-visible:ring-offset-slate-900"
            onClick={() => {
              close();
              onDelete();
            }}
          >
            <Trash2 size={16} aria-hidden="true" className="shrink-0" />
            Apagar
          </button>
        </div>
      ) : null}
    </div>
  );
}
