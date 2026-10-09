import { getMesReferenciaAtual } from '../services/PaymentService.js';

/**
 * @typedef {{ anulacao_motivo?: string | null, estado?: string | null }} PagamentoChipContexto
 */

/**
 * Pagamento do mês corrente para chip de lugar (anulacao_motivo).
 *
 * @param {object[] | null | undefined} pagamentos
 * @param {string | null | undefined} passengerId
 * @param {string | null | undefined} [mesReferencia]
 * @returns {PagamentoChipContexto | null}
 */
export function findPagamentoChipContexto(pagamentos, passengerId, mesReferencia = null) {
  const mes = String(mesReferencia || getMesReferenciaAtual()).slice(0, 10);
  const pid = String(passengerId || '');
  if (!pid || !Array.isArray(pagamentos)) return null;
  const row = pagamentos.find(
    (p) => String(p.passenger_id || '') === pid
      && String(p.mes_referencia || '').slice(0, 10) === mes,
  );
  if (!row) return null;
  return {
    anulacao_motivo: row.anulacao_motivo ?? null,
    estado: row.estado ?? null,
  };
}

/**
 * Contexto para `estadoPassageiroParaChip` — linha enriquecida, lista do acordo ou pagamento do viewer.
 *
 * @param {{ passenger_id?: string, pagamento_chip?: PagamentoChipContexto | null } | null | undefined} linha
 * @param {{
 *   pagamentosAcordo?: object[],
 *   mesReferencia?: string,
 *   pagamentoViewer?: PagamentoChipContexto | null,
 *   viewerPassengerId?: string | null,
 *   chipFromList?: PagamentoChipContexto | null,
 * }} [opts]
 * @returns {PagamentoChipContexto | null | undefined}
 */
export function resolvePagamentoChipContexto(linha, opts = {}) {
  if (!linha) return null;
  if (linha.pagamento_chip) {
    return linha.pagamento_chip;
  }
  if (opts.chipFromList) {
    return opts.chipFromList;
  }
  const fromList = findPagamentoChipContexto(
    opts.pagamentosAcordo,
    linha.passenger_id,
    opts.mesReferencia,
  );
  if (fromList) return fromList;
  if (
    opts.pagamentoViewer
    && opts.viewerPassengerId
    && String(linha.passenger_id || '') === String(opts.viewerPassengerId)
  ) {
    return opts.pagamentoViewer;
  }
  return null;
}

/**
 * Indexa motivos por acordo (para cartões antes de abrir o sheet).
 *
 * @param {Record<string, Array<{ passenger_id?: string, anulacao_motivo?: string | null, pagamento_estado?: string | null, estado?: string | null }>>} porAcordoId
 * @returns {Record<string, Record<string, PagamentoChipContexto>>}
 */
export function indexMotivosPagamentoPorAcordo(porAcordoId) {
  /** @type {Record<string, Record<string, PagamentoChipContexto>>} */
  const out = {};
  Object.entries(porAcordoId || {}).forEach(([acordoId, rows]) => {
    /** @type {Record<string, PagamentoChipContexto>} */
    const map = {};
    (rows || []).forEach((row) => {
      const pid = String(row.passenger_id || '');
      if (!pid) return;
      map[pid] = {
        anulacao_motivo: row.anulacao_motivo ?? null,
        // Só a linha própria (ou motorista) traz pagamento_estado; chips de outros usam só motivo anulado.
        estado: row.pagamento_estado ?? null,
      };
    });
    out[acordoId] = map;
  });
  return out;
}

/**
 * Enriquece linhas com `pagamento_chip` a partir do índice.
 *
 * @param {Array<{ passenger_id?: string, pagamento_chip?: PagamentoChipContexto }>} linhas
 * @param {Record<string, PagamentoChipContexto> | undefined} mapaAcordo
 * @returns {typeof linhas}
 */
export function enrichLinhasComPagamentoChip(linhas, mapaAcordo) {
  if (!mapaAcordo || !Array.isArray(linhas)) return linhas;
  return linhas.map((p) => {
    const chip = mapaAcordo[String(p.passenger_id || '')];
    if (!chip) return p;
    return { ...p, pagamento_chip: chip };
  });
}

/**
 * @param {Array<{ acordo_id?: string, passenger_id?: string, anulacao_motivo?: string | null, pagamento_estado?: string | null }>} rows
 * @returns {Record<string, Record<string, PagamentoChipContexto>>}
 */
export function groupAnulacaoMotivoRowsByAcordo(rows) {
  /** @type {Record<string, Array<{ passenger_id?: string, anulacao_motivo?: string | null, pagamento_estado?: string | null }>>} */
  const porAcordoId = {};
  (rows || []).forEach((row) => {
    const aid = String(row.acordo_id || '');
    if (!aid) return;
    if (!porAcordoId[aid]) porAcordoId[aid] = [];
    porAcordoId[aid].push({
      passenger_id: row.passenger_id,
      anulacao_motivo: row.anulacao_motivo,
      pagamento_estado: row.pagamento_estado,
    });
  });
  return indexMotivosPagamentoPorAcordo(porAcordoId);
}

/**
 * Preenche `anulacao_motivo` / `estado` quando o loader principal omite o motivo (Critiquito #249).
 *
 * @param {object | null | undefined} pagamento
 * @param {PagamentoChipContexto | null | undefined} chipCtx
 * @returns {object | null}
 */
export function mergePagamentoComChipContexto(pagamento, chipCtx) {
  if (!chipCtx) return pagamento ?? null;
  if (!pagamento) {
    return {
      estado: chipCtx.estado ?? null,
      anulacao_motivo: chipCtx.anulacao_motivo ?? null,
    };
  }
  const anulacao_motivo = pagamento.anulacao_motivo ?? chipCtx.anulacao_motivo ?? null;
  const estado = pagamento.estado ?? chipCtx.estado ?? null;
  if (anulacao_motivo === pagamento.anulacao_motivo && estado === pagamento.estado) {
    return pagamento;
  }
  return { ...pagamento, anulacao_motivo, estado };
}
