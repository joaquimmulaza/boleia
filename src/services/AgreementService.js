import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import { resolveAgreementPricing } from '../utils/resolveAgreementPricing.js';
import { enqueueRpc, isNetworkFailure, listPending } from './offlineQueue.js';

/**
 * Modos de rescisão aceites pela RPC `terminate_agreement`.
 * @type {readonly ('aviso_previo' | 'consensual' | 'justa_causa')[]}
 */
export const RESCISAO_MODOS = Object.freeze([
  'aviso_previo',
  'consensual',
  'justa_causa',
]);

/**
 * Justificativas válidas para rescisão por justa causa.
 * @type {readonly ('faltas_excessivas' | 'avaria_veiculo' | 'seguranca')[]}
 */
export const RESCISAO_JUSTIFICATIVAS = Object.freeze([
  'faltas_excessivas',
  'avaria_veiculo',
  'seguranca',
]);

/**
 * @typedef {Object} RescisaoInput
 * @property {'aviso_previo' | 'consensual' | 'justa_causa'} modo
 * @property {'faltas_excessivas' | 'avaria_veiculo' | 'seguranca'} [justificativa]
 */

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
 * Aplica rescisões com `rescisao_effective_on` já atingido (lazy dia 1).
 * Best-effort — nunca bloqueia listagens.
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
 * Liquidação lazy do ciclo de vida (adendas + rescisões) antes de listar acordos.
 * @param {string | null} [acordoId]
 */
async function applyDueLifecycleBestEffort(acordoId = null) {
  await applyDueAdendasBestEffort(acordoId);
  await applyDueTerminationsBestEffort(acordoId);
}

/**
 * Divisor congelado do contrato (`n_passageiros_contrato`). A RPC recusa
 * qualquer `p_n_passageiros` divergente, por isso o cliente nunca deriva o
 * divisor do número de passageiros activos.
 * @param {string} acordoId
 * @returns {Promise<number>}
 */
async function fetchContractDivisor(acordoId) {
  const { data, error } = await supabase
    .from('acordos')
    .select('n_passageiros_contrato')
    .eq('id', acordoId)
    .single();

  if (error) throw error;

  const n = data?.n_passageiros_contrato;
  if (!Number.isInteger(n) || n < 1) {
    throw new Error('Este acordo não tem um número de passageiros válido no contrato.');
  }
  return n;
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

  const idempotencyKey = options.idempotencyKey || uuidv4();
  /** @type {Record<string, unknown>} */
  const rpcArgs = {
    p_proposta_id: propostaId,
    p_idempotency_key: idempotencyKey,
  };
  if (Array.isArray(options.memberIds) && options.memberIds.length > 0) {
    rpcArgs.p_member_ids = options.memberIds;
  }

  const queueAccept = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      throw new Error('Sessão necessária para guardar o aceite offline.');
    }
    await enqueueRpc({
      rpc: 'accept_proposal',
      args: rpcArgs,
      accessToken,
      idempotencyKey,
    });
    return {
      id: propostaId,
      offlineQueued: true,
      idempotency_key: idempotencyKey,
    };
  };

  if (options.forceQueue || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return queueAccept();
  }

  try {
    const { data: acordoId, error: rpcError } = await supabase.rpc(
      'accept_proposal',
      rpcArgs,
    );

    if (rpcError) {
      if (isNetworkFailure(rpcError)) {
        return queueAccept();
      }
      throw new Error(rpcError.message || 'Falha ao aceitar proposta.');
    }

    const { data, error } = await supabase
      .from('acordos')
      .select('*')
      .eq('id', acordoId)
      .single();

    if (error) {
      if (isNetworkFailure(error)) {
        return queueAccept();
      }
      throw error;
    }
    return data;
  } catch (err) {
    if (isNetworkFailure(err)) {
      return queueAccept();
    }
    throw err;
  }
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

  const idempotencyKey = options.idempotencyKey || uuidv4();
  const rpcArgs = {
    p_acordo_id: acordoId,
    p_passenger_id: passengerId,
    p_idempotency_key: idempotencyKey,
  };

  const queueLeave = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      throw new Error('Sessão necessária para guardar a saída offline.');
    }
    await enqueueRpc({
      rpc: 'leave_passenger',
      args: rpcArgs,
      accessToken,
      idempotencyKey,
    });
    return {
      id: acordoId,
      offlineQueued: true,
      idempotency_key: idempotencyKey,
    };
  };

  if (options.forceQueue || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return queueLeave();
  }

  try {
    const { data: acordoIdOut, error: rpcError } = await supabase.rpc(
      'leave_passenger',
      rpcArgs,
    );

    if (rpcError) {
      if (isNetworkFailure(rpcError)) {
        return queueLeave();
      }
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

    if (error) {
      if (isNetworkFailure(error)) {
        return queueLeave();
      }
      throw error;
    }
    return data;
  } catch (err) {
    if (isNetworkFailure(err)) {
      return queueLeave();
    }
    throw err;
  }
}

