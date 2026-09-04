import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import { formatKwanza } from '../utils/formatKwanza';

/**
 * @typedef {{
 *   passenger_id: string,
 *   nome: string,
 *   telefone?: string | null,
 *   pickup_name?: string | null,
 *   quota_mensal_kz?: number | null,
 *   ordem_insercao?: number,
 * }} PropostaReviewMembro
 */

/**
 * @typedef {{
 *   valor_mensal_total_kz: number,
 *   valor_mensal_por_passageiro_kz: number,
 *   quotas?: number[],
 *   temResto?: boolean,
 * }} PropostaReviewPricing
 */

/**
 * @typedef {{
 *   proposta: {
 *     id: string,
 *     modo_preco: string,
 *     valor_mensal_ask_kz?: number,
 *     n_passageiros_propostos?: number,
 *     grupo_id?: string | null,
 *     [key: string]: unknown,
 *   },
 *   membros: PropostaReviewMembro[],
 *   pricing: PropostaReviewPricing,
 *   titulo: string,
 *   avisoComposicao?: string | null,
 * }} PropostaReview
 */

/**
 * Card de revisão de proposta multi-passageiro (hub motorista).
 *
 * @param {{
 *   review: PropostaReview,
 *   busy?: boolean,
 *   onAceitar: () => void,
 *   onRecusar: () => void,
 * }} props
 */
function PropostaReviewCard({ review, busy = false, onAceitar, onRecusar }) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const modoLabel =
    review.proposta.modo_preco === 'TOTAL_ACORDO' ? 'Total do acordo' : 'Por passageiro';
  const { pricing, membros, titulo, avisoComposicao } = review;

  return (
    <section className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
      <h3 className="text-base font-bold text-slate-900 dark:text-white text-balance">
        {titulo}
      </h3>

      <ul className="space-y-3">
        {membros.map((m, index) => (
          <li key={m.passenger_id || `membro-${index}`} className="flex items-start gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300"
              aria-hidden="true"
            >
              {(m.nome || '?').slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {m.nome}
              </p>
              {m.pickup_name ? (
                <p className="flex items-start gap-1 text-xs text-slate-500 text-pretty">
                  <MapPin size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{m.pickup_name}</span>
                </p>
              ) : null}
              {pricing.temResto && m.quota_mensal_kz != null ? (
                <p className="text-xs text-slate-400 tabular-nums">
                  {formatKwanza(m.quota_mensal_kz)} Kz
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-1.5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {modoLabel}
        </p>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-slate-600 dark:text-slate-300">Total</span>
          <strong className="text-primary tabular-nums text-base">
            {formatKwanza(pricing.valor_mensal_total_kz)} Kz
          </strong>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-slate-600 dark:text-slate-300">Por passageiro</span>
          <span className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
            {formatKwanza(pricing.valor_mensal_por_passageiro_kz)} Kz / pessoa
          </span>
        </div>
        {pricing.temResto ? (
          <p className="text-xs text-slate-500 text-pretty pt-1">
            Alguns passageiros pagam {formatKwanza(pricing.valor_mensal_por_passageiro_kz + 1)} Kz e
            outros {formatKwanza(pricing.valor_mensal_por_passageiro_kz)} Kz para o total fechar
            exacto.
          </p>
        ) : null}
      </div>

      {avisoComposicao ? (
        <p className="text-xs text-amber-700 dark:text-amber-400 text-pretty">{avisoComposicao}</p>
      ) : null}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirmOpen(true)}
          className="flex-1 bg-primary text-white font-bold py-3 rounded-xl disabled:opacity-60"
        >
          Aceitar proposta
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onRecusar}
          className="flex-1 bg-slate-100 dark:bg-slate-800 font-bold py-3 rounded-xl disabled:opacity-60"
        >
          Recusar
        </button>
      </div>

      <ConfirmationModal
        isOpen={confirmOpen}
        title="Aceitar esta proposta?"
        message="Vais criar um acordo com estes passageiros. Esta acção não se pode desfazer."
        confirmText="Confirmar"
        cancelText="Voltar"
        onConfirm={() => {
          setConfirmOpen(false);
          onAceitar();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  );
}

export default PropostaReviewCard;
