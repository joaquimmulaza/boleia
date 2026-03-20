import { supabase } from '../lib/supabase';

export const getProfile = async (userId) => {
  const { data, error } = await supabase
    .from('perfis')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
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
