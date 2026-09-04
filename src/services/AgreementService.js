import { supabase } from '../lib/supabase';

/**
 * Aceita proposta via RPC atómica (cria acordo 1:N + congela preços).
 * @param {string} propostaId
 */
export async function createAgreementFromProposal(propostaId) {
  if (!propostaId) {
    throw new Error('ID da proposta é obrigatório.');
  }

  const { data: acordoId, error: rpcError } = await supabase.rpc('accept_proposal', {
    p_proposta_id: propostaId,
  });

  if (rpcError) {
    throw new Error(rpcError.message || 'Falha ao aceitar proposta.');
  }

  const { data, error } = await supabase
    .from('acordos')
    .select('*')
    .eq('id', acordoId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Passageiro sai: liberta 1 vaga; preços do cabeçalho ficam intactos (sem recálculo).
 * @param {string} acordoId
 * @param {string} passengerId
 */
export async function leavePassenger(acordoId, passengerId) {
  if (!acordoId || !passengerId) {
    throw new Error('acordoId e passengerId são obrigatórios.');
  }

  const { data: antes, error: antesError } = await supabase
    .from('acordos')
    .select(
      'id, oferta_id, valor_mensal_por_passageiro_kz, valor_mensal_total_kz, n_passageiros_contrato',
    )
    .eq('id', acordoId)
    .single();

  if (antesError) throw antesError;

  const { error: leaveError } = await supabase
    .from('acordos_passageiros')
    .update({ estado: 'saiu' })
    .eq('acordo_id', acordoId)
    .eq('passenger_id', passengerId);

  if (leaveError) throw leaveError;

  const { data: oferta, error: ofertaError } = await supabase
    .from('ofertas_capacidade')
    .select('id, vagas_totais, vagas_disponiveis')
    .eq('id', antes.oferta_id)
    .single();

  if (ofertaError) throw ofertaError;

  const disponiveis = Math.min(oferta.vagas_totais, (oferta.vagas_disponiveis ?? 0) + 1);
  const estadoOferta =
    disponiveis <= 0
      ? 'cheia'
      : disponiveis < oferta.vagas_totais
        ? 'parcial'
        : 'disponivel';

  const { error: updateOfertaError } = await supabase
    .from('ofertas_capacidade')
    .update({
      vagas_disponiveis: disponiveis,
      estado: estadoOferta,
      updated_at: new Date().toISOString(),
    })
    .eq('id', oferta.id);

  if (updateOfertaError) throw updateOfertaError;

  const { data: depois, error: depoisError } = await supabase
    .from('acordos')
    .select(
      'id, oferta_id, valor_mensal_por_passageiro_kz, valor_mensal_total_kz, n_passageiros_contrato',
    )
    .eq('id', acordoId)
    .single();

  if (depoisError) throw depoisError;

  if (
    depois.valor_mensal_por_passageiro_kz !== antes.valor_mensal_por_passageiro_kz ||
    depois.valor_mensal_total_kz !== antes.valor_mensal_total_kz ||
    depois.n_passageiros_contrato !== antes.n_passageiros_contrato
  ) {
    throw new Error('Invariante violado: saída não pode alterar preços do acordo.');
  }

  return depois;
}

/**
 * @param {string} driverId
 */
export async function getAgreementsForDriver(driverId) {
  const { data, error } = await supabase
    .from('acordos')
    .select('*, acordos_passageiros(*), ofertas_capacidade(origin_name, destination_name, departure_time)')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * @param {string} passengerId
 */
export async function getAgreementsForPassenger(passengerId) {
  const { data, error } = await supabase
    .from('acordos_passageiros')
    .select('acordo_id, estado, acordos(*, ofertas_capacidade(origin_name, destination_name, departure_time))')
    .eq('passenger_id', passengerId)
    .eq('estado', 'activo');

  if (error) throw error;
  return (data || []).map((row) => row.acordos).filter(Boolean);
}
