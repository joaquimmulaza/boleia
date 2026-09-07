import { ADENDA_TIMEZONE } from './adendaEffectiveFrom.js';

/**
 * Formata mês de vigência (ex. «outubro de 2026») em pt-PT.
 * @param {string | null | undefined} isoDate — YYYY-MM-DD
 * @returns {string}
 */
export function formatMesAdendaPt(isoDate) {
  if (!isoDate) return 'próximo mês';
  const d = new Date(`${String(isoDate).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return 'próximo mês';
  return d.toLocaleDateString('pt-PT', {
    month: 'long',
    year: 'numeric',
    timeZone: ADENDA_TIMEZONE,
  });
}

/**
 * @param {string | null | undefined} estado
 * @param {{ isMotorista?: boolean, isPassageiro?: boolean, effectiveFrom?: string | null }} [ctx]
 * @returns {string}
 */
export function labelChipAdenda(estado, ctx = {}) {
  const e = String(estado || '').toLowerCase();
  const { isMotorista = false, isPassageiro = false, effectiveFrom = null } = ctx;

  if (e === 'pendente_passageiro') {
    return isPassageiro ? 'À espera tua' : 'À espera deles';
  }
  if (e === 'pendente_contraparte') {
    return isMotorista ? 'À espera tua' : 'À espera deles';
  }
  if (e === 'aceite' || e === 'aceite_agendada') {
    const mes = formatMesAdendaPt(effectiveFrom);
    return `Aceite vigora em ${mes}`;
  }
  if (e === 'rejeitada') return 'Rejeitada';
  if (e === 'cancelada_substituta') return 'Substituída';
  if (e === 'em_vigor') return 'Em vigor';
  return estado || '—';
}

/**
 * Classes Tailwind para chip de estado de adenda.
 * @param {string | null | undefined} estado
 * @returns {string}
 */
export function chipClassAdenda(estado) {
  const e = String(estado || '').toLowerCase();
  switch (e) {
    case 'pendente_passageiro':
    case 'pendente_contraparte':
      return 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100';
    case 'aceite':
    case 'aceite_agendada':
      return 'bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-100';
    case 'rejeitada':
      return 'bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-100';
    case 'cancelada_substituta':
      return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
    case 'em_vigor':
      return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100';
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  }
}
