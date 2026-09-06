import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import PreferentialPointsMap from './PreferentialPointsMap';
import { formatKwanza } from '../utils/formatKwanza';
import { buildPreferentialMapPoints } from '../utils/propostaReview';
import { chipEstadoProposta } from '../utils/propostaEstado';

/**
 * @typedef {{
 *   passenger_id: string,
 *   nome: string,
 *   telefone?: string | null,
 *   pickup_name?: string | null,
 *   pickup_lat?: number | null,
 *   pickup_lng?: number | null,
 *   dropoff_name?: string | null,
 *   dropoff_lat?: number | null,
 *   dropoff_lng?: number | null,
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
 *   requiresMemberSelection?: boolean,
 * }} PropostaReview
 */

/**
 * Conta membros com pickup_lat + pickup_lng finitos (null/'' não contam).
 *
 * @param {PropostaReviewMembro[]} membros
 * @returns {number}
 */
function countMembrosComPickup(membros) {
  return membros.filter((m) => {
    if (m?.pickup_lat == null || m?.pickup_lng == null || m.pickup_lat === '' || m.pickup_lng === '') {
      return false;
    }
    const lat = Number(m.pickup_lat);
    const lng = Number(m.pickup_lng);
    return Number.isFinite(lat) && Number.isFinite(lng);
  }).length;
}

/**
 * Card de revisão de proposta multi-passageiro.
 * - `modo="contraparte"` (default): Aceitar / Recusar (inbox A ou B).
 * - `modo="criador"`: Cancelar proposta enviada (só criador; RPC cancel_proposal).
 * - `modo="historico"`: só leitura com chip de estado (rejeitada/cancelada).
 * - Se `requiresMemberSelection`, checkboxes até exactamente N seleccionados.
 *
 * @param {{
 *   review: PropostaReview,
 *   busy?: boolean,
 *   modo?: 'contraparte' | 'criador' | 'historico',
 *   secao?: 'recebidas' | 'enviadas',
 *   onAceitar?: (selectedMemberIds?: string[]) => void,
 *   onRecusar?: () => void,
 *   onCancelar?: () => void,
 * }} props
 */
