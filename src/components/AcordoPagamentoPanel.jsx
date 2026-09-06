import React, { useRef, useState } from 'react';
import { Upload, Loader2, FileText } from 'lucide-react';
import { formatKwanza } from '../utils/formatKwanza';
import {
  labelEstadoPagamento,
  helpEstadoPagamento,
  chipClassEstadoPagamento,
} from '../utils/paymentStatus';
import { basenameComprovativoPath } from '../utils/comprovativoPath';
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
 *     comprovativo_path?: string | null,
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
  const ibanConfigurado = Boolean(platformIban);
  const podeEnviar = ['pendente_pagamento', 'comprovativo_enviado'].includes(
    String(pagamento.estado || '').toLowerCase(),
  );
  const comprovativoNome = basenameComprovativoPath(pagamento.comprovativo_path);
  const temComprovativo = Boolean(comprovativoNome);
  const labelUpload = temComprovativo ? 'Substituir comprovativo' : 'Enviar comprovativo';
  const helpEstado = helpEstadoPagamento(pagamento.estado);

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
        <span
          className={`text-xs font-semibold px-2 py-1 rounded-full ${chipClassEstadoPagamento(pagamento.estado)}`}
          title={helpEstado || undefined}
        >
          {labelEstadoPagamento(pagamento.estado)}
        </span>
      </div>

      {helpEstado ? (
        <p className="text-xs text-slate-500 text-pretty">{helpEstado}</p>
      ) : null}

      <p className="text-sm text-slate-600 dark:text-slate-300">
        Valor acordado:{' '}
        <strong className="tabular-nums text-slate-900 dark:text-white">
          {formatKwanza(pagamento.valor_kz)} Kz
        </strong>
      </p>

      {ibanConfigurado ? (
        <p className="text-xs text-slate-500 text-pretty">
          IBAN da plataforma:{' '}
          <span className="font-mono text-slate-700 dark:text-slate-200">{platformIban}</span>
        </p>
      ) : (
        <div
          className="rounded-xl border border-amber-200/80 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-900/40 p-3 space-y-1"
          data-testid="iban-nao-configurado"
        >
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            Transferência indisponível
          </p>
          <p className="text-xs text-amber-800/90 dark:text-amber-200/90 text-pretty">
            O IBAN da plataforma ainda não está configurado. Não é possível enviar comprovativo
            até a equipa activar o pagamento.
          </p>
        </div>
      )}

      {pagamento.rejeicao_motivo ? (
        <FeedbackAlert
          type="error"
          text={`Comprovativo rejeitado: ${pagamento.rejeicao_motivo}`}
        />
      ) : null}

      {feedback ? <FeedbackAlert type={feedback.type} text={feedback.text} /> : null}

      {temComprovativo ? (
        <div
          className="flex items-center gap-2 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-3 py-2"
          data-testid="comprovativo-preview"
        >
          <FileText size={16} className="text-primary shrink-0" aria-hidden="true" />
          <span className="text-xs text-slate-600 dark:text-slate-300 truncate">
            {comprovativoNome}
          </span>
        </div>
      ) : null}

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
            disabled={busy || !ibanConfigurado}
            onClick={() => inputRef.current?.click()}
            className="w-full min-h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? (
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            ) : (
              <Upload size={18} aria-hidden="true" />
            )}
            {labelUpload}
          </button>
        </>
      ) : null}
    </section>
  );
}

export default AcordoPagamentoPanel;
