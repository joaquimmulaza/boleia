import { supabase } from '../lib/supabase';

export const requestSeat = async (routeId, passengerId) => {
  const { data, error } = await supabase
    .from('acordos')
    .insert([{ route_id: routeId, passenger_id: passengerId, estado: 'Pendente' }])
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
    .select('route_id')
    .eq('id', agreementId)
    .single();

  if (selectError) throw selectError;

  // Use the atomic RPC call instead of vulnerable SELECT + UPDATE
  const { error: rpcError } = await supabase.rpc('decrement_available_seats', {
    route_id_param: agreementData.route_id,
  });

  if (rpcError) throw rpcError;

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