function PropostaReviewCard({
  review,
  busy = false,
  modo = 'contraparte',
  secao = 'recebidas',
  onAceitar,
  onRecusar,
  onCancelar,
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(/** @type {string[]} */ ([]));
  const isCriador = modo === 'criador';
  const isHistorico = modo === 'historico';
  const estadoChip = chipEstadoProposta(review.proposta.estado, {
    secao: isCriador ? 'enviadas' : secao,
  });

  const modoLabel =
    review.proposta.modo_preco === 'TOTAL_ACORDO' ? 'Total do acordo' : 'Por passageiro';
  const { pricing, membros, titulo, avisoComposicao } = review;
  const nProposto = Number(review.proposta.n_passageiros_propostos) || 0;
  const needsPicker = Boolean(review.requiresMemberSelection) && !isCriador;
  const points = buildPreferentialMapPoints(
    needsPicker
      ? membros.filter((m) => selectedIds.includes(m.passenger_id))
      : membros,
  );
  const totalMembros = membros.length;
  const comPickup = countMembrosComPickup(membros);
  const mostraNotaParcial = totalMembros > 0 && comPickup > 0 && comPickup < totalMembros;
  const selectionOk = !needsPicker || selectedIds.length === nProposto;
  const canAceitar = Boolean(onAceitar) && selectionOk && !busy;

  /**
   * @param {string} passengerId
   */
  const toggleMember = (passengerId) => {
    if (!passengerId || busy) return;
    setSelectedIds((prev) => {
      if (prev.includes(passengerId)) {
        return prev.filter((id) => id !== passengerId);
      }
      if (prev.length >= nProposto) {
        return prev;
      }
      return [...prev, passengerId];
    });
  };

  return (
    <section className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-bold text-slate-900 dark:text-white text-balance min-w-0">
          {titulo}
        </h3>
        {estadoChip ? (
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${estadoChip.className}`}
            data-testid="proposta-estado-chip"
          >
            {estadoChip.label}
          </span>
        ) : null}
      </div>

      <div className="space-y-2">
        {totalMembros > 0 ? (
          <>
            <PreferentialPointsMap points={points} />
            {mostraNotaParcial ? (
              <p className="text-xs text-slate-500 text-pretty">
                {comPickup} de {totalMembros} com localização
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      {needsPicker ? (
        <fieldset className="space-y-3" data-testid="member-picker">
          <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100 text-pretty">
            Escolhe {nProposto}{' '}
            {nProposto === 1 ? 'passageiro' : 'passageiros'} para o acordo
            <span className="ml-1 font-normal text-slate-500 tabular-nums">
              ({selectedIds.length}/{nProposto})
            </span>
          </legend>
          <ul className="space-y-2">
            {membros.map((m, index) => {
              const id = m.passenger_id || `membro-${index}`;
              const checked = selectedIds.includes(m.passenger_id);
              const disabledExtra = !checked && selectedIds.length >= nProposto;
              return (
                <li key={id}>
                  <label
                    className={`flex min-h-12 items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer ${
                      checked
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-slate-100 dark:border-slate-800'
                    } ${disabledExtra ? 'opacity-50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 size-5 shrink-0 accent-primary"
                      checked={checked}
                      disabled={busy || disabledExtra}
                      aria-label={m.nome}
                      onChange={() => toggleMember(m.passenger_id)}
                    />
                    <span className="min-w-0 flex-1 space-y-0.5">
                      <span className="block text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {m.nome}
                      </span>
                      {m.pickup_name ? (
                        <span className="flex items-start gap-1 text-xs text-slate-500 text-pretty">
                          <MapPin size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                          <span>{m.pickup_name}</span>
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ) : (
        <ul className="space-y-3">
          {membros.map((m, index) => (
            <li key={m.passenger_id || `membro-${index}`} className="flex items-start gap-3">
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300"
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
      )}

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

      {!isHistorico && isCriador ? (
        <div className="pt-1">
          <button
            type="button"
            disabled={busy || !onCancelar}
            onClick={() => setConfirmOpen(true)}
            className="w-full min-h-12 bg-slate-100 dark:bg-slate-800 font-bold py-3 rounded-xl disabled:opacity-60"
          >
            Cancelar proposta
          </button>
        </div>
      ) : !isHistorico ? (
        <div className="flex flex-col gap-3 pt-1">
          <button
            type="button"
            disabled={!canAceitar}
            onClick={() => setConfirmOpen(true)}
            className="w-full min-h-12 bg-primary text-white font-bold py-3 rounded-xl disabled:opacity-60"
          >
            Aceitar proposta
          </button>
          <button
            type="button"
            disabled={busy || !onRecusar}
            onClick={onRecusar}
            className="w-full min-h-12 border border-slate-300 dark:border-slate-600 bg-transparent text-slate-700 dark:text-slate-200 font-semibold py-3 rounded-lg disabled:opacity-60"
          >
            Recusar
          </button>
        </div>
      ) : null}

      {!isHistorico ? (
      <ConfirmationModal
        isOpen={confirmOpen}
        title={isCriador ? 'Cancelar esta proposta?' : 'Aceitar esta proposta?'}
        message={
          isCriador
            ? 'A proposta deixa de ficar disponível para a contraparte. Podes enviar outra mais tarde.'
            : needsPicker
              ? `Vais criar um acordo com ${nProposto} passageiros seleccionados. Esta acção não se pode desfazer.`
              : 'Vais criar um acordo com estes passageiros. Esta acção não se pode desfazer.'
        }
        confirmText={isCriador ? 'Confirmar cancelamento' : 'Confirmar'}
        cancelText="Voltar"
        onConfirm={() => {
          setConfirmOpen(false);
          if (isCriador) {
            onCancelar?.();
          } else {
            onAceitar?.(needsPicker ? selectedIds : undefined);
          }
        }}
        onCancel={() => setConfirmOpen(false)}
      />
      ) : null}
    </section>
  );
}

export default PropostaReviewCard;
