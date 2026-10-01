import { formatEffectiveFromLongPt, formatEffectiveFromShortPt } from './precoProximoMes.js';
import { formatMesAdendaPt } from './adendaStatus.js';

/** Estados de negociação activa (máx. uma por acordo). */
export const NEGOCIACAO_ESTADOS_ATIVOS = new Set([
  'pendente_passageiro',
  'pendente_contraparte',
  'aceite',
  'aceite_agendada',
  'rejeitada',
]);

/**
 * @param {object[] | null | undefined} adendas
 * @returns {object | null}
 */
export function resolveNegociacaoPrecoAtiva(adendas) {
  const rows = Array.isArray(adendas) ? adendas : [];
  return (
    rows.find(
      (a) =>
        a
        && a.applied_at == null
        && a.superseded_at == null
        && NEGOCIACAO_ESTADOS_ATIVOS.has(String(a.estado || '').toLowerCase()),
    ) || null
  );
}

/**
 * @param {string | null | undefined} estado
 * @returns {boolean}
 */
export function isAdendaAguardandoResposta(estado) {
  const e = String(estado || '').toLowerCase();
  return e === 'pendente_passageiro' || e === 'pendente_contraparte';
}

/**
 * @param {{ estado?: string } | null | undefined} adenda
 * @param {boolean} janelaAberta
 * @returns {boolean}
 */
export function isAdendaRecusadaValida(adenda, janelaAberta) {
  if (!adenda || !janelaAberta) return false;
  return String(adenda.estado || '').toLowerCase() === 'rejeitada';
}

/**
 * @param {{ created_by?: string } | null | undefined} adenda
 * @param {string | undefined} userId
 * @returns {boolean}
 */
export function souProponenteAdenda(adenda, userId) {
  if (!adenda?.created_by || !userId) return false;
  return adenda.created_by === userId;
}

/**
 * Proponente pode enviar nova proposta enquanto a recusada ainda está activa (RPC supersede).
 *
 * @param {{ estado?: string, created_by?: string } | null | undefined} adenda
 * @param {{ userId?: string, janelaAberta?: boolean }} ctx
 * @returns {boolean}
 */
export function podeNovaPropostaAposRecusa(adenda, ctx) {
  if (!ctx.janelaAberta || !adenda || !ctx.userId) return false;
  if (String(adenda.estado || '').toLowerCase() !== 'rejeitada') return false;
  return souProponenteAdenda(adenda, ctx.userId);
}

/**
 * Gate «Mudar preço no próximo mês» — sem negociação activa ou nova proposta após recusa (proponente).
 *
 * @param {{ estado?: string, created_by?: string } | null | undefined} negociacao
 * @param {{ userId?: string, janelaAberta?: boolean }} ctx
 * @returns {boolean}
 */
export function podeProporNovaPreco(negociacao, ctx) {
  if (!ctx.janelaAberta) return false;
  if (!negociacao) return true;
  const e = String(negociacao.estado || '').toLowerCase();
  if (e === 'rejeitada') {
    return souProponenteAdenda(negociacao, ctx.userId);
  }
  return false;
}

/**
 * @param {{ created_by?: string, estado?: string } | null | undefined} adenda
 * @param {string | undefined} userId
 * @returns {boolean}
 */
export function podeRetirarProposta(adenda, userId) {
  if (!adenda?.created_by || !userId) return false;
  if (adenda.created_by !== userId) return false;
  const e = String(adenda.estado || '').toLowerCase();
  return e === 'pendente_passageiro' || e === 'pendente_contraparte' || e === 'rejeitada';
}

/**
 * @param {{ estado?: string, created_by?: string } | null | undefined} adenda
 * @param {{ isMotorista?: boolean, isPassageiro?: boolean, janelaAberta?: boolean, driverId?: string }} ctx
 * @returns {boolean}
 */
export function isContraparteAdenda(adenda, ctx) {
  const e = String(adenda?.estado || '').toLowerCase();
  if (e === 'pendente_passageiro') return Boolean(ctx.isPassageiro);
  if (e === 'pendente_contraparte') return Boolean(ctx.isMotorista);
  if (e === 'rejeitada') {
    if (!adenda?.created_by || !ctx.driverId) return false;
    if (adenda.created_by === ctx.driverId) {
      return Boolean(ctx.isPassageiro);
    }
    return Boolean(ctx.isMotorista);
  }
  return false;
}