/**
 * Submete uma adenda de preço (proposta bilateral: motorista **ou** passageiro
 * activo). Agenda para o 1.º dia do mês seguinte (`effective_from`); o mês
 * corrente mantém cabeçalho e valores congelados. O estado inicial é derivado
 * no servidor a partir de quem propõe (`pendente_passageiro` quando é o
 * motorista, `pendente_contraparte` quando é o passageiro) e só a contraparte
 * decide. O divisor é sempre `acordos.n_passageiros_contrato`.
 *
 * @param {'renegotiate_agreement_pricing' | 'propose_agreement_adenda'} rpcName
 * @param {string} acordoId
 * @param {{
 *   modo_preco: 'POR_PASSAGEIRO' | 'TOTAL_ACORDO',
 *   valor_ask_kz: number,
 *   n_passageiros?: number,
 * }} input
 * @param {{ idempotencyKey?: string, forceQueue?: boolean }} options
 * @returns {Promise<object>}
 */
async function submitAgreementAdenda(rpcName, acordoId, input, options) {
  if (!acordoId) {
    throw new Error('ID do acordo é obrigatório.');
  }
  if (!input || !input.modo_preco || input.valor_ask_kz == null) {
    throw new Error('modo_preco e valor_ask_kz são obrigatórios.');
  }

  const offline =
    options.forceQueue || (typeof navigator !== 'undefined' && navigator.onLine === false);

  let nPassageiros = input.n_passageiros;
  if (nPassageiros == null) {
    if (offline) {
      throw new Error('n_passageiros é obrigatório para renegociar offline.');
    }
    nPassageiros = await fetchContractDivisor(acordoId);
  }

  // Validação client-side espelhada da RPC (POR_PASSAGEIRO / TOTAL + resto).
  resolveAgreementPricing({
    modo_preco: input.modo_preco,
    valor_ask_kz: input.valor_ask_kz,
    n_passageiros: nPassageiros,
  });

  const idempotencyKey = options.idempotencyKey || uuidv4();
  const rpcArgs = {
    p_acordo_id: acordoId,
    p_modo_preco: input.modo_preco,
    p_valor_ask_kz: input.valor_ask_kz,
    p_n_passageiros: nPassageiros,
    p_idempotency_key: idempotencyKey,
  };

  const queueAdenda = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      throw new Error('Sessão necessária para guardar a renegociação offline.');
    }
    await enqueueRpc({
      rpc: rpcName,
      args: rpcArgs,
      accessToken,
      idempotencyKey,
    });
    return {
      id: acordoId,
      offlineQueued: true,
      idempotency_key: idempotencyKey,
    };
  };

  if (offline) {
    return queueAdenda();
  }

  try {
    const { data: acordoIdOut, error: rpcError } = await supabase.rpc(rpcName, rpcArgs);

    if (rpcError) {
      if (isNetworkFailure(rpcError)) {
        return queueAdenda();
      }
      throw new Error(rpcError.message || 'Falha ao renegociar preço do acordo.');
    }

    const id = acordoIdOut ?? acordoId;
    const { data, error } = await supabase
      .from('acordos')
      .select('*, acordos_adendas(*)')
      .eq('id', id)
      .single();

    if (error) {
      if (isNetworkFailure(error)) {
        return queueAdenda();
      }
      throw error;
    }
    return withPendingAdenda(data);
  } catch (err) {
    if (isNetworkFailure(err)) {
      return queueAdenda();
    }
    throw err;
  }
}

