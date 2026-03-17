import { supabase } from '../lib/supabase';

/**
 * Busca a lista de faltas para um determinado acordo.
 * @param {string} acordoId - ID do acordo
 * @returns {Promise<{data: any[], error: any}>}
 */
export const getAbsences = async (acordoId) => {
  return supabase
    .from('faltas')
    .select('*')
    .eq('id_acordo', acordoId);
};

/**
 * Regista uma nova falta.
 * @param {Object} faltaData - Dados da falta
 * @returns {Promise<{data: any, error: any}>}
 */
export const logAbsence = async (faltaData) => {
  return supabase
    .from('faltas')
    .insert([faltaData])
    .select();
};
