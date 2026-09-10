/**
 * Labels humanas para ofertas de capacidade (copy UI — nunca expor enums).
 */

/**
 * @param {string | null | undefined} modo
 * @returns {'Por passageiro' | 'Total do acordo'}
 */
export function labelModoPreco(modo) {
  return modo === 'TOTAL_ACORDO' ? 'Total do acordo' : 'Por passageiro';
}

/**
 * Capacidade = lugares disponíveis (nunca divisor de preço na copy).
 * @param {number} vagas
 * @returns {string}
 */
export function labelCapacidade(vagas) {
  const n = Number(vagas) || 0;
  return n === 1 ? '1 lugar disponível' : `${n} lugares disponíveis`;
}

/**
 * @param {{
 *   origin_name?: string | null,
 *   destination_name?: string | null,
 *   flexibilidade_rota?: boolean,
 * }} oferta
 * @returns {{ origem: string, destino: string }}
 */
export function labelRotaOferta(oferta) {
  if (oferta?.flexibilidade_rota) {
    return {
      origem: 'Oferta flexível',
      destino: 'Sem origem/destino fixos',
    };
  }
  return {
    origem: oferta?.origin_name || 'Origem',
    destino: oferta?.destination_name || 'Destino',
  };
}

/**
 * Label humana para procura no hub — flexível (OD null) alinhado a acordos/ofertas flex.
 * @param {{
 *   origin_name?: string | null,
 *   destination_name?: string | null,
 *   origin_lat?: number | null,
 *   destination_lat?: number | null,
 * }} procura
 * @returns {{ origem: string, destino: string }}
 */
export function labelRotaProcura(procura) {
  const hasOd =
    procura?.origin_name &&
    procura.origin_lat != null &&
    procura?.destination_name &&
    procura.destination_lat != null;

  if (!hasOd) {
    return {
      origem: 'Procura flexível',
      destino: 'Sem origem/destino fixos',
    };
  }

  return {
    origem: procura.origin_name,
    destino: procura.destination_name,
  };
}