/**
 * Adenda: único caminho de serviço para mutar preços / número de passageiros
 * do contrato. Agenda para o 1.º dia do mês seguinte (`effective_from`); o mês
 * corrente mantém cabeçalho e valores congelados. A adenda fica pendente até a
 * contraparte decidir (`respondAgreementAdenda`); só então passa a `aceite` e
 * pode ser aplicada em `effective_from`.
 * Contrato prévio fica em `adenda_pendente.previo_*` (auditável).
 * Default do divisor = `acordos.n_passageiros_contrato` (nunca o número de
 * passageiros activos — a RPC recusa divergências).
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
  return submitAgreementAdenda('renegotiate_agreement_pricing', acordoId, input, options);
}

/**
 * Propõe uma adenda de preço pelo alias bilateral `propose_agreement_adenda`.
 * Mesma lógica de `renegotiateAgreementPricing` — existe para o vocabulário da
 * UI bilateral (o passageiro activo também propõe).
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
export async function proposeAgreementAdenda(acordoId, input, options = {}) {
  return submitAgreementAdenda('propose_agreement_adenda', acordoId, input, options);
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

  const idempotencyKey = options.idempotencyKey || uuidv4();
  const rpcArgs = {
    p_adenda_id: adendaId,
    p_idempotency_key: idempotencyKey,
  };

  const queueAcceptAdenda = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      throw new Error('Sessão necessária para guardar o aceite da adenda offline.');
    }
    await enqueueRpc({
      rpc: 'accept_agreement_adenda',
      args: rpcArgs,
      accessToken,
      idempotencyKey,
    });
    return {
      id: adendaId,
      offlineQueued: true,
      idempotency_key: idempotencyKey,
    };
  };

  if (options.forceQueue || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return queueAcceptAdenda();
  }

  try {
    const { data: adendaIdOut, error: rpcError } = await supabase.rpc(
      'accept_agreement_adenda',
      rpcArgs,
    );

    if (rpcError) {
      if (isNetworkFailure(rpcError)) {
        return queueAcceptAdenda();
      }
      throw new Error(rpcError.message || 'Falha ao aceitar a adenda.');
    }

    const id = adendaIdOut ?? adendaId;
    const { data, error } = await supabase
      .from('acordos_adendas')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (isNetworkFailure(error)) {
        return queueAcceptAdenda();
      }
      throw error;
    }
    return data;
  } catch (err) {
    if (isNetworkFailure(err)) {
      return queueAcceptAdenda();
    }
    throw err;
  }
}

/**
 * Contraparte rejeita adenda pendente (`pendente_passageiro` ou
 * `pendente_contraparte` → `rejeitada`). Preços activos do acordo mantêm-se.
 * Em falha de rede, enfileira a RPC.
 *
 * @param {string} adendaId
 * @param {{ idempotencyKey?: string, forceQueue?: boolean }} [options]
 * @returns {Promise<object>}
 */
