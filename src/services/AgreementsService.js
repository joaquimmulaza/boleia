import { supabase } from '../lib/supabase';

export const requestSeat = async (routeId, passengerId) => {
  const { data, error } = await supabase
    .from('acordos')
    .insert([{ route_id: routeId, passenger_id: passengerId, estado: 'pendente' }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const approveAgreement = async (agreementId) => {
  const { error: updateError } = await supabase
    .from('acordos')
    .update({ estado: 'ativo' })
    .eq('id', agreementId);

  if (updateError) throw updateError;

  const { data: agreementData, error: selectError } = await supabase
    .from('acordos')
    .select('route_id')
    .eq('id', agreementId)
    .single();

  if (selectError) throw selectError;

  const { data: routeData, error: routeError } = await supabase
    .from('routes')
    .select('available_seats')
    .eq('id', agreementData.route_id)
    .single();

  if (routeError) throw routeError;

  const { error: updateRouteError } = await supabase
    .from('routes')
    .update({ available_seats: routeData.available_seats - 1 })
    .eq('id', agreementData.route_id);

  if (updateRouteError) throw updateRouteError;

  return true;
};

export const rejectAgreement = async (agreementId) => {
  const { error } = await supabase
    .from('acordos')
    .update({ estado: 'cancelado' })
    .eq('id', agreementId);

  if (error) throw error;
  return true;
};
