import { supabase } from '../lib/supabase';

/**
 * Entra na lista de espera (não consome vaga; sem auto-aceitar).
 * @param {{ oferta_id: string, procura_id: string, grupo_id?: string | null }} input
 */
export async function enqueueWaitlist(input) {
  if (!input?.oferta_id || !input?.procura_id) {
    throw new Error('oferta_id e procura_id são obrigatórios.');
  }

  const { data, error } = await supabase
    .from('lista_espera')
    .insert([
      {
        oferta_id: input.oferta_id,
        procura_id: input.procura_id,
        grupo_id: input.grupo_id ?? null,
        estado: 'activa',
      },
    ])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Esta procura já está na lista de espera desta oferta.');
    }
    throw error;
  }
  return data;
}

/**
 * @param {string} ofertaId
 */
export async function listWaitlistByOferta(ofertaId) {
  const { data, error } = await supabase
    .from('lista_espera')
    .select('*')
    .eq('oferta_id', ofertaId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * @param {string} procuraId
 */
export async function listWaitlistByProcura(procuraId) {
  const { data, error } = await supabase
    .from('lista_espera')
    .select('*')
    .eq('procura_id', procuraId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Promove o 1º da lista de espera (FIFO) quando há vaga libertada.
 * Marca `notificada` + cria notif `waitlist_promoted` — **não** auto-aceita.
 * @param {string} ofertaId
 * @returns {Promise<{ id: string, oferta_id: string, estado: 'notificada' } | null>}
 */
export async function promoteWaitlist(ofertaId) {
  if (!ofertaId) {
    throw new Error('oferta_id é obrigatório.');
  }

  const { data, error } = await supabase.rpc('promote_waitlist', {
    p_oferta_id: ofertaId,
  });

  if (error) throw error;
  if (!data) return null;

  return {
    id: data,
    oferta_id: ofertaId,
    estado: 'notificada',
  };
}
