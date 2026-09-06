import React, { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { formatKwanza } from '../utils/formatKwanza';
import { labelEstadoPagamento } from '../utils/paymentStatus';
import { getPlatformIban, uploadComprovativo } from '../services/PaymentService';
import FeedbackAlert from './FeedbackAlert';

/**
 * Bloco de pagamento mensal (passageiro) — IBAN plataforma + comprovativo.
 *
 * @param {{
 *   pagamento: {
 *     id: string,
 *     valor_kz: number,
 *     valor_payout_liquido_kz?: number,
 *     estado: string,
 *     rejeicao_motivo?: string | null,
 *   } | null,
 *   onUpdated?: () => void,
 * }} props
 */
function AcordoPagamentoPanel({ pagamento, onUpdated }) {
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(/** @type {{ type: 'success' | 'error', text: string } | null} */ (null));

  if (!pagamento) {
    return (
      <p className="text-sm text-slate-500" data-testid="pagamento-ausente">
        Pagamento ainda não disponível para este acordo.
      </p>
    );
  }

  const platformIban = getPlatformIban();
  const podeEnviar = ['pendente_pagamento', 'comprovativo_enviado'].includes(
    String(pagamento.estado || '').toLowerCase(),
  );

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setFeedback(null);
    try {
      await uploadComprovativo(pagamento.id, file);
      setFeedback({ type: 'success', text: 'Comprovativo enviado. Aguarda validação.' });
      onUpdated?.();
    } catch (error) {
      console.error('Erro ao enviar comprovativo:', error);
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível enviar o comprovativo.',
      });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <section
      className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
      data-testid="acordo-pagamento-panel"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Pagamento mensal</h3>
        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          {labelEstadoPagamento(pagamento.estado)}
        </span>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-300">
        Valor acordado:{' '}
        <strong className="tabular-nums text-slate-900 dark:text-white">
          {formatKwanza(pagamento.valor_kz)} Kz
        </strong>
      </p>

      {platformIban ? (
        <p className="text-xs text-slate-500 text-pretty">
          IBAN da plataforma:{' '}
          <span className="font-mono text-slate-700 dark:text-slate-200">{platformIban}</span>
        </p>
      ) : (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          IBAN da plataforma não configurado (VITE_PLATFORM_IBAN).
        </p>
      )}

      {pagamento.rejeicao_motivo ? (
        <FeedbackAlert type="error" message={`Comprovativo rejeitado: ${pagamento.rejeicao_motivo}`} />
      ) : null}

      {feedback ? <FeedbackAlert type={feedback.type} message={feedback.text} /> : null}

      {podeEnviar ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="sr-only"
            data-testid="comprovativo-input"
            onChange={handleFile}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="w-full min-h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white font-semibold disabled:opacity-60"
          >
            {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Upload size={18} aria-hidden="true" />}
            Enviar comprovativo
          </button>
        </>
      ) : null}
    </section>
  );
}

export default AcordoPagamentoPanel;
