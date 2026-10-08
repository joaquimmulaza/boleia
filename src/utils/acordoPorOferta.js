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
 * Mapa oferta_id → acordo_id para CTAs «Ver acordo» (uma leitura, sem N+1).
 * @param {Array<{ id: string, oferta_id?: string | null, estado?: string, acordos_passageiros?: Array<{ passenger_id?: string, estado?: string }> }>} acordos
 * @param {string} passengerId
 * @returns {Map<string, string>}
 */
export function buildAcordoIdPorOfertaMap(acordos, passengerId) {
  const map = new Map();
  if (!passengerId) return map;

  for (const acordo of acordos || []) {
    if (!acordo?.id || !acordo?.oferta_id) continue;
    if (!isAcordoCabecalhoVivo(acordo.estado)) continue;

    const linha = (acordo.acordos_passageiros || []).find(
      (p) => p.passenger_id === passengerId,
    );
    if (!linha || !isLinhaPassageiroViva(linha.estado)) continue;

    map.set(acordo.oferta_id, acordo.id);
  }

  return map;
}

export const CTA_VER_ACORDO = 'Ver acordo';

/**
 * Acordo mínimo para CTA «Ver acordo» logo após accept_proposal (antes do refetch).
 * @param {{ id: string, oferta_id?: string | null, estado?: string, acordos_passageiros?: Array<{ passenger_id?: string, estado?: string }> }} acordoRpc
 * @param {string} passengerId
 * @returns {object | null}
 */
export function buildAcordoOptimistaPosAceite(acordoRpc, passengerId) {
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
  };
}

/**
 * Funde listas por oferta_id; fetched ganha quando presente (optimista sobrevive a stale []).
 * @param {Array<{ id?: string, oferta_id?: string | null }>} prev
 * @param {Array<{ id?: string, oferta_id?: string | null }>} fetched
 * @returns {Array}
 */
export function mergeAcordosPassageiro(prev, fetched) {
  const byOferta = new Map();
  for (const acordo of prev || []) {
    if (acordo?.oferta_id) byOferta.set(acordo.oferta_id, acordo);
  }
  for (const acordo of fetched || []) {
    if (acordo?.oferta_id) byOferta.set(acordo.oferta_id, acordo);
  }
  return [...byOferta.values()];
}
