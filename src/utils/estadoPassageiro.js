/**
 * Estado de lugar (`acordos_passageiros.estado`) — fonte única para chips UI.
 * @typedef {'activo' | 'reservado' | 'saiu' | 'expirado' | string} EstadoPassageiroDb
 */

import {
  isAnulacaoMotivoAcordoTerminadoAntesActivacao,
  isAnulacaoMotivoSaidaVoluntaria,
} from './pagamentoAnulacaoMotivo.js';

/**
 * @param {string | null | undefined} estado
 * @returns {string}
 */
export function normalizeEstadoPassageiroKey(estado) {
  return String(estado || '').toLowerCase();
}

/**
 * Estado canónico para chip (DB + legacy expirado por saída voluntária).
 *
 * @param {string | null | undefined} estado
 * @param {{ anulacao_motivo?: string | null } | null | undefined} [pagamento]
 * @returns {string}
 */
export function estadoPassageiroParaChip(estado, pagamento) {
  const e = normalizeEstadoPassageiroKey(estado);
  if (e === 'expirado') {
    if (isAnulacaoMotivoAcordoTerminadoAntesActivacao(pagamento)) {
      return 'terminado';
    }
    if (isAnulacaoMotivoSaidaVoluntaria(pagamento)) {
      return 'saiu';
    }
  }
  return e;
}

/**
 * @param {string | null | undefined} estado
 * @returns {boolean}
 */
export function isActivoPassageiro(estado) {
  return normalizeEstadoPassageiroKey(estado) === 'activo';
}

/**
 * @param {string | null | undefined} estado
 * @returns {boolean}
 */
export function isReservadoPassageiro(estado) {
  return normalizeEstadoPassageiroKey(estado) === 'reservado';
}

/**
 * @param {string | null | undefined} estado
 * @param {{ anulacao_motivo?: string | null } | null | undefined} [pagamento]
 * @returns {boolean}
 */
export function isSaiuPassageiro(estado, pagamento) {
  return estadoPassageiroParaChip(estado, pagamento) === 'saiu';
}

/**
 * @param {string | null | undefined} estado
 * @param {{ anulacao_motivo?: string | null } | null | undefined} [pagamento]
 * @returns {boolean}
 */
export function isTerminadoPassageiro(estado, pagamento) {
  return estadoPassageiroParaChip(estado, pagamento) === 'terminado';
}

/**
 * TTL / prazo reserva (não saída voluntária).
 *
 * @param {string | null | undefined} estado
 * @param {{ anulacao_motivo?: string | null } | null | undefined} [pagamento]
 * @returns {boolean}
 */
export function isExpiradoPassageiro(estado, pagamento) {
  return estadoPassageiroParaChip(estado, pagamento) === 'expirado';
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
 *
 * @param {string | null | undefined} estado
 * @param {{ anulacao_motivo?: string | null } | null | undefined} [pagamento]
 * @returns {string}
 */
export function labelChipEstadoPassageiro(estado, pagamento) {
  const e = estadoPassageiroParaChip(estado, pagamento);
  if (e === 'activo') return 'Confirmado';
  if (e === 'reservado') return 'Reservado';
  if (e === 'expirado') return 'Expirado';
  if (e === 'saiu') return 'Saiu';
  if (e === 'terminado') return 'Terminado';
  return estado || '—';
}

/**
 * @param {string | null | undefined} estado
 * @param {{ anulacao_motivo?: string | null } | null | undefined} [pagamento]
 * @returns {string}
 */
export function chipClassEstadoPassageiro(estado, pagamento) {
  const e = estadoPassageiroParaChip(estado, pagamento);
  if (e === 'activo') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100';
  }
  if (e === 'reservado') {
    return 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100';
  }
  if (e === 'expirado') {
    return 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 line-through';
  }
  if (e === 'saiu' || e === 'terminado') {
    return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
  }
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
}

/** Estados que mostram chip secundário no cartão/sheet do passageiro (nunca «Activo»). */
export const ESTADOS_LUGAR_COM_CHIP_UI = Object.freeze(['reservado', 'expirado', 'saiu', 'terminado']);

/**
 * @param {string | null | undefined} estado
 * @param {{ anulacao_motivo?: string | null } | null | undefined} [pagamento]
 * @returns {boolean}
 */
export function mostrarChipEstadoLugarPassageiro(estado, pagamento) {
  const e = estadoPassageiroParaChip(estado, pagamento);
  return ESTADOS_LUGAR_COM_CHIP_UI.includes(e);
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
