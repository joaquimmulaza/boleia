import React, { useState } from 'react';

/**
 * Modal para motivo opcional ao rejeitar comprovativo (admin).
 * @param {{
 *   isOpen: boolean,
 *   busy?: boolean,
 *   onConfirm: (motivo: string | null) => void,
 *   onCancel: () => void,
 * }} props
 */
function RejeicaoComprovativoModal({ isOpen, busy = false, onConfirm, onCancel }) {
  const [motivo, setMotivo] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = motivo.trim();
    onConfirm(trimmed || null);
  };

  return (
    <div className="fixed inset-0 z-modal flex items-end sm:items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/80"
        aria-hidden="true"
        onClick={() => {
          if (!busy) onCancel();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rejeicao-comprovativo-title"
        data-testid="rejeicao-comprovativo-modal"
        className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <h3
            id="rejeicao-comprovativo-title"
            className="text-xl font-bold text-slate-900 dark:text-white"
          >
            Rejeitar comprovativo
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-pretty">
            Indica um motivo opcional para o passageiro (ex.: valor incorrecto, imagem ilegível).
          </p>
          <div className="space-y-2">
            <label htmlFor="rejeicao-motivo" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Motivo (opcional)
            </label>
            <textarea
              id="rejeicao-motivo"
              data-testid="rejeicao-motivo-input"
              className="w-full min-h-[100px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-sm resize-none outline-none focus:ring-2 focus:ring-primary"
              placeholder="Ex.: Valor transferido não corresponde ao acordado."
              value={motivo}
              disabled={busy}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-12 rounded-2xl bg-red-600 text-white font-bold disabled:opacity-60"
            >
              Confirmar rejeição
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="w-full min-h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold disabled:opacity-60"
            >
              Voltar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RejeicaoComprovativoModal;
