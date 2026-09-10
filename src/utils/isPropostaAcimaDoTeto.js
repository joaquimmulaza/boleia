import { resolveAgreementPricing } from './resolveAgreementPricing.js';

/**
 * Compara o teto da procura com o valor resolvido da proposta no mesmo modo.
 * Não muta a proposta. Teto nulo/≤0 não marca «acima».
 *
 * @param {{
 *   modo_preco?: string,
 *   valor_mensal_ask_kz?: number,
 *   n_passageiros_propostos?: number,
 *   valor_mensal_por_passageiro_resolvido_kz?: number | null,
 *   valor_mensal_total_resolvido_kz?: number | null,
 * }} proposta
 * @param {number | null | undefined} tetoKz
 * @param {'POR_PASSAGEIRO' | 'TOTAL_ACORDO'} [modoTeto]
 * @returns {boolean}
 */
export function isPropostaAcimaDoTeto(proposta, tetoKz, modoTeto = 'POR_PASSAGEIRO') {
  const teto = Number(tetoKz);
  if (!Number.isFinite(teto) || teto <= 0) return false;

  const n = Number(proposta?.n_passageiros_propostos);
  const ask = Number(proposta?.valor_mensal_ask_kz);
  const modoProp = proposta?.modo_preco === 'TOTAL_ACORDO' ? 'TOTAL_ACORDO' : 'POR_PASSAGEIRO';

  let total = Number(proposta?.valor_mensal_total_resolvido_kz);
  let quota = Number(proposta?.valor_mensal_por_passageiro_resolvido_kz);

  if (!Number.isFinite(total) || !Number.isFinite(quota)) {
    if (!Number.isInteger(n) || n < 1 || !Number.isInteger(ask) || ask < 0) {
      return false;
    }
    const resolved = resolveAgreementPricing({
      modo_preco: modoProp,
      valor_ask_kz: ask,
      n_passageiros: n,
    });
    total = resolved.valor_mensal_total_kz;
    quota = resolved.valor_mensal_por_passageiro_kz;
  }

  const comparado = modoTeto === 'TOTAL_ACORDO' ? total : quota;
  return comparado > teto;
}
