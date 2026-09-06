import { supabase } from '../lib/supabase';
import { resolveAgreementPricing } from '../utils/resolveAgreementPricing.js';
import {
  callRpcWithOfflineFallback,
  resolveIdempotencyKey,
} from '../utils/callRpcWithOfflineFallback.js';

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
  const pendingEstados = new Set(['pendente_passageiro', 'pendente_contraparte', 'aceite']);
  const pending =
    rows.find(
      (a) =>
        a &&
        a.applied_at == null &&
        a.superseded_at == null &&
        pendingEstados.has(String(a.estado || '').toLowerCase()),
    ) || null;
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
 * Aplica rescisões com effective_on já atingido (lazy). Best-effort.
 * @param {string | null} [acordoId]
 */
async function applyDueTerminationsBestEffort(acordoId = null) {
  try {
    const res = await supabase.rpc('apply_due_agreement_terminations', {
      p_acordo_id: acordoId,
    });
    if (res?.error) {
      console.warn('Falha ao aplicar rescisões devidas:', res.error.message);
    }
  } catch (err) {
    console.warn('Falha ao aplicar rescisões devidas:', err);
  }
}

/**
 * Aceita proposta via RPC atómica (cria acordo 1:N + congela preços).
 * Só a contraparte pode aceitar (`created_by` bloqueado na RPC).
 * Em falha de rede, enfileira `accept_proposal` com idempotency_key.
 * Quando o grupo cresceu, passar `memberIds` (exactamente N da proposta).
 *
 * @param {string} propostaId
 * @param {{
 *   idempotencyKey?: string,
 *   forceQueue?: boolean,
 *   memberIds?: string[],
 * }} [options]
 */
