import { supabase } from '../lib/supabase';

/**
 * Publica um novo trajeto no sistema.
 * @param {Object} formData - Dados do formulário de trajeto
 * @returns {Promise<{success: boolean}>}
 */
export const publishRoute = async (formData) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Não autenticado');
  }

  const routeData = {
    driver_id: user.id,
    origin_name: formData.origin_name,
    origin_lat: formData.origin_lat,
    origin_lng: formData.origin_lng,
    destination_name: formData.destination_name,
    destination_lat: formData.destination_lat,
    destination_lng: formData.destination_lng,
    departure_time: formData.departure_time,
    return_time: formData.return_time,
    available_seats: parseInt(formData.available_seats, 10),
    monthly_price_per_seat: parseFloat(formData.monthly_price_per_seat)
  };

  const { error } = await supabase.from('routes').insert([routeData]);

  if (error) {
    throw error;
  }

  return { success: true };
};
