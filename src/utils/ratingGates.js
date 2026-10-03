/**
 * Gates de elegibilidade e estados de prompt para rating MVP (ENG#32c).
 * M1 = primeiro período pago confirmado; M2 = saída. Sem labels M1/M2 na UI.
 */

/** @typedef {'pendente' | 'feito' | 'expirado'} RatingPromptEstado */
/** @typedef {'primeiro_periodo' | 'saida'} RatingMomento */

export const RATING_WINDOW_DAYS = 14;

export const RATING_MOMENTO = Object.freeze({
  PRIMEIRO_PERIODO: /** @type {RatingMomento} */ ('primeiro_periodo'),
  SAIDA: /** @type {RatingMomento} */ ('saida'),
});

// Caching the Intl.DateTimeFormat instance significantly improves performance
// compared to calling .toLocaleDateString() or instantiating on every invocation.
const ratingDateFormatter = new Intl.DateTimeFormat('pt-PT', { month: 'short', year: 'numeric' });


/**
 * @param {string | null | undefined} estado
 * @returns {boolean}
 */
export function isPeriodoLiquidado(estado) {
  const e = String(estado || '').toLowerCase();
  return e === 'em_custodia' || e === 'liquidado';
}

/**
 * @param {Array<{ estado?: string, validado_em?: string | null, liquidado_em?: string | null }>} pagamentos
 * @returns {string | null}
 */
export function getFirstSettledAt(pagamentos) {
  const rows = (pagamentos || []).filter((p) => isPeriodoLiquidado(p.estado));
  if (rows.length === 0) return null;
  const timestamps = rows
    .map((p) => p.liquidado_em || p.validado_em)
    .filter(Boolean)
    .map((t) => new Date(String(t)).getTime())
    .filter((t) => !Number.isNaN(t));
  if (timestamps.length === 0) return null;
  return new Date(Math.min(...timestamps)).toISOString();
}

/**
 * @param {string | null | undefined} startIso
 * @returns {string | null}
 */
export function getRatingWindowEnd(startIso) {
  if (!startIso) return null;
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + RATING_WINDOW_DAYS * 86400000).toISOString();
}

/**
 * @param {string | Date} now
 * @param {string | null} windowEndIso
 * @returns {boolean}
 */
function isBeforeWindowEnd(now, windowEndIso) {
  if (!windowEndIso) return true;
  return new Date(now).getTime() <= new Date(windowEndIso).getTime();
}

/**
 * @param {{
 *   now: string | Date,
 *   settledAt: string | null,
 *   submitted: boolean,
 *   momento: RatingMomento,
 *   passageiroEstado: string,
 *   saidaAt?: string | null,
 * }} input
 * @returns {RatingPromptEstado | null}
 */
export function resolveRatingPromptEstado(input) {
  const {
    now,
    settledAt,
    submitted,
    momento,
    passageiroEstado,
    saidaAt = null,
  } = input;

  if (String(passageiroEstado || '').toLowerCase() === 'expirado') {
    return null;
  }
  if (!settledAt) return null;
  if (submitted) return 'feito';

  if (momento === RATING_MOMENTO.PRIMEIRO_PERIODO) {
    const end = getRatingWindowEnd(settledAt);
    return isBeforeWindowEnd(now, end) ? 'pendente' : 'expirado';
  }

  const estado = String(passageiroEstado || '').toLowerCase();
  if (estado === 'activo') return 'pendente';
  if (estado === 'saiu') {
    const end = getRatingWindowEnd(saidaAt || settledAt);
    return isBeforeWindowEnd(now, end) ? 'pendente' : 'expirado';
  }
  return null;
}

/**
 * @param {Array<{ acordo_passageiro_id?: string, momento?: string, avaliador_id?: string }>} avaliacoes
 * @param {string} acordoPassageiroId
 * @param {RatingMomento} momento
 * @param {string} avaliadorId
 * @returns {boolean}
 */
function hasSubmitted(avaliacoes, acordoPassageiroId, momento, avaliadorId) {
  return (avaliacoes || []).some(
    (a) =>
      a.acordo_passageiro_id === acordoPassageiroId
      && a.momento === momento
      && a.avaliador_id === avaliadorId,
  );
}

/**
 * Pagamentos do lugar — por FK ou, em linhas legadas, por passenger_id.
 * @param {Array<{ acordo_passageiro_id?: string, passenger_id?: string, estado?: string, validado_em?: string | null, liquidado_em?: string | null, mes_referencia?: string }>} pagamentos
 * @param {string} acordoPassageiroId
 * @param {string | null | undefined} [passengerId]
 * @returns {Array<object>}
 */
function pagamentosForSeat(pagamentos, acordoPassageiroId, passengerId = null) {
  return (pagamentos || []).filter((p) => {
    if (p.acordo_passageiro_id && p.acordo_passageiro_id === acordoPassageiroId) return true;
    if (!p.acordo_passageiro_id && passengerId && p.passenger_id === passengerId) return true;
    return false;
  });
}

/**
 * @param {string | null | undefined} mesReferencia
 * @returns {string}
 */
