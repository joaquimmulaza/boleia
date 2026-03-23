import { supabase } from '../lib/supabase';

export const requestSeat = async (routeId, passengerId) => {
  const { data, error } = await supabase
    .from('acordos')
    .insert([{ id_rota: routeId, id_passageiro: passengerId, estado: 'Pendente' }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const approveAgreement = async (agreementId) => {
  const { error: updateError } = await supabase
    .from('acordos')
    .update({ estado: 'Ativo' })
    .eq('id', agreementId);

  if (updateError) throw updateError;

  const { data: agreementData, error: selectError } = await supabase
    .from('acordos')
    .select('id_rota')
    .eq('id', agreementId)
    .single();

  if (selectError) throw selectError;

  const { data: routeData, error: routeError } = await supabase
    .from('routes')
    .select('available_seats')
    .eq('id', agreementData.id_rota)
    .single();

  if (routeError) throw routeError;

  const { error: updateRouteError } = await supabase
    .from('routes')
    .update({ available_seats: routeData.available_seats - 1 })
    .eq('id', agreementData.id_rota);

  if (updateRouteError) throw updateRouteError;

  return true;
};

export const rejectAgreement = async (agreementId) => {
  const { error } = await supabase
    .from('acordos')
    .update({ estado: 'Cancelado' })
    .eq('id', agreementId);

  if (error) throw error;
  return true;
};
