import { supabase } from '../lib/supabase';
import { resolveAgreementPricing } from '../utils/resolveAgreementPricing.js';

/**
 * Normaliza acordo: expõe `adenda_pendente` (não aplicada / não supersedida).
 * @param {object | null | undefined} acordo
 * @returns {object | null | undefined}
 */
function withPendingAdenda(acordo) {
  if (!acordo) return acordo;
  const { acordos_adendas, adenda_pendente, ...rest } = acordo;
  if (adenda_pendente !== undefined) {
    return { ...rest, adenda_pendente };
  }
  const rows = Array.isArray(acordos_adendas) ? acordos_adendas : [];
  const pending =
    rows.find((a) => a && a.applied_at == null && a.superseded_at == null) || null;
  return { ...rest, adenda_pendente: pending };
}

/**
 * Aplica adendas com effective_from já atingido (lazy). Best-effort —
 * não bloqueia listagens se a RPC falhar.
 * @param {string | null} [acordoId]
 */
async function applyDueAdendasBestEffort(acordoId = null) {
  try {
    const res = await supabase.rpc('apply_due_agreement_adendas', {
      p_acordo_id: acordoId,
    });
    if (res?.error) {
      console.warn('Falha ao aplicar adendas devidas:', res.error.message);
    }
  } catch (err) {
    console.warn('Falha ao aplicar adendas devidas:', err);
  }
}

/**
 * Aceita proposta via RPC atómica (cria acordo 1:N + congela preços).
 * Só a contraparte pode aceitar (`created_by` bloqueado na RPC).
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
 * Passageiro sai via RPC atómica: marca `saiu`, reconta vagas da oferta,
 * promove waitlist (best-effort no servidor). Preços / quotas dos restantes
 * não são recalculados.
 * @param {string} acordoId
 * @param {string} passengerId
 */
export async function leavePassenger(acordoId, passengerId) {
  if (!acordoId || !passengerId) {
    throw new Error('acordoId e passengerId são obrigatórios.');
  }

  const { data: acordoIdOut, error: rpcError } = await supabase.rpc('leave_passenger', {
    p_acordo_id: acordoId,
    p_passenger_id: passengerId,
  });

  if (rpcError) {
    throw new Error(rpcError.message || 'Falha ao sair do acordo.');
  }

  const id = acordoIdOut ?? acordoId;
  const { data, error } = await supabase
    .from('acordos')
    .select(
      'id, oferta_id, valor_mensal_por_passageiro_kz, valor_mensal_total_kz, n_passageiros_contrato',
    )
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Adenda: único caminho de serviço para mutar preços / n_passageiros_contrato.
 * Agenda para o 1.º dia do mês seguinte (`effective_from`); o mês corrente
 * mantém cabeçalho e quotas congelados. Contrato prévio fica em
 * `adenda_pendente.previo_*` (auditável).
 * Default de n_passageiros = COUNT de passageiros activos; se passado, deve
 * coincidir com esse COUNT (MVP — evita fantasmas).
 *
 * @param {string} acordoId
 * @param {{
 *   modo_preco: 'POR_PASSAGEIRO' | 'TOTAL_ACORDO',
 *   valor_ask_kz: number,
 *   n_passageiros?: number,
 * }} input
 * @returns {Promise<object>} acordo live + `adenda_pendente`
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
    .select('*, acordos_adendas(*)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return withPendingAdenda(data);
}

/**
 * @param {string} driverId
 */
export async function getAgreementsForDriver(driverId) {
  await applyDueAdendasBestEffort(null);

  const { data, error } = await supabase
    .from('acordos')
    .select(
      '*, acordos_passageiros(*), ofertas_capacidade(origin_name, destination_name, departure_time), acordos_adendas(*)',
    )
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(withPendingAdenda);
}

/**
 * @param {string} passengerId
 */
export async function getAgreementsForPassenger(passengerId) {
  await applyDueAdendasBestEffort(null);

  const { data, error } = await supabase
    .from('acordos_passageiros')
    .select(
      'acordo_id, estado, acordos(*, ofertas_capacidade(origin_name, destination_name, departure_time), acordos_adendas(*))',
    )
    .eq('passenger_id', passengerId)
    .eq('estado', 'activo');

  if (error) throw error;
  return (data || [])
    .map((row) => row.acordos)
    .filter(Boolean)
    .map(withPendingAdenda);
}
