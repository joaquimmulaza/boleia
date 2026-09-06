import React from 'react';

/**
 * Modal de confirmação (acções destrutivas / irreversíveis).
 * @param {{
 *   isOpen: boolean,
 *   title: string,
 *   message: string,
 *   onConfirm: () => void,
 *   onCancel: () => void,
 *   confirmText?: string,
 *   cancelText?: string,
 *   busy?: boolean,
 *   variant?: 'destructive' | 'primary',
 *   testId?: string,
 * }} props
 */
const ConfirmationModal = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirmar',
  cancelText = 'Voltar',
  busy = false,
  variant = 'destructive',
  testId,
}) => {
  if (!isOpen) return null;

  const handleOverlayClick = () => {
    if (busy) return;
    onCancel();
  };

  const confirmClass =
    variant === 'primary'
      ? 'w-full py-3.5 px-4 bg-primary hover:bg-primary/90 active:bg-primary/80 text-white font-bold rounded-2xl transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none'
      : 'w-full py-3.5 px-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold rounded-2xl transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none';

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      {/* Overlay - now pure black with high opacity for stronger emphasis */}
      <div
        className="fixed inset-0 bg-black/80"
        aria-hidden="true"
        onClick={handleOverlayClick}
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        data-testid={testId}
        className="relative bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl scale-100 animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="px-6 pt-8 pb-6 text-center">
          <h3 id="modal-title" className="text-xl font-bold text-slate-900 dark:text-white mb-3">
            {title}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-base leading-relaxed">
            {message}
          </p>
        </div>

        {/* Actions - Vertical layout typical of modern mobile apps */}
        <div className="flex flex-col gap-2 p-4 pt-0">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={confirmClass}
          >
            {confirmText}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="w-full py-3.5 px-4 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:active:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-2xl transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
