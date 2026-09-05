import { supabase } from '../lib/supabase';

/**
 * Cria procura individual (N_candidato = 1).
 * Persiste `dias_semana` (1=Seg…7=Dom); default Seg–Sex se omitido/vazio.
 * @param {{
 *   preferred_time: string,
 *   return_time?: string | null,
 *   origin_name?: string | null,
 *   origin_lat?: number | null,
 *   origin_lng?: number | null,
 *   destination_name?: string | null,
 *   destination_lat?: number | null,
 *   destination_lng?: number | null,
 *   teto_mensal_kz?: number | null,
 *   dias_semana?: number[] | null,
 * }} formData
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
    /** Dias 1=Seg … 7=Dom; default Seg–Sex (alinhado a ofertas_capacidade). */
    dias_semana: Array.isArray(formData.dias_semana) && formData.dias_semana.length > 0
      ? formData.dias_semana.map((d) => Number(d)).filter((d) => Number.isFinite(d))
      : [1, 2, 3, 4, 5],
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
