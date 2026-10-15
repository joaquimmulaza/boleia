import { formatKwanza } from '../utils/formatKwanza';

/** Copy aprovado PM+Critiquito — falta Motorista, vista motorista (n = 1). */
export const FALTA_MOTORISTA_CONTA_SINGULAR = '1 passageiro · {total} Kz';

/** Copy aprovado PM+Critiquito — falta Motorista, vista motorista (n ≥ 2). */
export const FALTA_MOTORISTA_CONTA_PLURAL = '{n} passageiros · {total} Kz no total';

/**
 * Linha da conta no card (total = desconto × passageiros activos nesse dia).
 * @param {number} nPassageirosActivos
 * @param {number} totalKz
 * @returns {string}
 */
export function formatFaltaMotoristaRepartidaConta(nPassageirosActivos, totalKz) {
  const n = Number(nPassageirosActivos) || 0;
  if (n <= 0) {
    return '';
  }
  const total = formatKwanza(totalKz);
  if (n === 1) {
    return FALTA_MOTORISTA_CONTA_SINGULAR.replace('{total}', total);
  }
  return FALTA_MOTORISTA_CONTA_PLURAL.replace('{n}', String(n)).replace('{total}', total);
}
