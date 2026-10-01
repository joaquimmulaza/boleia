import React, { useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from './ui/button';

/**
 * Kebab por linha de notificação — só Apagar, sem confirm.
 * @param {{ onDelete: () => void }} props
 */
export default function NotificationRowKebab({ onDelete }) {
  const menuId = useId();
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [open, setOpen] = useState(false);

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

  return (
    <div ref={rootRef} className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Mais acções da notificação"
        data-testid="notification-row-kebab-trigger"
        onClick={() => setOpen((prev) => !prev)}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </Button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          data-testid="notification-row-kebab-menu"
          className="absolute right-0 top-full z-10 mt-1 min-w-[9rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
            onClick={() => {
              setOpen(false);
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
