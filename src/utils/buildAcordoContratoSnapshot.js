import { labelModoPreco } from './ofertaLabels';
import { formatPrimeiroNome } from './primeiroNome';

/**
 * @typedef {object} ContratoSnapshot
 * @property {boolean} complete
 * @property {string[]} [missingFields]
 * @property {string} [modalidade]
 * @property {number} [nContrato]
 * @property {string} [nLabel]
 * @property {number} [totalMensalKz]
 * @property {number} [porPassageiroKz]
 * @property {number} [valorReferenciaKz]
 * @property {string} [valorReferenciaLabel]
 * @property {boolean} [temResto]
 */

const MODOS_VALIDOS = new Set(['POR_PASSAGEIRO', 'TOTAL_ACORDO']);

/**
 * @param {number | null | undefined} n
 * @param {string | null | undefined} [primeiroNomePassageiro]
 * @returns {string | null}
 */
export function labelNContrato(n, primeiroNomePassageiro) {
  if (!Number.isInteger(n) || n < 1) return null;
  if (n === 1 && primeiroNomePassageiro) {
    return formatPrimeiroNome(primeiroNomePassageiro);
  }
  return n === 1 ? 'Individual' : `Grupo · ${n} pessoas`;
}

/**
 * @param {number | null | undefined} value
 * @returns {boolean}
 */
function isKzInt(value) {
  return Number.isInteger(value) && value >= 0;
}

/**
 * Snapshot de contrato a partir de campos congelados do acordo.
 * Sem defaults de plataforma — devolve `complete: false` se faltar dado.
 *
 * @param {{
 *   modo_preco?: string | null,
 *   n_passageiros_contrato?: number | null,
 *   valor_mensal_por_passageiro_kz?: number | null,
 *   valor_mensal_total_kz?: number | null,
 * }} acordo
 * @param {{ primeiroNomePassageiro?: string | null }} [options]
 * @returns {ContratoSnapshot}
 */
export function buildAcordoContratoSnapshot(acordo, options = {}) {
  /** @type {string[]} */
  const missingFields = [];

  const modo = acordo?.modo_preco;
  if (!modo || !MODOS_VALIDOS.has(modo)) {
    missingFields.push('modo_preco');
  }

  const n = acordo?.n_passageiros_contrato;
  if (!Number.isInteger(n) || n < 1) {
    missingFields.push('n_passageiros_contrato');
  }

  const porPessoa = acordo?.valor_mensal_por_passageiro_kz;
  if (!isKzInt(porPessoa)) {
    missingFields.push('valor_mensal_por_passageiro_kz');
  }

  const total = acordo?.valor_mensal_total_kz;
  if (!isKzInt(total)) {
    missingFields.push('valor_mensal_total_kz');
  }

  if (missingFields.length > 0) {
    return { complete: false, missingFields };
  }

  const nContrato = /** @type {number} */ (n);
  const totalMensalKz = /** @type {number} */ (total);
  const porPassageiroKz = /** @type {number} */ (porPessoa);
  const modoPreco = /** @type {'POR_PASSAGEIRO' | 'TOTAL_ACORDO'} */ (modo);
  const temResto =
    modoPreco === 'TOTAL_ACORDO' && totalMensalKz % nContrato !== 0;

  return {
    complete: true,
    modalidade: labelModoPreco(modoPreco),
    nContrato,
    nLabel: labelNContrato(nContrato, options.primeiroNomePassageiro)
      ?? `Grupo · ${nContrato} pessoas`,
    totalMensalKz,
    porPassageiroKz,
    valorReferenciaKz:
      modoPreco === 'TOTAL_ACORDO' ? totalMensalKz : porPassageiroKz,
    valorReferenciaLabel:
      modoPreco === 'TOTAL_ACORDO' ? 'Total do acordo' : 'Valor por passageiro',
    temResto,
  };
}

/**
 * Snapshot antes do aceite (proposta + pricing resolvido).
 *
 * @param {{
 *   modo_preco?: string | null,
 *   n_passageiros_propostos?: number | null,
 *   pricing?: {
 *     valor_mensal_total_kz?: number,
 *     valor_mensal_por_passageiro_kz?: number,
 *     temResto?: boolean,
 *   } | null,
 * }} input
 * @returns {ContratoSnapshot}
 */
export function buildContratoSnapshotFromProposta(input) {
  const pricing = input?.pricing;
  if (!pricing) {
    return { complete: false, missingFields: ['pricing'] };
  }

  return buildAcordoContratoSnapshot({
    modo_preco: input.modo_preco,
    n_passageiros_contrato: input.n_passageiros_propostos,
    valor_mensal_por_passageiro_kz: pricing.valor_mensal_por_passageiro_kz,
    valor_mensal_total_kz: pricing.valor_mensal_total_kz,
  });
}
