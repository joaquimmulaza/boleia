/**
 * TODO Copywriter: copy final da conta quando uma falta Motorista desconta em cada passageiro activo.
 * Placeholder até revisão de copy — usar {@link formatFaltaMotoristaRepartidaConta} na UI.
 */
export const FALTA_MOTORISTA_REPARTIDA_CONTA_PLACEHOLDER = '{nPassageiros} · {totalKz}';

/**
 * @param {number} nPassageirosActivos
 * @param {string} totalFormatado — ex. «1500» ou «1 500» (já formatado com formatKwanza)
 * @returns {string}
 */
export function formatFaltaMotoristaRepartidaConta(nPassageirosActivos, totalFormatado) {
  const n = Number(nPassageirosActivos) || 0;
  const rotuloPassageiros = n === 1 ? '1 passageiro' : `${n} passageiros`;
  return FALTA_MOTORISTA_REPARTIDA_CONTA_PLACEHOLDER
    .replace('{nPassageiros}', rotuloPassageiros)
    .replace('{totalKz}', `${totalFormatado} Kz`);
}