export function formatMesRatingCurto(mesReferencia) {
  if (!mesReferencia) return '';
  const d = new Date(`${String(mesReferencia).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return ratingDateFormatter.format(d);
}

/**
 * @param {{
 *   acordoId: string,
 *   acordoPassageiroId: string,
 *   passageiroEstado: string,
 *   pagamentos: object[],
 *   avaliacoes: object[],
 *   now: string | Date,
 *   driverNome: string,
 *   avaliadorId: string,
 * }} input
 * @returns {object | null}
 */
export function buildPassageiroRatingPrompt(input) {
  const {
    acordoId,
    acordoPassageiroId,
    passageiroEstado,
    pagamentos,
    avaliacoes,
    now,
    driverNome,
    avaliadorId,
  } = input;

  const seatPagamentos = pagamentosForSeat(pagamentos, acordoPassageiroId, avaliadorId);
  const settledAt = getFirstSettledAt(seatPagamentos);
  const submitted = hasSubmitted(
    avaliacoes,
    acordoPassageiroId,
    RATING_MOMENTO.PRIMEIRO_PERIODO,
    avaliadorId,
  );
  const estado = resolveRatingPromptEstado({
    now,
    settledAt,
    submitted,
    momento: RATING_MOMENTO.PRIMEIRO_PERIODO,
    passageiroEstado,
  });
  if (!estado || estado === 'feito') return null;

  const mesRef = seatPagamentos.find((p) => isPeriodoLiquidado(p.estado))?.mes_referencia;

  return {
    acordoId,
    acordoPassageiroId,
    momento: RATING_MOMENTO.PRIMEIRO_PERIODO,
    estado,
    ctaLabel: 'Avaliar motorista',
    titulo: 'Avaliar motorista',
    contraparteNome: driverNome,
    periodoLabel: mesRef ? formatMesRatingCurto(mesRef) : '',
    badgeLabel: '1.º mês pago',
  };
}

/**
 * @param {{
 *   acordoId: string,
 *   passageiros: Array<{ id: string, passenger_id: string, estado?: string, perfis?: { nome_completo?: string } }>,
 *   pagamentos: object[],
 *   avaliacoes: object[],
 *   now: string | Date,
 *   driverId: string,
 * }} input
 * @returns {object[]}
 */
export function buildMotoristaRatingPrompts(input) {
  const { acordoId, passageiros, pagamentos, avaliacoes, now, driverId } = input;

  return (passageiros || [])
    .filter((p) => {
      const e = String(p.estado || '').toLowerCase();
      return e === 'activo' || e === 'saiu';
    })
    .map((p) => {
      const seatPagamentos = pagamentosForSeat(pagamentos, p.id, p.passenger_id);
      const settledAt = getFirstSettledAt(seatPagamentos);
      const submitted = hasSubmitted(
        avaliacoes,
        p.id,
        RATING_MOMENTO.PRIMEIRO_PERIODO,
        driverId,
      );
      const estado = resolveRatingPromptEstado({
        now,
        settledAt,
        submitted,
        momento: RATING_MOMENTO.PRIMEIRO_PERIODO,
        passageiroEstado: p.estado || 'activo',
        saidaAt: null,
      });
      if (!estado) return null;

      const mesRef = seatPagamentos.find((pg) => isPeriodoLiquidado(pg.estado))?.mes_referencia;
      const nome = p.perfis?.nome_completo || 'Passageiro';

      return {
        acordoId,
        acordoPassageiroId: p.id,
        passengerId: p.passenger_id,
        momento: RATING_MOMENTO.PRIMEIRO_PERIODO,
        estado,
        contraparteNome: nome,
        periodoLabel: mesRef ? formatMesRatingCurto(mesRef) : '',
        badgeLabel: 'Pendente',
      };
    })
    .filter(Boolean);
}

/**
 * @param {{
 *   acordoId: string,
 *   acordoPassageiroId: string,
 *   passageiroEstado: string,
 *   pagamentos: object[],
 *   avaliacoes: object[],
 *   now: string | Date,
 *   avaliadorId: string,
 *   saidaAt?: string | null,
 * }} input
 * @returns {object | null}
 */
export function buildSaidaRatingPrompt(input) {
  const {
    acordoId,
    acordoPassageiroId,
    passageiroEstado,
    pagamentos,
    avaliacoes,
    now,
    avaliadorId,
    saidaAt = null,
  } = input;

  const seatPagamentos = pagamentosForSeat(pagamentos, acordoPassageiroId, avaliadorId);
  const settledAt = getFirstSettledAt(seatPagamentos);
  const submitted = hasSubmitted(
    avaliacoes,
    acordoPassageiroId,
    RATING_MOMENTO.SAIDA,
    avaliadorId,
  );
  const estado = resolveRatingPromptEstado({
    now,
    settledAt,
    submitted,
    momento: RATING_MOMENTO.SAIDA,
    passageiroEstado,
    saidaAt,
  });
  if (!estado || estado === 'feito') return null;

  return {
    acordoId,
    acordoPassageiroId,
    momento: RATING_MOMENTO.SAIDA,
    estado,
  };
}

/**
 * Vista máxima da contraparte — só «Avaliado», sem comentário nem estrelas.
 * @param {{ wasAvaliado: boolean, ratingRow?: { comentario?: string, estrelas?: number } | null }} input
 * @returns {{ avaliado: boolean, label: string }}
 */
export function counterpartySeesApenasAvaliado(input) {
  if (!input.wasAvaliado) {
    return { avaliado: false, label: '' };
  }
  return { avaliado: true, label: 'Avaliado' };
}

/**
 * Motorista: há algum prompt M1 pendente?
 * @param {object[]} prompts
 * @returns {boolean}
 */
export function hasMotoristaRatingPendente(prompts) {
  return (prompts || []).some((p) => p.estado === 'pendente');
}

/**
 * Contagem para copy «Avaliaste X de Y».
 * @param {object[]} prompts
 * @returns {{ feitos: number, total: number }}
 */
export function countMotoristaRatingProgress(prompts) {
  const rows = prompts || [];
  return {
    feitos: rows.filter((p) => p.estado === 'feito').length,
    total: rows.length,
  };
}
