import { supabase } from '../lib/supabase';

const VIAGENS = new Set(['ida', 'regresso', 'ambas']);

/**
 * Busca a lista de faltas para um determinado acordo.
 * @param {string} acordoId
 * @returns {Promise<Array>}
 */
export const getAbsences = async (acordoId) => {
  if (!acordoId) {
    throw new Error('ID do acordo é obrigatório.');
  }

  const { data, error } = await supabase
    .from('faltas')
    .select('*')
    .eq('id_acordo', acordoId);

  if (error) throw error;
  return data || [];
};

/**
 * Regista uma nova falta.
 * Desconto calculado no trigger BD a partir de valor_mensal_por_passageiro_kz / dias_uteis_mes.
 * @param {{
 *   id_acordo: string,
 *   data_falta: string,
 *   tipo: 'Passageiro'|'Motorista',
 *   observacao?: string,
 *   passenger_id?: string,
 *   viagem?: 'ida'|'regresso'|'ambas',
 * }} faltaData
 * @returns {Promise<Object>}
 */
export const logAbsence = async (faltaData) => {
  if (!faltaData?.id_acordo) {
    throw new Error('ID do acordo é obrigatório.');
  }

  const viagem = faltaData.viagem ?? 'ambas';
  if (!VIAGENS.has(viagem)) {
    throw new Error('Viagem inválida.');
  }

  const row = {
    id_acordo: faltaData.id_acordo,
    data_falta: faltaData.data_falta,
    tipo: faltaData.tipo,
    observacao: faltaData.observacao ?? null,
    passenger_id: faltaData.passenger_id ?? null,
    viagem,
  };

  const { data, error } = await supabase
    .from('faltas')
    .insert([row])
    .select()
    .single();

  if (error) throw error;
  return data;
};
