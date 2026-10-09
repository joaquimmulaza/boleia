/**
 * Estados de cabeçalho em que o passageiro ainda tem lugar no acordo.
 * @param {string | null | undefined} estado
 * @returns {boolean}
 */
function isAcordoCabecalhoVivo(estado) {
  const e = String(estado || '').trim().toLowerCase();
  return e === 'activo' || e === 'cancelamento_pendente';
}

/**
 * Linha do passageiro ocupa vaga (activo ou soft-hold).
 * @param {string | null | undefined} estado
 * @returns {boolean}
 */
function isLinhaPassageiroViva(estado) {
  const e = String(estado || '').trim().toLowerCase();
  return e === 'activo' || e === 'reservado';
}

/** TTL de entradas optimistas pós-aceite (ms). */
export const ACORDO_OPTIMISTA_TTL_MS = 30_000;

/**
 * Entrada optimista expirada (TTL) — não conta para CTA nem merge.
 * @param {{ _optimista?: boolean, _optimistaDesde?: number }} acordo
 * @param {number} [now]
 * @returns {boolean}
 */
export function isOptimistaExpirada(acordo, now = Date.now()) {
  if (!acordo?._optimista) return false;
  const desde = acordo._optimistaDesde ?? 0;
  return now - desde >= ACORDO_OPTIMISTA_TTL_MS;
}

/**
 * Acordo vivo para o passageiro (cabecalho + linha) — mesma regra do mapa CTA.
 * @param {{ id?: string, oferta_id?: string | null, estado?: string, _optimista?: boolean, _optimistaDesde?: number, acordos_passageiros?: Array<{ passenger_id?: string, estado?: string }> }} acordo
 * @param {string} passengerId
 * @param {number} [now]
 * @returns {boolean}
 */
export function isAcordoVivoParaPassageiro(acordo, passengerId, now = Date.now()) {
  if (!acordo?.id || !acordo?.oferta_id || !passengerId) return false;
  if (isOptimistaExpirada(acordo, now)) return false;
  if (!isAcordoCabecalhoVivo(acordo.estado)) return false;

  const linha = (acordo.acordos_passageiros || []).find(
    (p) => p.passenger_id === passengerId,
  );
  if (!linha || !isLinhaPassageiroViva(linha.estado)) return false;

  return true;
}

/**
 * Mapa oferta_id → acordo_id para CTAs «Ver acordo» (uma leitura, sem N+1).
 * @param {Array<{ id: string, oferta_id?: string | null, estado?: string, acordos_passageiros?: Array<{ passenger_id?: string, estado?: string }> }>} acordos
 * @param {string} passengerId
 * @param {number} [now]
 * @returns {Map<string, string>}
 */
export function buildAcordoIdPorOfertaMap(acordos, passengerId, now = Date.now()) {
  const map = new Map();
  if (!passengerId) return map;

  for (const acordo of acordos || []) {
    if (!isAcordoVivoParaPassageiro(acordo, passengerId, now)) continue;
    if (!map.has(acordo.oferta_id)) {
      map.set(acordo.oferta_id, acordo.id);
    }
  }

  return map;
}

export const CTA_VER_ACORDO = 'Ver acordo';

/**
 * Acordo mínimo para CTA «Ver acordo» logo após accept_proposal (antes do refetch).
 * @param {{ id: string, oferta_id?: string | null, estado?: string, acordos_passageiros?: Array<{ passenger_id?: string, estado?: string }> }} acordoRpc
 * @param {string} passengerId
 * @param {number} [now]
 * @param {string[] | null | undefined} [memberIds] ids seleccionados no aceite (grupo)
 * @returns {object | null}
 */
export function buildAcordoOptimistaPosAceite(acordoRpc, passengerId, now = Date.now(), memberIds = null) {
  const ofertaId = acordoRpc?.oferta_id;
  if (!acordoRpc?.id || !ofertaId || !passengerId) return null;

  const hasMemberFilter = Array.isArray(memberIds) && memberIds.length > 0;
  const passageiroSeleccionado = !hasMemberFilter || memberIds.includes(passengerId);

  let linhas;
  if (acordoRpc.acordos_passageiros?.length) {
    linhas = acordoRpc.acordos_passageiros;
    if (hasMemberFilter && !passageiroSeleccionado) {
      const linhaPassageiro = linhas.find((p) => p.passenger_id === passengerId);
      if (!linhaPassageiro) return null;
    }
  } else if (passageiroSeleccionado) {
    linhas = [{ passenger_id: passengerId, estado: 'reservado' }];
  } else {
    return null;
  }

  return {
    ...acordoRpc,
    oferta_id: ofertaId,
    estado: acordoRpc.estado ?? 'activo',
    acordos_passageiros: linhas,
    _optimista: true,
    _optimistaDesde: now,
  };
}

/**
 * Devolve fetch inalterado; acrescenta optimistas recentes sem acordo vivo no fetch.
 * @param {Array<{ id?: string, oferta_id?: string | null, _optimista?: boolean, _optimistaDesde?: number }>} prev
 * @param {Array<{ id?: string, oferta_id?: string | null }>} fetched
 * @param {string} passengerId
 * @param {number} [now]
 * @returns {Array}
 */
export function mergeAcordosPassageiro(prev, fetched, passengerId, now = Date.now()) {
  const fetchedList = fetched || [];
  const result = [...fetchedList];

  const ofertasComVivo = new Set();
  /** Ofertas com acordo no fetch (vivo ou terminado) — evita CTA optimista após encerramento. */
  const ofertasComAcordoFetch = new Set();
  for (const acordo of fetchedList) {
    if (acordo?.oferta_id) {
      ofertasComAcordoFetch.add(acordo.oferta_id);
    }
    if (isAcordoVivoParaPassageiro(acordo, passengerId, now) && acordo.oferta_id) {
      ofertasComVivo.add(acordo.oferta_id);
    }
  }

  for (const acordo of prev || []) {
    if (!acordo?._optimista || !acordo?.oferta_id) continue;
    if (ofertasComVivo.has(acordo.oferta_id)) continue;
    if (
      ofertasComAcordoFetch.has(acordo.oferta_id)
      && !ofertasComVivo.has(acordo.oferta_id)
    ) {
      continue;
    }
    const desde = acordo._optimistaDesde ?? 0;
    if (now - desde < ACORDO_OPTIMISTA_TTL_MS) {
      result.push(acordo);
    }
  }

  return result;
}
