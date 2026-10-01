import { supabase } from '../lib/supabase';
import { counterpartySeesApenasAvaliado } from '../utils/ratingGates.js';

/**
 * Submete avaliação bilateral (RPC idempotente).
 * @param {{
 *   acordoId: string,
 *   acordoPassageiroId: string,
 *   momento: 'primeiro_periodo' | 'saida',
 *   estrelas: number,
 *   comentario?: string | null,
 *   idempotencyKey?: string,
 * }} input
 * @returns {Promise<string>}
 */
export async function submitAvaliacao(input) {
  const estrelas = Number(input.estrelas);
  if (!Number.isInteger(estrelas) || estrelas < 1 || estrelas > 5) {
    throw new Error('Escolhe uma classificação entre 1 e 5 estrelas.');
  }

  const { data, error } = await supabase.rpc('submit_avaliacao_acordo', {
    p_acordo_id: input.acordoId,
    p_acordo_passageiro_id: input.acordoPassageiroId,
    p_momento: input.momento,
    p_estrelas: estrelas,
    p_comentario: input.comentario || null,
    p_idempotency_key: input.idempotencyKey || null,
  });

  if (error) throw error;
  return data;
}

/**
 * Lista avaliações submetidas pelo utilizador autenticado num acordo.
 * @param {string} acordoId
 * @returns {Promise<object[]>}
 */
export async function listMinhasAvaliacoesAcordo(acordoId) {
  const { data, error } = await supabase
    .from('avaliacoes_acordo')
    .select('id, acordo_id, acordo_passageiro_id, avaliador_id, momento, estrelas, comentario, created_at, direccao')
    .eq('acordo_id', acordoId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Contraparte vê apenas se foi avaliada (sem comentário).
 * @param {string} acordoPassageiroId
 * @param {'primeiro_periodo' | 'saida'} momento
 * @param {'passageiro_para_motorista' | 'motorista_para_passageiro'} direccao
 * @returns {Promise<boolean>}
 */
export async function wasAvaliadoPor(acordoPassageiroId, momento, direccao) {
  const { data, error } = await supabase.rpc('was_avaliado_por', {
    p_acordo_passageiro_id: acordoPassageiroId,
    p_momento: momento,
    p_direccao: direccao,
  });
  if (error) throw error;
  return Boolean(data);
}

/**
 * @param {boolean} wasAvaliado
 * @returns {{ avaliado: boolean, label: string }}
 */
export function mapCounterpartyRatingView(wasAvaliado) {
  return counterpartySeesApenasAvaliado({ wasAvaliado, ratingRow: null });
}
