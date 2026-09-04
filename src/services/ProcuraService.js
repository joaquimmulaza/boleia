import { supabase } from '../lib/supabase';

/**
 * @param {object} formData
 */
export async function createProcura(formData) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Não autenticado.');
  }

  if (!formData.preferred_time) {
    throw new Error('Horário preferido é obrigatório.');
  }

  const row = {
    owner_id: user.id,
    preferred_time: formData.preferred_time,
    return_time: formData.return_time ?? null,
    origin_name: formData.origin_name ?? null,
    origin_lat: formData.origin_lat ?? null,
    origin_lng: formData.origin_lng ?? null,
    destination_name: formData.destination_name ?? null,
    destination_lat: formData.destination_lat ?? null,
    destination_lng: formData.destination_lng ?? null,
    n_candidato: 1,
    teto_mensal_kz: formData.teto_mensal_kz ?? null,
    estado: 'activa',
  };

  const { data, error } = await supabase
    .from('procuras')
    .insert([row])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * @param {string} ownerId
 */
export async function listProcurasByOwner(ownerId) {
  const { data, error } = await supabase
    .from('procuras')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * @param {string} procuraId
 */
export async function getProcura(procuraId) {
  const { data, error } = await supabase
    .from('procuras')
    .select('*')
    .eq('id', procuraId)
    .single();

  if (error) throw error;
  return data;
}