export async function rejectAgreementAdenda(adendaId, options = {}) {
  if (!adendaId) {
    throw new Error('ID da adenda é obrigatório.');
  }

  const idempotencyKey = options.idempotencyKey || uuidv4();
  // Contrato DB §22: reject_agreement_adenda(p_adenda_id, p_idempotency_key).
  const rpcArgs = {
    p_adenda_id: adendaId,
    p_idempotency_key: idempotencyKey,
  };

  const queueRejectAdenda = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      throw new Error('Sessão necessária para guardar a rejeição da adenda offline.');
    }
    await enqueueRpc({
      rpc: 'reject_agreement_adenda',
      args: rpcArgs,
      accessToken,
      idempotencyKey,
    });
    return {
      id: adendaId,
      offlineQueued: true,
      idempotency_key: idempotencyKey,
    };
  };

  if (options.forceQueue || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return queueRejectAdenda();
  }

  try {
    const { data: adendaIdOut, error: rpcError } = await supabase.rpc(
      'reject_agreement_adenda',
      rpcArgs,
    );

    if (rpcError) {
      if (isNetworkFailure(rpcError)) {
        return queueRejectAdenda();
      }
      throw new Error(rpcError.message || 'Falha ao rejeitar a adenda.');
    }

    const id = adendaIdOut ?? adendaId;
    const { data, error } = await supabase
      .from('acordos_adendas')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (isNetworkFailure(error)) {
        return queueRejectAdenda();
      }
      throw error;
    }
    return data;
  } catch (err) {
    if (isNetworkFailure(err)) {
      return queueRejectAdenda();
    }
    throw err;
  }
}

/** Alias Prompt 3 / audit gaps. */
export const rejectAdenda = rejectAgreementAdenda;

/**
 * Decisão da contraparte sobre uma adenda pendente: aceitar ou rejeitar.
 * O criador da adenda é bloqueado no servidor em ambos os caminhos.
 *
 * @param {string} adendaId
 * @param {boolean} accept `true` aceita, `false` rejeita
 * @param {{ idempotencyKey?: string, forceQueue?: boolean }} [options]
 * @returns {Promise<object>} linha `acordos_adendas` actualizada (ou `{ offlineQueued: true, … }`)
 */
export async function respondAgreementAdenda(adendaId, accept, options = {}) {
  return accept
    ? acceptAgreementAdenda(adendaId, options)
    : rejectAgreementAdenda(adendaId, options);
}

/**
 * Procura na fila offline uma rescisão já enfileirada para o mesmo acordo e
 * modo. Evita que uma repetição do mesmo pedido (ex. utilizador a carregar
 * duas vezes sem rede) chegue ao servidor como uma segunda chamada — no modo
 * consensual isso poderia ser lido como confirmação da contraparte.
 *
 * @param {string} acordoId
 * @param {string} modo
 * @returns {Promise<object | null>}
 */
async function findQueuedTermination(acordoId, modo) {
  try {
    const pendentes = await listPending();
    return (
      pendentes.find(
        (item) =>
          item?.rpc === 'terminate_agreement' &&
          item?.args?.p_acordo_id === acordoId &&
          item?.args?.p_modo === modo,
      ) || null
    );
  } catch (err) {
    console.warn('Falha ao inspeccionar a fila offline de rescisões:', err);
    return null;
  }
}

/**
 * Rescinde o acordo inteiro via RPC `terminate_agreement` (3 modos):
 *
 * - `aviso_previo` — acordo passa a `cancelamento_pendente`; vagas e
 *   passageiros mantêm-se ocupados até `rescisao_effective_on` (1.º dia do mês
 *   seguinte), altura em que `apply_due_agreement_terminations` fecha o acordo.
 * - `consensual` — 1.ª chamada regista o pedido (acordo continua `activo`);
 *   a confirmação da contraparte cancela de imediato. Como a RPC devolve
 *   sempre o mesmo `acordo_id`, o serviço relê o acordo para distinguir os
 *   dois passos (`rescisao_aguarda_confirmacao` vs `rescisao_concluida`).
 * - `justa_causa` — exige justificativa do conjunto permitido; o ajuste
 *   pro-rata dos valores é feito **só** no servidor (excepção A1 de AGENTS §7).
 *
 * Saída individual de um passageiro continua a ser `leavePassenger`.
 * Em falha de rede, enfileira `terminate_agreement` com idempotency_key.
 *
 * @param {string} acordoId
 * @param {RescisaoInput} input
 * @param {{ idempotencyKey?: string, forceQueue?: boolean }} [options]
 * @returns {Promise<object>} acordo relido + `rescisao_aguarda_confirmacao` /
 *   `rescisao_concluida` (ou `{ offlineQueued: true, … }`)
 */
