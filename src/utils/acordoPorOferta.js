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

/**
 * Acordo vivo para o passageiro (cabecalho + linha) — mesma regra do mapa CTA.
 * @param {{ id?: string, oferta_id?: string | null, estado?: string, acordos_passageiros?: Array<{ passenger_id?: string, estado?: string }> }} acordo
 * @param {string} passengerId
 * @returns {boolean}
 */
export function isAcordoVivoParaPassageiro(acordo, passengerId) {
  if (!acordo?.id || !acordo?.oferta_id || !passengerId) return false;
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
 * @returns {Map<string, string>}
 */
export function buildAcordoIdPorOfertaMap(acordos, passengerId) {
  const map = new Map();
  if (!passengerId) return map;

  for (const acordo of acordos || []) {
    if (!isAcordoVivoParaPassageiro(acordo, passengerId)) continue;
    if (!map.has(acordo.oferta_id)) {
      map.set(acordo.oferta_id, acordo.id);
    }
  }

  return map;
}

export const CTA_VER_ACORDO = 'Ver acordo';

/** TTL de entradas optimistas pós-aceite (ms). */
export const ACORDO_OPTIMISTA_TTL_MS = 30_000;

/**
 * Acordo mínimo para CTA «Ver acordo» logo após accept_proposal (antes do refetch).
 * @param {{ id: string, oferta_id?: string | null, estado?: string, acordos_passageiros?: Array<{ passenger_id?: string, estado?: string }> }} acordoRpc
 * @param {string} passengerId
 * @param {number} [now]
 * @returns {object | null}
 */
export function buildAcordoOptimistaPosAceite(acordoRpc, passengerId, now = Date.now()) {
  const ofertaId = acordoRpc?.oferta_id;
  if (!acordoRpc?.id || !ofertaId || !passengerId) return null;

  const linhas = acordoRpc.acordos_passageiros?.length
    ? acordoRpc.acordos_passageiros
    : [{ passenger_id: passengerId, estado: 'reservado' }];

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
  for (const acordo of fetchedList) {
    if (isAcordoVivoParaPassageiro(acordo, passengerId) && acordo.oferta_id) {
      ofertasComVivo.add(acordo.oferta_id);
    }
  }

  for (const acordo of prev || []) {
    if (!acordo?._optimista || !acordo?.oferta_id) continue;
    if (ofertasComVivo.has(acordo.oferta_id)) continue;
    const desde = acordo._optimistaDesde ?? 0;
    if (now - desde < ACORDO_OPTIMISTA_TTL_MS) {
      result.push(acordo);
    }
  }

  return result;
}
