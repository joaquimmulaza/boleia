import { supabase } from '../lib/supabase';

/**
 * @param {string} procuraId
 * @param {string} [nome]
 */
export async function createGrupo(procuraId, nome) {
  if (!procuraId) {
    throw new Error('ID da procura é obrigatório.');
  }

  const { data, error } = await supabase
    .from('grupos')
    .insert([{ procura_id: procuraId, nome: nome ?? null }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * @param {string} procuraId
 * @returns {Promise<object | null>}
 */
export async function getGrupoByProcura(procuraId) {
  if (!procuraId) {
    throw new Error('ID da procura é obrigatório.');
  }

  const { data, error } = await supabase
    .from('grupos')
    .select('*')
    .eq('procura_id', procuraId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Lista membros activos do grupo com dados do perfil.
 * @param {string} grupoId
 * @returns {Promise<object[]>}
 */
export async function listMembrosGrupo(grupoId) {
  if (!grupoId) {
    throw new Error('ID do grupo é obrigatório.');
  }

  const { data, error } = await supabase
    .from('membros_grupo')
    .select('*, perfis(nome_completo, telefone)')
    .eq('grupo_id', grupoId)
    .eq('estado', 'activo')
    .order('ordem_insercao', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Sincroniza N_actual da procura (coluna `n_candidato`) a partir dos membros activos.
 * Não invalida propostas abertas — cada proposta mantém o seu N_proposto (snapshot).
 * @param {string} grupoId
 * @returns {Promise<number>}
 */
export async function syncNCandidato(grupoId) {
  const { data: grupo, error: grupoError } = await supabase
    .from('grupos')
    .select('id, procura_id')
    .eq('id', grupoId)
    .single();

  if (grupoError) throw grupoError;

  const { count, error: countError } = await supabase
    .from('membros_grupo')
    .select('*', { count: 'exact', head: true })
    .eq('grupo_id', grupoId)
    .eq('estado', 'activo');

  if (countError) throw countError;

  const n = count ?? 0;
  if (n < 1) {
    throw new Error('O grupo precisa de pelo menos 1 membro activo.');
  }

  const { error: updateError } = await supabase
    .from('procuras')
    .update({ n_candidato: n, updated_at: new Date().toISOString() })
    .eq('id', grupo.procura_id);

  if (updateError) throw updateError;

  return n;
}

/**
 * @param {string} grupoId
 * @param {{
 *   passenger_id: string,
 *   pickup_name?: string,
 *   pickup_lat?: number,
 *   pickup_lng?: number,
 *   dropoff_name?: string,
 *   dropoff_lat?: number,
 *   dropoff_lng?: number,
 *   ordem_insercao?: number,
 * }} membro
 */
export async function addMembroGrupo(grupoId, membro) {
  if (!membro?.passenger_id) {
    throw new Error('passenger_id é obrigatório.');
  }

  const { data, error } = await supabase
    .from('membros_grupo')
    .insert([
      {
        grupo_id: grupoId,
        passenger_id: membro.passenger_id,
        pickup_name: membro.pickup_name ?? null,
        pickup_lat: membro.pickup_lat ?? null,
        pickup_lng: membro.pickup_lng ?? null,
        dropoff_name: membro.dropoff_name ?? null,
        dropoff_lat: membro.dropoff_lat ?? null,
        dropoff_lng: membro.dropoff_lng ?? null,
        ordem_insercao: membro.ordem_insercao ?? 0,
        estado: 'activo',
      },
    ])
    .select()
    .single();

  if (error) throw error;

  await syncNCandidato(grupoId);
  return data;
}