export async function createAgreementFromProposal(propostaId, options = {}) {
  if (!propostaId) {
    throw new Error('ID da proposta é obrigatório.');
  }

  const idempotencyKey = resolveIdempotencyKey(options.idempotencyKey);
  /** @type {Record<string, unknown>} */
  const rpcArgs = {
    p_proposta_id: propostaId,
    p_idempotency_key: idempotencyKey,
  };
  if (Array.isArray(options.memberIds) && options.memberIds.length > 0) {
    rpcArgs.p_member_ids = options.memberIds;
  }

  return callRpcWithOfflineFallback({
    rpc: 'accept_proposal',
    rpcArgs,
    options: { ...options, idempotencyKey },
    sessionErrorMessage: 'Sessão necessária para guardar o aceite offline.',
    rpcErrorMessage: 'Falha ao aceitar proposta.',
    offlineResult: (key) => ({
      id: propostaId,
      offlineQueued: true,
      idempotency_key: key,
    }),
    afterRpcSuccess: async (acordoId) => {
      const { data, error } = await supabase
        .from('acordos')
        .select('*')
        .eq('id', acordoId)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Passageiro sai via RPC atómica: marca `saiu`, reconta vagas da oferta,
 * promove waitlist (best-effort no servidor). Preços / quotas dos restantes
 * não são recalculados.
 * Em falha de rede, enfileira em IndexedDB com idempotency_key e devolve
 * `{ offlineQueued: true, … }` (sincroniza via Background Sync / online).
 *
 * @param {string} acordoId
 * @param {string} passengerId
 * @param {{ idempotencyKey?: string, forceQueue?: boolean }} [options]
 */
export async function leavePassenger(acordoId, passengerId, options = {}) {
  if (!acordoId || !passengerId) {
    throw new Error('acordoId e passengerId são obrigatórios.');
  }

  const idempotencyKey = resolveIdempotencyKey(options.idempotencyKey);
  const rpcArgs = {
    p_acordo_id: acordoId,
    p_passenger_id: passengerId,
    p_idempotency_key: idempotencyKey,
  };

  return callRpcWithOfflineFallback({
    rpc: 'leave_passenger',
    rpcArgs,
    options: { ...options, idempotencyKey },
    sessionErrorMessage: 'Sessão necessária para guardar a saída offline.',
    rpcErrorMessage: 'Falha ao sair do acordo.',
    offlineResult: (key) => ({
      id: acordoId,
      offlineQueued: true,
      idempotency_key: key,
    }),
    afterRpcSuccess: async (acordoIdOut) => {
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
    },
  });
}

/**
 * Adenda: único caminho de serviço para mutar preços / n_passageiros_contrato.
 * Agenda para o 1.º dia do mês seguinte (`effective_from`); o mês corrente
 * mantém cabeçalho e quotas congelados. A adenda fica `pendente_passageiro`
 * até um passageiro activo aceitar (`acceptAgreementAdenda`); só então
 * passa a `aceite` e pode ser aplicada em `effective_from`.
 * Contrato prévio fica em `adenda_pendente.previo_*` (auditável).
 * Default de n_passageiros = COUNT de passageiros activos; se passado, deve
 * coincidir com esse COUNT (MVP — evita fantasmas).
 * Em falha de rede, enfileira `renegotiate_agreement_pricing` com idempotency_key.
 *
 * @param {string} acordoId
 * @param {{
 *   modo_preco: 'POR_PASSAGEIRO' | 'TOTAL_ACORDO',
 *   valor_ask_kz: number,
 *   n_passageiros?: number,
 * }} input
 * @param {{ idempotencyKey?: string, forceQueue?: boolean }} [options]
 * @returns {Promise<object>} acordo live + `adenda_pendente` (ou `{ offlineQueued: true, … }`)
 */
export async function renegotiateAgreementPricing(acordoId, input, options = {}) {
  if (!acordoId) {
    throw new Error('ID do acordo é obrigatório.');
  }
  if (!input || !input.modo_preco || input.valor_ask_kz == null) {
    throw new Error('modo_preco e valor_ask_kz são obrigatórios.');
  }

  let nPassageiros = input.n_passageiros;
  if (nPassageiros == null) {
    if (options.forceQueue || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
      throw new Error('n_passageiros é obrigatório para renegociar offline.');
    }
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

  const idempotencyKey = resolveIdempotencyKey(options.idempotencyKey);
  const rpcArgs = {
    p_acordo_id: acordoId,
    p_modo_preco: input.modo_preco,
    p_valor_ask_kz: input.valor_ask_kz,
    p_n_passageiros: nPassageiros,
    p_idempotency_key: idempotencyKey,
  };

  return callRpcWithOfflineFallback({
    rpc: 'renegotiate_agreement_pricing',
    rpcArgs,
    options: { ...options, idempotencyKey },
    sessionErrorMessage: 'Sessão necessária para guardar a renegociação offline.',
    rpcErrorMessage: 'Falha ao renegociar preço do acordo.',
    offlineResult: (key) => ({
      id: acordoId,
      offlineQueued: true,
      idempotency_key: key,
    }),
    afterRpcSuccess: async (acordoIdOut) => {
      const id = acordoIdOut ?? acordoId;
      const { data, error } = await supabase
        .from('acordos')
        .select('*, acordos_adendas(*)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return withPendingAdenda(data);
    },
  });
}

/**
 * Passageiro activo aceita adenda pendente (`pendente_passageiro` → `aceite`).
 * Não aplica preços antes de `effective_from` (lazy `apply_due_agreement_adendas`).
 * Motorista / criador da adenda não pode aceitar.
 * Em falha de rede, enfileira `accept_agreement_adenda` com idempotency_key.
 *
 * @param {string} adendaId
 * @param {{ idempotencyKey?: string, forceQueue?: boolean }} [options]
 * @returns {Promise<object>} linha `acordos_adendas` actualizada (ou `{ offlineQueued: true, … }`)
 */
export async function acceptAgreementAdenda(adendaId, options = {}) {
  if (!adendaId) {
    throw new Error('ID da adenda é obrigatório.');
  }

  const idempotencyKey = resolveIdempotencyKey(options.idempotencyKey);
  const rpcArgs = {
    p_adenda_id: adendaId,
    p_idempotency_key: idempotencyKey,
  };

  return callRpcWithOfflineFallback({
    rpc: 'accept_agreement_adenda',
    rpcArgs,
    options: { ...options, idempotencyKey },
    sessionErrorMessage: 'Sessão necessária para guardar o aceite da adenda offline.',
    rpcErrorMessage: 'Falha ao aceitar a adenda.',
    offlineResult: (key) => ({
      id: adendaId,
      offlineQueued: true,
      idempotency_key: key,
    }),
    afterRpcSuccess: async (adendaIdOut) => {
      const id = adendaIdOut ?? adendaId;
      const { data, error } = await supabase
        .from('acordos_adendas')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Contraparte rejeita adenda pendente (`pendente_passageiro` → `rejeitada`).
 * Preços activos do acordo mantêm-se. Em falha de rede, enfileira a RPC.
 *
 * @param {string} adendaId
 * @param {{ idempotencyKey?: string, forceQueue?: boolean }} [options]
 * @returns {Promise<object>}
 */
export async function rejectAgreementAdenda(adendaId, options = {}) {
  if (!adendaId) {
    throw new Error('ID da adenda é obrigatório.');
  }

  const idempotencyKey = resolveIdempotencyKey(options.idempotencyKey);
  // Contrato DB actual: reject_agreement_adenda(p_adenda_id) — sem p_idempotency_key.
  const rpcArgs = {
    p_adenda_id: adendaId,
  };

  return callRpcWithOfflineFallback({
    rpc: 'reject_agreement_adenda',
    rpcArgs,
    options: { ...options, idempotencyKey },
    sessionErrorMessage: 'Sessão necessária para guardar a rejeição da adenda offline.',
    rpcErrorMessage: 'Falha ao rejeitar a adenda.',
    offlineResult: (key) => ({
      id: adendaId,
      offlineQueued: true,
      idempotency_key: key,
    }),
    afterRpcSuccess: async (adendaIdOut) => {
      const id = adendaIdOut ?? adendaId;
      const { data, error } = await supabase
        .from('acordos_adendas')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Rescisão contratual via RPC `terminate_agreement` (consensual, aviso prévio, justa causa).
 * Em falha de rede, enfileira a RPC com idempotency_key.
 *
 * @param {string} acordoId
 * @param {{
 *   modo: 'consensual' | 'aviso_previo' | 'justa_causa',
 *   justificativa?: 'faltas_excessivas' | 'avaria_veiculo' | 'seguranca',
 * }} input
 * @param {{ idempotencyKey?: string, forceQueue?: boolean }} [options]
 * @returns {Promise<object>}
 */
export async function terminateAgreement(acordoId, input, options = {}) {
  if (!acordoId) {
    throw new Error('ID do acordo é obrigatório.');
  }
  const modo = String(input?.modo || '').toLowerCase();
  if (!['consensual', 'aviso_previo', 'justa_causa'].includes(modo)) {
    throw new Error('Modo de rescisão inválido.');
  }

  const idempotencyKey = resolveIdempotencyKey(options.idempotencyKey);
  /** @type {Record<string, unknown>} */
  const rpcArgs = {
    p_acordo_id: acordoId,
    p_modo: modo,
    p_idempotency_key: idempotencyKey,
  };
  if (input.justificativa) {
    rpcArgs.p_justificativa = input.justificativa;
  }

  return callRpcWithOfflineFallback({
    rpc: 'terminate_agreement',
    rpcArgs,
    options: { ...options, idempotencyKey },
    sessionErrorMessage: 'Sessão necessária para guardar a rescisão offline.',
    rpcErrorMessage: 'Falha ao rescindir o acordo.',
    offlineResult: (key) => ({
      id: acordoId,
      offlineQueued: true,
      idempotency_key: key,
    }),
    afterRpcSuccess: async (acordoIdOut) => {
      const id = acordoIdOut ?? acordoId;
      const { data, error } = await supabase
        .from('acordos')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

/**
 * @param {string} driverId
 */
export async function getAgreementsForDriver(driverId) {
  await applyDueAdendasBestEffort(null);
  await applyDueTerminationsBestEffort(null);

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
  await applyDueTerminationsBestEffort(null);

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