export async function terminateAgreement(acordoId, input, options = {}) {
  if (!acordoId) {
    throw new Error('ID do acordo é obrigatório.');
  }

  const modo = String(input?.modo || '').toLowerCase();
  if (!RESCISAO_MODOS.includes(/** @type {any} */ (modo))) {
    throw new Error(
      'Modo de rescisão inválido. Escolhe aviso prévio, consensual ou justa causa.',
    );
  }

  const justificativa = input?.justificativa
    ? String(input.justificativa).trim().toLowerCase()
    : null;

  if (modo === 'justa_causa') {
    if (!justificativa) {
      throw new Error('A justa causa exige uma justificativa.');
    }
    if (!RESCISAO_JUSTIFICATIVAS.includes(/** @type {any} */ (justificativa))) {
      throw new Error(
        'Justificativa inválida. Escolhe faltas excessivas, avaria do veículo ou segurança.',
      );
    }
  }

  const idempotencyKey = options.idempotencyKey || uuidv4();
  const rpcArgs = {
    p_acordo_id: acordoId,
    p_modo: modo,
    p_justificativa: justificativa,
    p_idempotency_key: idempotencyKey,
  };

  const queueTerminate = async () => {
    const jaNaFila = await findQueuedTermination(acordoId, modo);
    if (jaNaFila) {
      return {
        id: acordoId,
        offlineQueued: true,
        idempotency_key: jaNaFila.idempotency_key,
      };
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      throw new Error('Sessão necessária para guardar a rescisão offline.');
    }
    await enqueueRpc({
      rpc: 'terminate_agreement',
      args: rpcArgs,
      accessToken,
      idempotencyKey,
    });
    return {
      id: acordoId,
      offlineQueued: true,
      idempotency_key: idempotencyKey,
    };
  };

  if (options.forceQueue || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return queueTerminate();
  }

  try {
    const { data: acordoIdOut, error: rpcError } = await supabase.rpc(
      'terminate_agreement',
      rpcArgs,
    );

    if (rpcError) {
      if (isNetworkFailure(rpcError)) {
        return queueTerminate();
      }
      throw new Error(rpcError.message || 'Falha ao rescindir o acordo.');
    }

    const id = acordoIdOut ?? acordoId;
    const { data, error } = await supabase
      .from('acordos')
      .select(
        'id, oferta_id, estado, rescisao_modo, rescisao_solicitada_por, rescisao_justificativa, rescisao_effective_on, cancelado_em',
      )
      .eq('id', id)
      .single();

    if (error) {
      if (isNetworkFailure(error)) {
        return queueTerminate();
      }
      throw error;
    }

    const estado = String(data?.estado || '').toLowerCase();
    return {
      ...data,
      rescisao_concluida: estado === 'cancelado' || estado === 'cancelado_justificado',
      rescisao_aguarda_confirmacao:
        modo === 'consensual' &&
        estado === 'activo' &&
        String(data?.rescisao_modo || '').toLowerCase() === 'consensual',
    };
  } catch (err) {
    if (isNetworkFailure(err)) {
      return queueTerminate();
    }
    throw err;
  }
}

/**
 * @param {string} driverId
 */
export async function getAgreementsForDriver(driverId) {
  await applyDueLifecycleBestEffort(null);

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
  await applyDueLifecycleBestEffort(null);

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
