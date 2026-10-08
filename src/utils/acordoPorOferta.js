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
