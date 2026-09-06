import { resolveAgreementPricing } from './resolveAgreementPricing.js';
import { listMembrosGrupo } from '../services/GrupoService.js';

/**
 * @typedef {{
 *   passenger_id: string | null | undefined,
 *   nome: string,
 *   telefone: string | null | undefined,
 *   pickup_name: string | null | undefined,
 *   pickup_lat: number | null,
 *   pickup_lng: number | null,
 *   dropoff_name: string | null | undefined,
 *   dropoff_lat: number | null,
 *   dropoff_lng: number | null,
 *   quota_mensal_kz: number,
 * }} PropostaReviewMembro
 */

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   kind: 'recolha' | 'desembarque',
 *   lat: number,
 *   lng: number,
 *   memberIndex: number,
 * }} PreferentialMapPoint
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
 *   requiresMemberSelection: boolean,
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
 * @param {unknown} value
 * @returns {number | null}
 */
function resolveCoord(value) {
  if (value == null || value === '') {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function resolveOptionalName(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

/**
 * Constrói a vista de revisão de uma proposta para o hub (contraparte).
 * Se o grupo activo for maior que os lugares da proposta, lista todos os
 * membros e marca `requiresMemberSelection` para o picker explícito.
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
  const nActual = activos.length;
  const requiresMemberSelection = Boolean(proposta.grupo_id) && nActual > n;

  const resolved = resolveAgreementPricing({
    modo_preco: modo,
    valor_ask_kz: ask,
    n_passageiros: n,
  });

  const listForUi = requiresMemberSelection ? activos : activos.slice(0, n);
  const membros = listForUi.map((membro, i) => ({
    passenger_id: membro?.passenger_id ?? null,
    nome: resolveNome(membro),
    telefone: resolveTelefone(membro),
    pickup_name: membro?.pickup_name ?? null,
    pickup_lat: resolveCoord(membro?.pickup_lat),
    pickup_lng: resolveCoord(membro?.pickup_lng),
    dropoff_name: membro?.dropoff_name ?? null,
    dropoff_lat: resolveCoord(membro?.dropoff_lat),
    dropoff_lng: resolveCoord(membro?.dropoff_lng),
    quota_mensal_kz: requiresMemberSelection ? null : resolved.quotas[i],
  }));

  const temResto = modo === 'TOTAL_ACORDO' && ask % n !== 0;

  /** @type {string | null} */
  let avisoComposicao = null;
  // Solo sem grupo: membros vazios é esperado — sem aviso.
  if (proposta.grupo_id) {
    if (nActual < n) {
      avisoComposicao =
        'O grupo tem menos pessoas do que as indicadas nesta proposta. A aceitação pode falhar.';
    } else if (requiresMemberSelection) {
      avisoComposicao =
        `O grupo tem mais pessoas do que as cobertas nesta proposta. ` +
        `Escolhe exactamente ${n} passageiros para o acordo.`;
    }
  }

  return {
    titulo: buildTitulo(n, Boolean(proposta.grupo_id)),
    membros,
    pricing: {
      ...resolved,
      temResto,
    },
    avisoComposicao,
    requiresMemberSelection,
  };
}

/**
 * Pontos válidos para o mapa preferencial (recolha + desembarque).
 * Aceita membros do DTO de revisão (ou linhas equivalentes com coords).
 *
 * @param {Array<Partial<PropostaReviewMembro> | null | undefined>} membros
 * @returns {PreferentialMapPoint[]}
 */
export function buildPreferentialMapPoints(membros = []) {
  const list = Array.isArray(membros) ? membros : [];
  /** @type {PreferentialMapPoint[]} */
  const points = [];

  list.forEach((membro, index) => {
    const idBase = membro?.passenger_id || String(index);
    const pickupLat = resolveCoord(membro?.pickup_lat);
    const pickupLng = resolveCoord(membro?.pickup_lng);
    if (pickupLat != null && pickupLng != null) {
      points.push({
        id: `${idBase}-recolha`,
        label: resolveOptionalName(membro?.pickup_name) || 'Recolha',
        kind: 'recolha',
        lat: pickupLat,
        lng: pickupLng,
        memberIndex: index + 1,
      });
    }

    const dropoffLat = resolveCoord(membro?.dropoff_lat);
    const dropoffLng = resolveCoord(membro?.dropoff_lng);
    if (dropoffLat != null && dropoffLng != null) {
      points.push({
        id: `${idBase}-desembarque`,
        label: resolveOptionalName(membro?.dropoff_name) || 'Desembarque',
        kind: 'desembarque',
        lat: dropoffLat,
        lng: dropoffLng,
        memberIndex: index + 1,
      });
    }
  });

  return points;
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
