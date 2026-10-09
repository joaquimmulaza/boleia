/**
 * Estado de lugar (`acordos_passageiros.estado`) — fonte única para chips UI.
 * @typedef {'activo' | 'reservado' | 'saiu' | 'expirado' | string} EstadoPassageiroDb
 */

import {
  isAnulacaoMotivoAcordoTerminadoAntesActivacao,
  isAnulacaoMotivoSaidaVoluntaria,
} from './pagamentoAnulacaoMotivo.js';
import { findPagamentoChipContexto, resolvePagamentoChipContexto } from './pagamentoMotivoLugar.js';
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
  const pgEst = String(pagamento?.estado || '').toLowerCase();
  if (pgEst === PAYMENT_STATES.ANULADO) {
    if (isAnulacaoMotivoSaidaVoluntaria(pagamento)) {
      return 'saiu';
    }
    if (isAnulacaoMotivoAcordoTerminadoAntesActivacao(pagamento)) {
      return 'terminado';
    }
  }
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
 * Lugar ocupa vaga no acordo (confirmado ou soft-hold), após normalização de chip.
 *
 * @param {string} chip — resultado de `estadoPassageiroParaChip`
 * @returns {boolean}
 */
export function isLugarVivoChip(chip) {
  const e = normalizeEstadoPassageiroKey(chip);
  return e === 'activo' || e === 'reservado';
}

/**
 * @param {string | null | undefined} estado
 * @param {{ anulacao_motivo?: string | null, estado?: string | null } | null | undefined} [pagamento]
 * @returns {boolean}
 */
export function isLugarVivoPassageiro(estado, pagamento) {
  return isLugarVivoChip(estadoPassageiroParaChip(estado, pagamento));
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
 * Contexto partilhado para resolver `pagamento_chip` por linha.
 *
 * @typedef {{
 *   pagamentosAcordo?: object[],
 *   mesReferencia?: string,
 *   pagamentoViewer?: { anulacao_motivo?: string | null, estado?: string | null } | null,
 *   viewerPassengerId?: string | null,
 *   chipContextPorPassenger?: Record<string, { anulacao_motivo?: string | null, estado?: string | null }>,
 * }} LugaresVivosContexto
 */

/**
 * @param {{ acordos_passageiros?: Array<{ passenger_id?: string, estado?: string, pagamento_chip?: object }> }} acordo
 * @param {LugaresVivosContexto} [ctx]
 * @returns {Array<{ passenger_id?: string, estado?: string }>}
 */
export function lugaresVivos(acordo, ctx = {}) {
  const linhas = acordo?.acordos_passageiros;
  return lugaresVivosFromLinhas(linhas, ctx);
}

/**
 * @param {Array<{ passenger_id?: string, estado?: string, pagamento_chip?: object }> | null | undefined} linhas
 * @param {LugaresVivosContexto} [ctx]
 * @returns {Array<{ passenger_id?: string, estado?: string }>}
 */
export function lugaresVivosFromLinhas(linhas, ctx = {}) {
  const rows = Array.isArray(linhas) ? linhas : [];
  return rows.filter((p) => {
    const pagamento = resolvePagamentoChipContexto(p, {
      pagamentosAcordo: ctx.pagamentosAcordo,
      mesReferencia: ctx.mesReferencia,
      pagamentoViewer: ctx.pagamentoViewer,
      viewerPassengerId: ctx.viewerPassengerId,
      chipFromList: ctx.chipContextPorPassenger?.[String(p.passenger_id || '')],
    });
    return isLugarVivoPassageiro(p.estado, pagamento);
  });
}

/**
 * @param {Array<{ passenger_id?: string, estado?: string }>} linhas
 * @param {LugaresVivosContexto} [ctx]
 * @returns {{ total: number, confirmados: number, reservados: number }}
 */
export function contagemLugaresVivos(linhas, ctx = {}) {
  const vivos = lugaresVivosFromLinhas(linhas, ctx);
  let confirmados = 0;
  let reservados = 0;
  vivos.forEach((p) => {
    const pagamento = resolvePagamentoChipContexto(p, {
      pagamentosAcordo: ctx.pagamentosAcordo,
      mesReferencia: ctx.mesReferencia,
      pagamentoViewer: ctx.pagamentoViewer,
      viewerPassengerId: ctx.viewerPassengerId,
      chipFromList: ctx.chipContextPorPassenger?.[String(p.passenger_id || '')],
    });
    const chip = estadoPassageiroParaChip(p.estado, pagamento);
    if (chip === 'activo') confirmados += 1;
    else if (chip === 'reservado') reservados += 1;
  });
  return { total: vivos.length, confirmados, reservados };
}

/**
 * @param {Array<{ estado?: string }>} linhas
 * @param {LugaresVivosContexto} [ctx]
 * @returns {{ confirmados: number, reservados: number }}
 */
export function countPassageirosConfirmadosReservados(linhas, ctx = {}) {
  const { confirmados, reservados } = contagemLugaresVivos(linhas, ctx);
  return { confirmados, reservados };
}

/**
 * Pagamentos pendentes motorista — só lugares vivos (exclui `anulado` e quem saiu).
 *
 * @param {object[]} rows
 * @param {{
 *   linhas?: object[],
 *   pagamentosAcordo?: object[],
 *   mesReferencia?: string,
 *   chipContextPorPassenger?: Record<string, { anulacao_motivo?: string | null, estado?: string | null }>,
 * }} ctx
 * @returns {object[]}
 */
export function filterMotoristaPagamentosLugaresVivos(rows, ctx = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const linhas = ctx.linhas || [];
  const mes = ctx.mesReferencia;
  const vivosIds = new Set(
    lugaresVivosFromLinhas(linhas, {
      pagamentosAcordo: ctx.pagamentosAcordo,
      mesReferencia: mes,
      chipContextPorPassenger: ctx.chipContextPorPassenger,
    })
      .map((p) => String(p.passenger_id || ''))
      .filter(Boolean),
  );

  return list.filter((row) => {
    const pid = String(row.passenger_id || '');
    if (!pid || !vivosIds.has(pid)) return false;

    const pgEst = String(
      row.estado
      ?? findPagamentoChipContexto(ctx.pagamentosAcordo, pid, mes)?.estado
      ?? '',
    ).toLowerCase();
    if (pgEst === PAYMENT_STATES.ANULADO) return false;

    const linha = linhas.find((p) => String(p.passenger_id || '') === pid);
    if (!linha) return false;
    const chipCtx = resolvePagamentoChipContexto(linha, {
      pagamentosAcordo: ctx.pagamentosAcordo,
      mesReferencia: mes,
      chipFromList: ctx.chipContextPorPassenger?.[pid],
    });
    return isLugarVivoPassageiro(linha.estado, chipCtx);
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
  return 'Em custódia: valor recebido e retido pela plataforma até libertar ao motorista.';
}

/** Glossário curto para secção de passageiros. */
export const GLOSSARIO_ESTADOS_LUGAR = Object.freeze([
  { termo: 'Reservado', descricao: helpGlossarioReservado() },
  { termo: 'Confirmado', descricao: helpGlossarioConfirmado() },
  { termo: 'Em custódia', descricao: helpGlossarioEmCustodia() },
]);
