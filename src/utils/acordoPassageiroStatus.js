/**
 * Estados de lugar no acordo (soft-hold reservado → activo após em_custodia).
 * Chips e glossário UI — espelha padrão paymentStatus.
 */

/**
 * @param {string | null | undefined} estado
 * @returns {boolean}
 */
export function isActivoPassageiro(estado) {
  return String(estado || '').toLowerCase() === 'activo';
}

/**
 * @param {string | null | undefined} estado
 * @returns {boolean}
 */
export function isReservadoPassageiro(estado) {
  return String(estado || '').toLowerCase() === 'reservado';
}

/**
 * @param {string | null | undefined} estado
 * @returns {boolean}
 */
export function isExpiradoPassageiro(estado) {
  return String(estado || '').toLowerCase() === 'expirado';
}

/**
 * @param {Array<{ estado?: string }>} linhas
 * @returns {{ confirmados: number, reservados: number }}
 */
export function countPassageirosConfirmadosReservados(linhas) {
  const rows = Array.isArray(linhas) ? linhas : [];
  return {
    confirmados: rows.filter((p) => isActivoPassageiro(p.estado)).length,
    reservados: rows.filter((p) => isReservadoPassageiro(p.estado)).length,
  };
}

/**
 * @param {number} confirmados
 * @param {number} reservados
 * @returns {string}
 */
export function formatContagemPassageiros(confirmados, reservados) {
  return `Confirmados ${confirmados} · Reservados ${reservados}`;
}

/**
 * Label curta para chip de estado de lugar.
 * @param {string | null | undefined} estado
 * @returns {string}
 */
export function labelChipEstadoPassageiro(estado) {
  const e = String(estado || '').toLowerCase();
  if (e === 'activo') return 'Confirmado';
  if (e === 'reservado') return 'Reservado';
  if (e === 'expirado') return 'Expirado';
  if (e === 'saiu') return 'Saiu';
  return estado || '—';
}

/**
 * Classes Tailwind para chip de estado de lugar.
 * @param {string | null | undefined} estado
 * @returns {string}
 */
export function chipClassEstadoPassageiro(estado) {
  const e = String(estado || '').toLowerCase();
  if (e === 'activo') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100';
  }
  if (e === 'reservado') {
    return 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100';
  }
  if (e === 'expirado') {
    return 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 line-through';
  }
  if (e === 'saiu') {
    return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
  }
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
}

/** @returns {string} */
export function helpGlossarioReservado() {
  return 'Lugar ocupado após aceite — aguarda pagamento validado para confirmar.';
}

/** @returns {string} */
export function helpGlossarioConfirmado() {
  return 'Lugar confirmado no acordo após validação do pagamento.';
}

/** @returns {string} */
export function helpGlossarioEmCustodia() {
  return 'Em custódia: valor recebido e retido pela plataforma até libertar ao motorista.';
}

/** Glossário curto para secção de passageiros. */
export const GLOSSARIO_ESTADOS_LUGAR = Object.freeze([
  { termo: 'Reservado', descricao: helpGlossarioReservado() },
  { termo: 'Confirmado', descricao: helpGlossarioConfirmado() },
  { termo: 'Em custódia', descricao: helpGlossarioEmCustodia() },
]);
