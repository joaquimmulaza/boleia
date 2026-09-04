/**
 * Resolve preços do acordo na aceitação/negociação (Kz inteiros).
 * N = N_contrato — nunca capacidade do veículo nem N_activos.
 *
 * TOTAL_ACORDO: método do resto — primeiros `resto` índices (ordem inserção)
 * recebem base+1; cabeçalho guarda base como valor_mensal_por_passageiro_kz.
 *
 * @param {{
 *   modo_preco: 'POR_PASSAGEIRO' | 'TOTAL_ACORDO',
 *   valor_ask_kz: number,
 *   n_passageiros: number,
 * }} input
 * @returns {{
 *   valor_mensal_total_kz: number,
 *   valor_mensal_por_passageiro_kz: number,
 *   quotas: number[],
 * }}
 */
export function resolveAgreementPricing({ modo_preco, valor_ask_kz, n_passageiros }) {
  const n = n_passageiros;
  const ask = valor_ask_kz;

  if (!Number.isInteger(n) || n < 1) {
    throw new Error('Número de passageiros inválido.');
  }
  if (!Number.isInteger(ask) || ask < 0) {
    throw new Error('Valor em Kz deve ser um inteiro não negativo.');
  }

  if (modo_preco === 'POR_PASSAGEIRO') {
    const individual = ask;
    const total = individual * n;
    return {
      valor_mensal_total_kz: total,
      valor_mensal_por_passageiro_kz: individual,
      quotas: Array.from({ length: n }, () => individual),
    };
  }

  if (modo_preco === 'TOTAL_ACORDO') {
    const total = ask;
    const base = Math.floor(total / n);
    const resto = total % n;
    const quotas = Array.from({ length: n }, (_, i) => (i < resto ? base + 1 : base));
    return {
      valor_mensal_total_kz: total,
      valor_mensal_por_passageiro_kz: base,
      quotas,
    };
  }

  throw new Error('Modo de preço desconhecido.');
}
