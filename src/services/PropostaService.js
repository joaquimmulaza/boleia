import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import { loadPropostaReview } from '../utils/propostaReview.js';
import { enqueueRpc, isNetworkFailure } from './offlineQueue.js';

export { buildPropostaReview, loadPropostaReview } from '../utils/propostaReview.js';

const MODOS_PRECO = new Set(['POR_PASSAGEIRO', 'TOTAL_ACORDO']);

/**
 * @typedef {'POR_PASSAGEIRO' | 'TOTAL_ACORDO'} ModoPreco
 */

/**
 * Cria proposta sentido A (passageiro→motorista) ou B (motorista→passageiro).
 * `created_by` = utilizador autenticado; aceite/rejeição só pela contraparte.
 *
 * @param {{
 *   oferta_id: string,
 *   procura_id: string,
 *   grupo_id?: string | null,
 *   modo_preco: ModoPreco,
 *   valor_mensal_ask_kz: number,
 *   n_passageiros_propostos: number,
 * }} input
 */
export async function createProposta(input) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Não autenticado.');
  }

  const n = input.n_passageiros_propostos;
  if (!Number.isInteger(n) || n < 1) {
    throw new Error('Número de passageiros inválido.');
  }

  if (n > 1 && !input.grupo_id) {
    throw new Error('Para propor com mais de uma pessoa é necessário um grupo ligado à procura.');
  }

  if (!MODOS_PRECO.has(input.modo_preco)) {
    throw new Error('Modo de preço inválido.');
  }

  const ask = Number(input.valor_mensal_ask_kz);
  if (!Number.isInteger(ask) || ask < 0) {
    throw new Error('Valor mensal em Kz inválido.');
  }

  const { data, error } = await supabase
    .from('propostas')
    .insert([
      {
        oferta_id: input.oferta_id,
        procura_id: input.procura_id,
        grupo_id: input.grupo_id ?? null,
        modo_preco: input.modo_preco,
        valor_mensal_ask_kz: ask,
        n_passageiros_propostos: n,
        estado: 'aberta',
        created_by: user.id,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * @param {string} procuraId
 */
export async function listPropostasByProcura(procuraId) {
  const { data, error } = await supabase
    .from('propostas')
    .select('*')
    .eq('procura_id', procuraId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * @param {string} ofertaId
 */
export async function listPropostasByOferta(ofertaId) {
  const { data, error } = await supabase
    .from('propostas')
    .select('*')
    .eq('oferta_id', ofertaId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Rejeita proposta via RPC (só a contraparte; `created_by` bloqueado).
 * @param {string} propostaId
 */
export async function rejectProposta(propostaId) {
  if (!propostaId) {
    throw new Error('ID da proposta é obrigatório.');
  }

  const { data, error } = await supabase.rpc('reject_proposal', {
    p_proposta_id: propostaId,
  });

  if (error) {
    throw new Error(error.message || 'Falha ao rejeitar proposta.');
  }

  return data;
}

/**
 * Cancela proposta aberta via RPC (só o criador; contraparte usa `rejectProposta`).
 * Não usa UPDATE client — P0 preservado.
 * Em falha de rede, enfileira offline com idempotency_key.
 *
 * @param {string} propostaId
 * @param {{ idempotencyKey?: string, forceQueue?: boolean }} [options]
 */
export async function cancelProposta(propostaId, options = {}) {
  if (!propostaId) {
    throw new Error('ID da proposta é obrigatório.');
  }

  const idempotencyKey = options.idempotencyKey || uuidv4();
  const rpcArgs = {
    p_proposta_id: propostaId,
    p_idempotency_key: idempotencyKey,
  };

  const queueCancel = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      throw new Error('Sessão necessária para guardar o cancelamento offline.');
    }
    await enqueueRpc({
      rpc: 'cancel_proposal',
      args: rpcArgs,
      accessToken,
      idempotencyKey,
    });
    return {
      id: propostaId,
      estado: 'cancelada',
      offlineQueued: true,
      idempotency_key: idempotencyKey,
    };
  };

  if (options.forceQueue || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return queueCancel();
  }

  try {
    const { data, error } = await supabase.rpc('cancel_proposal', rpcArgs);

    if (error) {
      if (isNetworkFailure(error)) {
        return queueCancel();
      }
      throw new Error(error.message || 'Falha ao cancelar proposta.');
    }

    return data;
  } catch (err) {
    if (isNetworkFailure(err)) {
      return queueCancel();
    }
    throw err;
  }
}

/**
 * Enriquece propostas com revisão para o hub do motorista (membros + preço resolvido).
 * Shape UI: `{ proposta, titulo, membros, pricing, avisoComposicao }`.
 *
 * @param {object[]} propostas
 * @returns {Promise<Array<{
 *   proposta: object,
 *   titulo: string,
 *   membros: Array<{
 *     passenger_id: string | null | undefined,
 *     nome: string,
 *     telefone: string | null | undefined,
 *     pickup_name: string | null | undefined,
 *     quota_mensal_kz: number,
 *   }>,
 *   pricing: {
 *     valor_mensal_total_kz: number,
 *     valor_mensal_por_passageiro_kz: number,
 *     quotas: number[],
 *     temResto: boolean,
 *   },
 *   avisoComposicao: string | null,
 * }>>}
 */
export async function enrichPropostasForReview(propostas) {
  const list = Array.isArray(propostas) ? propostas : [];
  return Promise.all(
    list.map(async (proposta) => {
      const review = await loadPropostaReview(proposta);
      return {
        proposta,
        ...review,
      };
    }),
  );
}
