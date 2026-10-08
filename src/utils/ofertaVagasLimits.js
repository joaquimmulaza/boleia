/**
 * Limites do stepper de lugares na edição de oferta.
 * Min = lugares ocupados (vagas_totais − vagas_disponiveis), alinhado a oferta_ocupacao.
 * Max = veiculos.vagas_passageiros (capacidade_total − 1 motorista).
 *
 * @param {{ vagas_totais?: number, vagas_disponiveis?: number }} oferta
 * @param {number | null | undefined} veiculoVagasPassageiros
 * @returns {{ min: number, max: number, ocupadas: number, actual: number }}
 */
export function computeOfertaVagasLimits(oferta, veiculoVagasPassageiros) {
  const totais = Number(oferta?.vagas_totais) || 0;
  const disponiveis = Number(oferta?.vagas_disponiveis) || 0;
  const ocupadas = Math.max(0, totais - disponiveis);
  const max = Number(veiculoVagasPassageiros) || totais || 1;
  const min = Math.max(1, ocupadas);
  const actual = totais > 0 ? totais : min;
  return { min, max, ocupadas, actual: Math.min(Math.max(actual, min), max) };
}
