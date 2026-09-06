/**
 * Labels e chips de estado de proposta (UI humana, PT-PT).
 */

/** @typedef {'aberta' | 'rejeitada' | 'cancelada' | 'aceite'} EstadoProposta */

/**
 * @param {string | null | undefined} estado
 * @returns {EstadoProposta | string}
 */
export function normalizeEstadoProposta(estado) {
  return String(estado || '').toLowerCase();
}

/**
 * Label curta para chip de estado.
 *
 * @param {string | null | undefined} estado
 * @param {{ secao?: 'recebidas' | 'enviadas' }} [opts]
 * @returns {string | null}
 */
export function labelEstadoProposta(estado, opts = {}) {
  const e = normalizeEstadoProposta(estado);
  const secao = opts.secao || 'enviadas';

  if (e === 'aberta') {
    return secao === 'recebidas' ? 'Por responder' : 'Aguarda resposta';
  }
  if (e === 'rejeitada') return 'Rejeitada';
  if (e === 'cancelada') return 'Cancelada';
  if (e === 'aceite') return 'Aceite';
  return null;
}

/**
 * Classes Tailwind para chip de estado.
 *
 * @param {string | null | undefined} estado
 * @returns {{ label: string, className: string } | null}
 */
export function chipEstadoProposta(estado, opts = {}) {
  const label = labelEstadoProposta(estado, opts);
  if (!label) return null;

  const e = normalizeEstadoProposta(estado);
  if (e === 'aberta') {
    return {
      label,
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    };
  }
  if (e === 'rejeitada') {
    return {
      label,
      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };
  }
  if (e === 'cancelada') {
    return {
      label,
      className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    };
  }
  if (e === 'aceite') {
    return {
      label,
      className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    };
  }
  return { label, className: 'bg-slate-100 text-slate-600' };
}

/**
 * @param {string | null | undefined} estado
 * @returns {boolean}
 */
export function isPropostaTerminada(estado) {
  const e = normalizeEstadoProposta(estado);
  return e === 'rejeitada' || e === 'cancelada';
}
