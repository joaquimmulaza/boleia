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
 * Cria procura + grupo + membro owner numa única transacção (RPC).
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
 * @param {{
 *   nome?: string | null,
 *   nMaximo?: number,
 *   pickup_name?: string | null,
 *   pickup_lat?: number | null,
 *   pickup_lng?: number | null,
 *   dropoff_name?: string | null,
 *   dropoff_lat?: number | null,
 *   dropoff_lng?: number | null,
 * }} [grupoOpts]
 */
export async function createProcuraWithGrupo(formData, grupoOpts = {}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Não autenticado.');
  }

  if (!formData.preferred_time) {
    throw new Error('Horário preferido é obrigatório.');
  }

  const diasSemana = Array.isArray(formData.dias_semana) && formData.dias_semana.length > 0
    ? formData.dias_semana.map((d) => Number(d)).filter((d) => Number.isFinite(d))
    : [1, 2, 3, 4, 5];

  const { data, error } = await supabase.rpc('create_procura_with_grupo', {
    p_preferred_time: formData.preferred_time,
    p_return_time: formData.return_time ?? null,
    p_origin_name: formData.origin_name ?? null,
    p_origin_lat: formData.origin_lat ?? null,
    p_origin_lng: formData.origin_lng ?? null,
    p_destination_name: formData.destination_name ?? null,
    p_destination_lat: formData.destination_lat ?? null,
    p_destination_lng: formData.destination_lng ?? null,
    p_teto_mensal_kz: formData.teto_mensal_kz ?? null,
    p_dias_semana: diasSemana,
    p_grupo_nome: grupoOpts.nome ?? 'O meu grupo',
    p_n_maximo: grupoOpts.nMaximo ?? 4,
    p_pickup_name: grupoOpts.pickup_name ?? null,
    p_pickup_lat: grupoOpts.pickup_lat ?? null,
    p_pickup_lng: grupoOpts.pickup_lng ?? null,
    p_dropoff_name: grupoOpts.dropoff_name ?? null,
    p_dropoff_lat: grupoOpts.dropoff_lat ?? null,
    p_dropoff_lng: grupoOpts.dropoff_lng ?? null,
  });

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
