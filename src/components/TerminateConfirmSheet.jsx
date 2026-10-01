import React, { useEffect } from 'react';
import OverlayShell from './OverlayShell';
import SheetDragHandle from './SheetDragHandle';
import { Button } from './ui/button';

/**
 * Bottom sheet de confirmação de encerramento (Figma E4).
 * @param {{
 *   isOpen: boolean,
 *   title: string,
 *   body: React.ReactNode,
 *   confirmText?: string,
 *   cancelText?: string,
 *   busy?: boolean,
 *   onConfirm: () => void,
 *   onCancel: () => void,
 * }} props
 */
export default function TerminateConfirmSheet({
  isOpen,
  title,
  body,
  confirmText = 'Encerrar acordo',
  cancelText = 'Cancelar',
  busy = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!isOpen || busy) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, busy, onCancel]);

  if (!isOpen) return null;

  return (
    <OverlayShell
      variant="bottom"
      onDismiss={busy ? undefined : onCancel}
      dismissDisabled={busy}
      panelTestId="terminate-confirm-sheet"
      panelClassName="bg-white dark:bg-slate-900 shadow-2xl"
    >
      <SheetDragHandle />

      <div className="px-5 pb-safe">
        <div className="flex items-center justify-end mb-2">
          <Button
            type="button"
            variant="ghost"
            className="h-10 px-3 font-bold text-slate-600 dark:text-slate-300"
            disabled={busy}
            onClick={onCancel}
          >
            Fechar
          </Button>
        </div>

        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="terminate-confirm-title"
          className="space-y-4 pb-4"
        >
          <h3 id="terminate-confirm-title" className="text-lg font-bold text-slate-900 dark:text-white text-balance">
            {title}
          </h3>
          <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed text-pretty space-y-3">
            {body}
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="w-full min-h-11 rounded-xl font-bold text-slate-700 dark:text-slate-200"
              disabled={busy}
              onClick={onCancel}
            >
              {cancelText}
            </Button>
            <Button
              type="button"
              className="w-full min-h-11 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white"
              disabled={busy}
              data-testid="terminate-confirm-submit"
              onClick={onConfirm}
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </OverlayShell>
  );
}
