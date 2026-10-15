import { contagemLugaresVivos } from './estadoPassageiro.js';
import { labelNContrato } from './buildAcordoContratoSnapshot.js';

/**
 * Rótulo «Pessoas no acordo» só a partir de N_contrato congelado — nunca nomes de passageiros.
 *
 * @param {number | null | undefined} nContrato
 * @param {string | null | undefined} [_primeiroNomeIgnorado]
 * @returns {string | null}
 */
export function labelPessoasNoAcordoContrato(nContrato, _primeiroNomeIgnorado) {
  return labelNContrato(nContrato);
}

/**
 * Fonte única para «Pessoas no acordo» (snapshot) e «Passageiros · N» (lugares vivos).
 *
 * @param {{
 *   n_passageiros_contrato?: number | null,
 *   modo_preco?: string | null,
 *   valor_mensal_por_passageiro_kz?: number | null,
 *   valor_mensal_total_kz?: number | null,
 * }} acordo
 * @param {Array<{ estado?: string }> | null | undefined} linhas
 * @returns {{
 *   nLabel: string | null,
 *   nPassageirosVivos: number,
 *   nConfirmados: number,
 *   nReservados: number,
 * }}
 */
export function resolvePessoasAcordoUi(acordo, linhas) {
  const {
    total: nPassageirosVivos,
    confirmados: nConfirmados,
    reservados: nReservados,
  } = contagemLugaresVivos(linhas);
  const nLabel = labelPessoasNoAcordoContrato(acordo?.n_passageiros_contrato);
  return {
    nLabel,
    nPassageirosVivos,
    nConfirmados,
    nReservados,
  };
}
