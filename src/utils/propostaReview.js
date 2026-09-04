import { resolveAgreementPricing } from './resolveAgreementPricing.js';
import { listMembrosGrupo } from '../services/GrupoService.js';

/**
 * @typedef {{
 *   passenger_id: string | null | undefined,
 *   nome: string,
 *   telefone: string | null | undefined,
 *   pickup_name: string | null | undefined,
 *   quota_mensal_kz: number,
 * }} PropostaReviewMembro
 */

/**
 * @typedef {{
 *   valor_mensal_total_kz: number,
 *   valor_mensal_por_passageiro_kz: number,
 *   quotas: number[],
 *   temResto: boolean,
 * }} PropostaReviewPricing
 */

/**
 * @typedef {{
 *   titulo: string,
 *   membros: PropostaReviewMembro[],
 *   pricing: PropostaReviewPricing,
 *   avisoComposicao: string | null,
 * }} PropostaReview
 */

/**
 * @param {number} n
 * @param {boolean} comGrupo
 * @returns {string}
 */
function buildTitulo(n, comGrupo) {
  if (comGrupo) {
    return n === 1 ? 'Grupo · 1 pessoa' : `Grupo · ${n} pessoas`;
  }
  return n === 1 ? '1 passageiro' : `${n} passageiros`;
}

/**
 * @param {object | null | undefined} membro
 * @returns {string}
 */
function resolveNome(membro) {
  const nome = membro?.perfis?.nome_completo;
  if (typeof nome === 'string' && nome.trim()) {
    return nome.trim();
  }
  return 'Passageiro';
}

/**
 * @param {object | null | undefined} membro
 * @returns {string | null | undefined}
 */
function resolveTelefone(membro) {
  return membro?.perfis?.telefone ?? membro?.telefone ?? null;
}

/**
 * Constrói a vista de revisão de uma proposta para o hub do motorista.
 * Usa os primeiros `n_passageiros_propostos` membros (já ordenados por `ordem_insercao`).
 *
 * @param {{
 *   grupo_id?: string | null,
 *   modo_preco: 'POR_PASSAGEIRO' | 'TOTAL_ACORDO',
 *   valor_mensal_ask_kz: number,
 *   n_passageiros_propostos: number,
 * }} proposta
 * @param {object[]} membrosActivos
 * @returns {PropostaReview}
 */
export function buildPropostaReview(proposta, membrosActivos = []) {
  const n = proposta.n_passageiros_propostos;
  const ask = Number(proposta.valor_mensal_ask_kz);
  const modo = proposta.modo_preco;
  const activos = Array.isArray(membrosActivos) ? membrosActivos : [];

  const resolved = resolveAgreementPricing({
    modo_preco: modo,
    valor_ask_kz: ask,
    n_passageiros: n,
  });

  const sliced = activos.slice(0, n);
  const membros = sliced.map((membro, i) => ({
    passenger_id: membro?.passenger_id ?? null,
    nome: resolveNome(membro),
    telefone: resolveTelefone(membro),
    pickup_name: membro?.pickup_name ?? null,
    quota_mensal_kz: resolved.quotas[i],
  }));

  const temResto = modo === 'TOTAL_ACORDO' && ask % n !== 0;

  /** @type {string | null} */
  let avisoComposicao = null;
  // Solo sem grupo: membros vazios é esperado — sem aviso.
  if (proposta.grupo_id && activos.length < n) {
    avisoComposicao =
      'O grupo tem menos pessoas do que as indicadas nesta proposta. A aceitação pode falhar.';
  }

  return {
    titulo: buildTitulo(n, Boolean(proposta.grupo_id)),
    membros,
    pricing: {
      ...resolved,
      temResto,
    },
    avisoComposicao,
  };
}

/**
 * Carrega membros do grupo (se houver) e devolve a revisão da proposta.
 *
 * @param {{
 *   grupo_id?: string | null,
 *   modo_preco: 'POR_PASSAGEIRO' | 'TOTAL_ACORDO',
 *   valor_mensal_ask_kz: number,
 *   n_passageiros_propostos: number,
 * }} proposta
 * @returns {Promise<PropostaReview>}
 */
export async function loadPropostaReview(proposta) {
  if (proposta.grupo_id) {
    const membros = await listMembrosGrupo(proposta.grupo_id);
    return buildPropostaReview(proposta, membros);
  }
  return buildPropostaReview(proposta, []);
}
