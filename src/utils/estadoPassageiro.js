/**
 * Estado de lugar (`acordos_passageiros.estado`) — fonte única para chips UI.
 * @typedef {'activo' | 'reservado' | 'saiu' | 'expirado' | string} EstadoPassageiroDb
 */

import {
  isAnulacaoMotivoAcordoTerminadoAntesActivacao,
  isAnulacaoMotivoSaidaVoluntaria,
} from './pagamentoAnulacaoMotivo.js';
import { PAYMENT_STATES } from './paymentStatus.js';
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
 * Lugar ocupa vaga no acordo — só `acordos_passageiros.estado` (`activo`|`reservado`).
 *
 * @param {string | null | undefined} estado
 * @returns {boolean}
 */
export function isLugarVivoPassageiro(estado) {
  const e = normalizeEstadoPassageiroKey(estado);
  return e === 'activo' || e === 'reservado';
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
 * @param {{ acordos_passageiros?: Array<{ passenger_id?: string, estado?: string }> }} acordo
 * @returns {Array<{ passenger_id?: string, estado?: string }>}
 */
export function lugaresVivos(acordo) {
  return lugaresVivosFromLinhas(acordo?.acordos_passageiros);
}

/**
 * @param {Array<{ passenger_id?: string, estado?: string }> | null | undefined} linhas
 * @returns {Array<{ passenger_id?: string, estado?: string }>}
 */
export function lugaresVivosFromLinhas(linhas) {
  const rows = Array.isArray(linhas) ? linhas : [];
  return rows.filter((p) => isLugarVivoPassageiro(p.estado));
}

/**
 * @param {Array<{ passenger_id?: string, estado?: string }>} linhas
 * @returns {{ total: number, confirmados: number, reservados: number }}
 */
export function contagemLugaresVivos(linhas) {
  const vivos = lugaresVivosFromLinhas(linhas);
  let confirmados = 0;
  let reservados = 0;
  vivos.forEach((p) => {
    if (isActivoPassageiro(p.estado)) confirmados += 1;
    else if (isReservadoPassageiro(p.estado)) reservados += 1;
  });
  return { total: vivos.length, confirmados, reservados };
}

/**
 * @param {Array<{ estado?: string }>} linhas
 * @returns {{ confirmados: number, reservados: number }}
 */
export function countPassageirosConfirmadosReservados(linhas) {
  const { confirmados, reservados } = contagemLugaresVivos(linhas);
  return { confirmados, reservados };
}

/**
 * Motorista — oculta só pagamentos `anulado` de lugares não vivos; dívidas/histórico mantêm-se.
 *
 * @param {object[]} rows
 * @param {{ linhas?: Array<{ passenger_id?: string, estado?: string }> }} ctx
 * @returns {object[]}
 */
export function filterMotoristaPagamentosLugaresVivos(rows, ctx = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const linhas = ctx.linhas || [];
  /** @type {Map<string, { estado?: string }>} */
  const linhaPorPassageiro = new Map(
    linhas.map((p) => [String(p.passenger_id || ''), p]),
  );

  return list.filter((row) => {
    const pid = String(row.passenger_id || '');
    if (!pid) return false;

    const linha = linhaPorPassageiro.get(pid);
    if (!linha || isLugarVivoPassageiro(linha.estado)) {
      return true;
    }

    const pgEst = String(row.estado || '').toLowerCase();
    return pgEst !== PAYMENT_STATES.ANULADO;
  });
}

/**
 * @param {object | null | undefined} contactos
 * @param {Set<string> | string[]} livePassengerIds
 * @returns {object | null}
 */
export function filterContactosPassageirosVivos(contactos, livePassengerIds) {
  if (!contactos || contactos.bloqueado) return contactos ?? null;
  const allow = livePassengerIds instanceof Set
    ? livePassengerIds
    : new Set((livePassengerIds || []).map((id) => String(id)));
  const passageiros = (contactos.passageiros || []).filter((p) =>
    allow.has(String(p.passenger_id || '')),
  );
  return { ...contactos, passageiros };
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
  return 'Valor recebido e retido pela plataforma até libertar ao motorista.';
}

/** Glossário curto para secção de passageiros. */
export const GLOSSARIO_ESTADOS_LUGAR = Object.freeze([
  { termo: 'Reservado', descricao: helpGlossarioReservado() },
  { termo: 'Confirmado', descricao: helpGlossarioConfirmado() },
  { termo: 'Em custódia', descricao: helpGlossarioEmCustodia() },
]);
