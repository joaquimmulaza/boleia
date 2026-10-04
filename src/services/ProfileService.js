import { supabase } from '../lib/supabase';
import { validateTelefone } from '../utils/validation';

/**
 * Normaliza telefone angolano para E.164 (+244…).
 * @param {string} tel
 * @returns {string}
 */
function toE164Angola(tel) {
  const clean = String(tel).replace(/[\s-]/g, '');
  if (clean.startsWith('+244')) return clean;
  if (/^9\d{8}$/.test(clean)) return `+244${clean}`;
  return clean;
}

/**
 * Procura um perfil pelo telefone (para adicionar colegas ao grupo).
 * @param {string} telefone
 * @returns {Promise<{ id: string, nome_completo?: string }>}
 */
export async function findPassageiroByTelefone(telefone) {
  if (!validateTelefone(telefone)) {
    throw new Error('Número de telefone inválido. Use o formato: 9XXXXXXXX ou +244 9XXXXXXXX.');
  }

  const e164 = toE164Angola(telefone);
  const { data, error } = await supabase.rpc('lookup_perfil_por_telefone', {
    p_telefone: e164,
  });

  if (error) throw error;
  if (!data?.id) {
    throw new Error('Não encontrámos nenhum utilizador com este telefone.');
  }
  return { id: data.id, nome_completo: data.nome_completo };
}

export const getProfile = async (userId) => {
  const { data, error } = await supabase
    .from('perfis')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;

  const { is_admin: _isAdmin, ...resto } = data;
  const { data: authData } = await supabase.auth.getUser();
  if (authData?.user?.id !== userId) {
    return resto;
  }

  const { data: contacto, error: contactoError } = await supabase.rpc('get_own_perfil_contacto');
  if (contactoError) throw contactoError;

  return {
    ...resto,
    telefone: contacto?.telefone ?? null,
    iban: contacto?.iban ?? null,
  };
};

export const updateProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from('perfis')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getVehicle = async (userId) => {
  const { data, error } = await supabase
    .from('veiculos')
    .select('*')
    .eq('id_motorista', userId)
    .single();

  if (error && error.code !== 'PGRST116') { // Ignore row not found
      throw error;
  }
  return data;
};

export const updateVehicle = async (userId, vehicleId, updates) => {
  if (vehicleId) {
      const { data, error } = await supabase
        .from('veiculos')
        .update(updates)
        .eq('id', vehicleId)
        .select()
        .single();
      if (error) throw error;
      return data;
  } else {
      const { data, error } = await supabase
        .from('veiculos')
        .insert([{ ...updates, id_motorista: userId }])
        .select()
        .single();
      if (error) throw error;
      return data;
  }
};
