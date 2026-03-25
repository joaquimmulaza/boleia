import { supabase } from '../lib/supabase';

export const requestSeat = async (routeId, passengerId) => {
  const { data, error } = await supabase
    .from('acordos')
    .insert([{ route_id: routeId, passenger_id: passengerId, estado: 'Pendente' }])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Já solicitou uma vaga para esta rota.');
    }
    throw error;
  }
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

export const hideAgreement = async (agreementId) => {
  const { error } = await supabase.from("acordos").update({ is_hidden_by_user: true }).eq("id", agreementId);
  if (error) throw error;
  return true;
};

export const getAgreementsForUser = async (userId, userRole) => {
  try {
    let query = supabase.from('acordos').select(`
      id,
      is_hidden_by_user,
      estado,
      route_id,
      passenger_id,
      is_hidden_by_user,
      routes:route_id (
        id,
      is_hidden_by_user,
        origin_name,
        destination_name,
        departure_time,
        monthly_price_per_seat,
        driver_id
      ),
      passenger:passenger_id (
        id,
      is_hidden_by_user,
        nome_completo,
        telefone
      )
    `);

    let acordosData = [];

    if (userRole === 'Motorista') {
      // 1. Fetch routes owned by the driver
      const { data: rotasMotorista, error: rotasError } = await supabase
        .from('routes')
        .select('id')
        .eq('driver_id', userId);

      if (rotasError) throw rotasError;

      const rotaIds = rotasMotorista?.map(r => r.id) || [];

      if (rotaIds.length > 0) {
        // 2. Fetch agreements for those routes
        const { data, error } = await query.in('route_id', rotaIds);
        if (error) throw error;
        acordosData = data || [];

        return acordosData.map(acordo => ({
          ...acordo,
          contraparte: acordo.passenger || { nome_completo: 'Passageiro (Sem nome)', telefone: 'N/A' }
        }));
      } else {
        return [];
      }
    } else {
      // Passageiro
      const { data, error } = await query.eq('passenger_id', userId);
      if (error) throw error;
      acordosData = data || [];

      const driverIds = [...new Set(acordosData.map(a => a.routes?.driver_id).filter(Boolean))];

      let driversMap = {};
      let vehiclesMap = {};

      if (driverIds.length > 0) {
         const { data: driversData, error: driversError } = await supabase
           .from('perfis')
           .select('id, nome_completo, telefone')
           .in('id', driverIds);

         if (!driversError && driversData) {
           driversData.forEach(d => driversMap[d.id] = d);
         }

         const { data: vehiclesData, error: vehiclesError } = await supabase
           .from('veiculos')
           .select('id, marca_modelo, matricula, id_motorista')
           .in('id_motorista', driverIds);

         if (!vehiclesError && vehiclesData) {
           vehiclesData.forEach(v => vehiclesMap[v.id_motorista] = v);
         }
      }

      return acordosData.map(acordo => {
         const driverId = acordo.routes?.driver_id;
         const driverData = driverId ? driversMap[driverId] : null;
         const vehicleData = driverId ? vehiclesMap[driverId] : null;

         return {
           ...acordo,
           contraparte: driverData || { nome_completo: 'Motorista (Sem nome)', telefone: 'N/A' },
           veiculo: vehicleData || null
         };
      });
    }
  } catch (error) {
    console.error('Error fetching agreements:', error);
    throw error;
  }
};


export const cancelAgreement = async (agreementId, routeId) => {
  const { error: updateError } = await supabase
    .from('acordos')
    .update({ estado: 'Cancelado' })
    .eq('id', agreementId);

  if (updateError) throw updateError;

  const { error: rpcError } = await supabase.rpc('increment_available_seats', {
    route_id_param: routeId,
  });

  if (rpcError) throw rpcError;

  return true;
};
