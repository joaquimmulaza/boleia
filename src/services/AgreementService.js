import { supabase } from '../lib/supabase';
import { resolveAgreementPricing } from '../utils/resolveAgreementPricing.js';
import { promoteWaitlist } from './WaitlistService.js';

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
 * Passageiro sai: liberta 1 vaga; preços do cabeçalho e quotas dos restantes
 * ficam intactos (sem recálculo por N_activos).
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

  const { data: activosAntes, error: quotasAntesError } = await supabase
    .from('acordos_passageiros')
    .select('passenger_id, quota_mensal_kz, estado')
    .eq('acordo_id', acordoId)
    .eq('estado', 'activo');

  if (quotasAntesError) throw quotasAntesError;

  /** @type {Record<string, number>} */
  const quotasRestantesAntes = {};
  for (const row of activosAntes || []) {
    if (row.passenger_id !== passengerId) {
      quotasRestantesAntes[row.passenger_id] = row.quota_mensal_kz;
    }
  }

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

  const { data: activosDepois, error: quotasDepoisError } = await supabase
    .from('acordos_passageiros')
    .select('passenger_id, quota_mensal_kz, estado')
    .eq('acordo_id', acordoId)
    .eq('estado', 'activo');

  if (quotasDepoisError) throw quotasDepoisError;

  for (const row of activosDepois || []) {
    if (quotasRestantesAntes[row.passenger_id] !== row.quota_mensal_kz) {
      throw new Error(
        'Invariante violado: saída não pode alterar quotas dos restantes.',
      );
    }
  }

  // Promoção waitlist = notificação (sem auto-aceitar); best-effort após leave.
  try {
    await promoteWaitlist(antes.oferta_id);
  } catch (promoteError) {
    console.error('Erro ao promover lista de espera:', promoteError);
  }

  return depois;
}

/**
 * Adenda: único caminho de serviço para mutar preços / n_passageiros_contrato.
 * Default de n_passageiros = COUNT de passageiros activos; se passado, deve
 * coincidir com esse COUNT (MVP — evita fantasmas).
 *
 * @param {string} acordoId
 * @param {{
 *   modo_preco: 'POR_PASSAGEIRO' | 'TOTAL_ACORDO',
 *   valor_ask_kz: number,
 *   n_passageiros?: number,
 * }} input
 */
export async function renegotiateAgreementPricing(acordoId, input) {
  if (!acordoId) {
    throw new Error('ID do acordo é obrigatório.');
  }
  if (!input || !input.modo_preco || input.valor_ask_kz == null) {
    throw new Error('modo_preco e valor_ask_kz são obrigatórios.');
  }

  let nPassageiros = input.n_passageiros;
  if (nPassageiros == null) {
    const { count, error: countError } = await supabase
      .from('acordos_passageiros')
      .select('*', { count: 'exact', head: true })
      .eq('acordo_id', acordoId)
      .eq('estado', 'activo');

    if (countError) throw countError;
    nPassageiros = count ?? 0;
  }

  // Validação client-side espelhada da RPC (POR_PASSAGEIRO / TOTAL + resto).
  resolveAgreementPricing({
    modo_preco: input.modo_preco,
    valor_ask_kz: input.valor_ask_kz,
    n_passageiros: nPassageiros,
  });

  const { data: acordoIdOut, error: rpcError } = await supabase.rpc(
    'renegotiate_agreement_pricing',
    {
      p_acordo_id: acordoId,
      p_modo_preco: input.modo_preco,
      p_valor_ask_kz: input.valor_ask_kz,
      p_n_passageiros: nPassageiros,
    },
  );

  if (rpcError) {
    throw new Error(rpcError.message || 'Falha ao renegociar preço do acordo.');
  }

  const id = acordoIdOut ?? acordoId;
  const { data, error } = await supabase
    .from('acordos')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
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