/**
 * @param {{ estado?: string, created_by?: string } | null | undefined} adenda
 * @param {{ isMotorista?: boolean, isPassageiro?: boolean, janelaAberta?: boolean, userId?: string, driverId?: string }} ctx
 * @returns {boolean}
 */
export function podeContraPropor(adenda, ctx) {
  if (!ctx.janelaAberta || !adenda) return false;
  if (!isAdendaAguardandoResposta(adenda.estado)) return false;
  if (!ctx.userId || adenda.created_by === ctx.userId) return false;
  return isContraparteAdenda(adenda, ctx);
}

/**
 * @param {{ estado?: string, created_by?: string } | null | undefined} adenda
 * @param {{ isMotorista?: boolean, isPassageiro?: boolean, janelaAberta?: boolean, userId?: string, driverId?: string }} ctx
 * @returns {boolean}
 */
export function podeVoltarAAceitar(adenda, ctx) {
  if (!isAdendaRecusadaValida(adenda, Boolean(ctx.janelaAberta))) return false;
  if (!ctx.userId || adenda.created_by === ctx.userId) return false;
  return isContraparteAdenda(adenda, ctx);
}

/**
 * @param {{ estado?: string, effective_from?: string } | null | undefined} adenda
 * @returns {string}
 */
export function labelChipHistoricoAdenda(adenda) {
  const e = String(adenda?.estado || '').toLowerCase();
  if (e === 'em_vigor') {
    const short = formatEffectiveFromShortPt(adenda?.effective_from);
    return short !== '—' ? `Em vigor a ${short}` : 'Em vigor';
  }
  if (e === 'aceite_agendada' || e === 'aceite') {
    const short = formatEffectiveFromShortPt(adenda?.effective_from);
    return short !== '—' ? `Em vigor a ${short}` : 'Aceite · agendado';
  }
  if (e === 'cancelada_substituta') return 'Substituída';
  if (e === 'cancelada_iniciador') return 'Retirada';
  if (e === 'rejeitada') return 'Recusada';
  if (isAdendaAguardandoResposta(e)) return 'À espera';
  return adenda?.estado || '—';
}

/**
 * @param {{ estado?: string } | null | undefined} adenda
 * @returns {string}
 */
export function chipClassHistoricoAdenda(adenda) {
  const e = String(adenda?.estado || '').toLowerCase();
  if (e === 'em_vigor' || e === 'aceite' || e === 'aceite_agendada') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100';
  }
  if (e === 'rejeitada') return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
}

/**
 * @param {{ estado?: string, created_at?: string, effective_from?: string, valor_mensal_por_passageiro_kz?: number }} adenda
 * @param {{ proponenteLabel?: string, mesActualLabel?: string }} [ctx]
 * @returns {string}
 */
export function describeHistoricoAdenda(adenda, ctx = {}) {
  const e = String(adenda?.estado || '').toLowerCase();
  const valor = adenda?.valor_mensal_por_passageiro_kz;
  const mesFuturo = formatMesAdendaPt(adenda?.effective_from);
  const mesActual = ctx.mesActualLabel || 'mês actual';

  if (e === 'cancelada_substituta') {
    return 'Substituída por uma proposta mais recente.';
  }
  if (e === 'cancelada_iniciador') {
    return `Proponente retirou · ${mesFuturo} ficou no preço actual`;
  }
  if (e === 'rejeitada') {
    return `Recusada · acordo manteve-se · preço actual intacto`;
  }
  if (e === 'em_vigor' || e === 'aceite' || e === 'aceite_agendada') {
    return `${formatEffectiveFromLongPt(adenda?.effective_from)} · ${mesActual} ficou intacto`;
  }
  if (valor != null) {
    return `Proposta de ${valor.toLocaleString('pt-PT')} Kz`;
  }
  return 'Proposta de preço';
}

/**
 * @param {{ estado?: string, created_at?: string }} adenda
 * @returns {string}
 */
export function footerHistoricoAdenda(adenda) {
  const e = String(adenda?.estado || '').toLowerCase();
  const data = adenda?.created_at
    ? new Date(adenda.created_at).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  if (e === 'cancelada_iniciador') return data ? `Retirada · ${data}` : 'Retirada';
  if (e === 'cancelada_substituta') return data ? `Contra-proposta · ${data}` : 'Substituída';
  if (e === 'rejeitada') return data ? `Recusada · ${data}` : 'Recusada';
  if (e === 'aceite' || e === 'aceite_agendada' || e === 'em_vigor') {
    return data ? `Aceite · ${data}` : 'Aceite';
  }
  return data || '—';
}
