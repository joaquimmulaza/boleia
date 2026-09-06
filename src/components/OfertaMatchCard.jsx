import React from 'react';
import { ArrowRight, Clock, Users } from 'lucide-react';
import { formatKwanza } from '../utils/formatKwanza';
import { labelModoPreco, labelCapacidade, labelRotaOferta } from '../utils/ofertaLabels';

/**
 * Chip de estado do card de match (lista = detalhe).
 * @param {'direct' | 'waitlist'} variant
 * @param {string | null} [waitlistEstado]
 */
function estadoChip(variant, waitlistEstado) {
  if (variant === 'direct') {
    return {
      label: 'Disponível',
      className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    };
  }
  if (waitlistEstado === 'notificada') {
    return {
      label: 'Vaga aberta',
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    };
  }
  if (waitlistEstado === 'activa') {
    return {
      label: 'Em espera',
      className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    };
  }
  return {
    label: 'Sem vagas',
    className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  };
}

/**
 * Card de oferta compatível no hub passageiro (directa ou waitlist).
 * Apresentação pura — sem regras de matching/backend.
 *
 * @param {{
 *   oferta: {
 *     id: string,
 *     origin_name?: string | null,
 *     destination_name?: string | null,
 *     departure_time?: string,
 *     vagas_disponiveis?: number,
 *     valor_mensal_ask_kz?: number,
 *     modo_preco?: string,
 *     flexibilidade_rota?: boolean,
 *   },
 *   variant?: 'direct' | 'waitlist',
 *   waitlistEstado?: string | null,
 *   busy?: boolean,
 *   onPropor?: () => void,
 *   onWaitlist?: () => void,
 * }} props
 */
function OfertaMatchCard({
  oferta,
  variant = 'direct',
  waitlistEstado = null,
  busy = false,
  onPropor,
  onWaitlist,
}) {
  const rota = labelRotaOferta(oferta);
  const chip = estadoChip(variant, waitlistEstado);
  const time = String(oferta.departure_time || '').slice(0, 5);
  const isWaitlist = variant === 'waitlist';
  const shellClass = isWaitlist
    ? 'bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 border border-slate-100 dark:border-slate-800 space-y-3'
    : 'bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3';

  return (
    <section className={shellClass} data-testid={`oferta-match-${variant}`}>
      <div className="flex justify-between items-start gap-2">
        <div className="font-bold flex items-center gap-2 text-slate-900 dark:text-white min-w-0">
          <span className="truncate">{rota.origem}</span>
          <ArrowRight size={14} className="text-slate-400 shrink-0" aria-hidden="true" />
          <span className="truncate">{rota.destino}</span>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 ${chip.className}`}>
          {chip.label}
        </span>
      </div>

      <div className="flex flex-wrap gap-3 text-sm text-slate-500">
        <span className="flex items-center gap-1">
          <Clock size={14} aria-hidden="true" />
          {time}
        </span>
        <span className="flex items-center gap-1">
          <Users size={14} aria-hidden="true" />
          {labelCapacidade(oferta.vagas_disponiveis)}
        </span>
      </div>

      {isWaitlist && (
        <p className="text-sm text-slate-500">
          Sem lugares suficientes agora ({labelCapacidade(oferta.vagas_disponiveis)}).
        </p>
      )}

      {isWaitlist && waitlistEstado === 'notificada' && (
        <p className="text-sm font-medium text-amber-800">
          Há uma vaga — podes propor acordo.
        </p>
      )}

      {isWaitlist && waitlistEstado === 'activa' && (
        <p className="text-sm font-medium text-slate-600">
          Estás na lista de espera.
        </p>
      )}

      <div className="flex justify-between items-center gap-3 pt-1 border-t border-slate-50 dark:border-slate-800">
        <div>
          <strong className="text-primary tabular-nums">
            {formatKwanza(oferta.valor_mensal_ask_kz)} Kz
          </strong>
          <p className="text-xs text-slate-400">{labelModoPreco(oferta.modo_preco)}</p>
        </div>

        {variant === 'direct' && onPropor ? (
          <button
            type="button"
            disabled={busy}
            onClick={onPropor}
            className="bg-primary text-white text-sm font-bold px-4 py-2.5 rounded-xl disabled:opacity-60 shrink-0"
          >
            Propor acordo
          </button>
        ) : null}

        {isWaitlist && waitlistEstado === 'notificada' && onPropor ? (
          <button
            type="button"
            disabled={busy}
            onClick={onPropor}
            className="bg-primary text-white text-sm font-bold px-4 py-2.5 rounded-xl disabled:opacity-60 shrink-0"
          >
            Propor acordo
          </button>
        ) : null}

        {isWaitlist && !waitlistEstado && onWaitlist ? (
          <button
            type="button"
            disabled={busy}
            onClick={onWaitlist}
            className="text-sm font-bold text-primary shrink-0"
          >
            Entrar na lista de espera
          </button>
        ) : null}
      </div>
    </section>
  );
}

export default OfertaMatchCard;
