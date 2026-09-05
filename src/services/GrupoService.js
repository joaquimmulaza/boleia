import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import { enqueueRpc, isNetworkFailure } from './offlineQueue.js';

const N_MAXIMO_MIN = 2;
const N_MAXIMO_MAX = 8;
const N_MAXIMO_DEFAULT = 4;

/**
 * @param {unknown} value
 * @returns {number}
 */
function normalizarNMaximo(value) {
  const n = value == null ? N_MAXIMO_DEFAULT : Number(value);
  if (!Number.isInteger(n) || n < N_MAXIMO_MIN || n > N_MAXIMO_MAX) {
    throw new Error(
      `A capacidade pretendida deve ser entre ${N_MAXIMO_MIN} e ${N_MAXIMO_MAX} pessoas.`,
    );
  }
  return n;
}

/**
 * Conta membros activos e valida vaga vs n_maximo.
 * @param {string} grupoId
 * @returns {Promise<{ nMaximo: number, nActivos: number, procuraId: string }>}
 */
async function assertTemVaga(grupoId) {
  const { data: grupo, error: grupoError } = await supabase
    .from('grupos')
    .select('id, n_maximo, procura_id')
    .eq('id', grupoId)
    .single();

  if (grupoError) throw grupoError;

  const nMaximo = normalizarNMaximo(grupo.n_maximo ?? N_MAXIMO_DEFAULT);

  const { count, error: countError } = await supabase
    .from('membros_grupo')
    .select('*', { count: 'exact', head: true })
    .eq('grupo_id', grupoId)
    .eq('estado', 'activo');

  if (countError) throw countError;

  const nActivos = count ?? 0;
  if (nActivos >= nMaximo) {
    throw new Error('Este grupo já está completo.');
  }

  return { nMaximo, nActivos, procuraId: grupo.procura_id };
}

/**
 * @param {string} procuraId
 * @param {string} [nome]
 * @param {number} [nMaximo]
 */
export async function createGrupo(procuraId, nome, nMaximo = N_MAXIMO_DEFAULT) {
  if (!procuraId) {
    throw new Error('ID da procura é obrigatório.');
  }

  const capacidade = normalizarNMaximo(nMaximo);

  const { data, error } = await supabase
    .from('grupos')
    .insert([
      {
        procura_id: procuraId,
        nome: nome ?? null,
        n_maximo: capacidade,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * @param {string} procuraId
 * @returns {Promise<object | null>}
 */
export async function getGrupoByProcura(procuraId) {
  if (!procuraId) {
    throw new Error('ID da procura é obrigatório.');
  }

  const { data, error } = await supabase
    .from('grupos')
    .select('*')
    .eq('procura_id', procuraId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Lista membros activos do grupo com dados do perfil.
 * @param {string} grupoId
 * @returns {Promise<object[]>}
 */
export async function listMembrosGrupo(grupoId) {
  if (!grupoId) {
    throw new Error('ID do grupo é obrigatório.');
  }

  const { data, error } = await supabase
    .from('membros_grupo')
    .select('*, perfis(nome_completo, telefone)')
    .eq('grupo_id', grupoId)
    .eq('estado', 'activo')
    .order('ordem_insercao', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Sincroniza N_actual da procura (coluna `n_candidato`) a partir dos membros activos.
 * Não invalida propostas abertas — cada proposta mantém o seu N_proposto (snapshot).
 * @param {string} grupoId
 * @returns {Promise<number>}
 */
export async function syncNCandidato(grupoId) {
  const { data: grupo, error: grupoError } = await supabase
    .from('grupos')
    .select('id, procura_id')
    .eq('id', grupoId)
    .single();

  if (grupoError) throw grupoError;

  const { count, error: countError } = await supabase
    .from('membros_grupo')
    .select('*', { count: 'exact', head: true })
    .eq('grupo_id', grupoId)
    .eq('estado', 'activo');

  if (countError) throw countError;

  const n = count ?? 0;
  if (n < 1) {
    throw new Error('O grupo precisa de pelo menos 1 membro activo.');
  }

  const { error: updateError } = await supabase
    .from('procuras')
    .update({ n_candidato: n, updated_at: new Date().toISOString() })
    .eq('id', grupo.procura_id);

  if (updateError) throw updateError;

  return n;
}

/**
 * @param {string} grupoId
 * @param {{
 *   passenger_id: string,
 *   pickup_name?: string,
 *   pickup_lat?: number,
 *   pickup_lng?: number,
 *   dropoff_name?: string,
 *   dropoff_lat?: number,
 *   dropoff_lng?: number,
 *   ordem_insercao?: number,
 * }} membro
 */
export async function addMembroGrupo(grupoId, membro) {
  if (!membro?.passenger_id) {
    throw new Error('passenger_id é obrigatório.');
  }

  await assertTemVaga(grupoId);

  const { data, error } = await supabase
    .from('membros_grupo')
    .insert([
      {
        grupo_id: grupoId,
        passenger_id: membro.passenger_id,
        pickup_name: membro.pickup_name ?? null,
        pickup_lat: membro.pickup_lat ?? null,
        pickup_lng: membro.pickup_lng ?? null,
        dropoff_name: membro.dropoff_name ?? null,
        dropoff_lat: membro.dropoff_lat ?? null,
        dropoff_lng: membro.dropoff_lng ?? null,
        ordem_insercao: membro.ordem_insercao ?? 0,
        estado: 'activo',
      },
    ])
    .select()
    .single();

  if (error) throw error;

  await syncNCandidato(grupoId);
  return data;
}

/**
 * Grupos públicos com vagas (N_actual < n_maximo) e procura activa.
 * @param {{ excludeOwnerId?: string, excludeGrupoId?: string }} [opts]
 * @returns {Promise<object[]>}
 */
export async function listGruposAbertos(opts = {}) {
  const { data, error } = await supabase
    .from('grupos')
    .select(
      'id, nome, n_maximo, procura_id, created_at, procuras(id, owner_id, origin_name, destination_name, preferred_time, n_candidato, estado)',
    );

  if (error) throw error;

  const rows = data || [];
  return rows.filter((g) => {
    const p = g.procuras;
    if (!p) return false;
    const estado = String(p.estado || '').toLowerCase();
    if (estado !== 'activa' && estado !== 'em_negociacao') return false;
    const nActual = Number(p.n_candidato) || 0;
    const nMax = Number(g.n_maximo) || N_MAXIMO_DEFAULT;
    if (nActual >= nMax) return false;
    if (opts.excludeOwnerId && p.owner_id === opts.excludeOwnerId) return false;
    if (opts.excludeGrupoId && g.id === opts.excludeGrupoId) return false;
    return true;
  });
}

/**
 * Pedido de entrada — estado pendente; NÃO sincroniza N_actual.
 * @param {string} grupoId
 * @param {{
 *   passenger_id: string,
 *   pickup_name?: string,
 *   pickup_lat?: number,
 *   pickup_lng?: number,
 *   dropoff_name?: string,
 *   dropoff_lat?: number,
 *   dropoff_lng?: number,
 * }} membro
 */
export async function pedirEntradaGrupo(grupoId, membro) {
  if (!grupoId) {
    throw new Error('ID do grupo é obrigatório.');
  }
  if (!membro?.passenger_id) {
    throw new Error('passenger_id é obrigatório.');
  }

  const { nActivos } = await assertTemVaga(grupoId);

  const { data: existente, error: existError } = await supabase
    .from('membros_grupo')
    .select('id, estado')
    .eq('grupo_id', grupoId)
    .eq('passenger_id', membro.passenger_id)
    .maybeSingle();

  if (existError) throw existError;

  if (existente) {
    const est = String(existente.estado || '').toLowerCase();
    if (est === 'activo') {
      throw new Error('Já estás neste grupo.');
    }
    if (est === 'pendente') {
      throw new Error('Já pediste entrada neste grupo.');
    }
    // rejeitado ou saiu → reabrir como pendente
    const { data: reaberto, error: reErr } = await supabase
      .from('membros_grupo')
      .update({
        estado: 'pendente',
        pickup_name: membro.pickup_name ?? null,
        pickup_lat: membro.pickup_lat ?? null,
        pickup_lng: membro.pickup_lng ?? null,
        dropoff_name: membro.dropoff_name ?? null,
        dropoff_lat: membro.dropoff_lat ?? null,
        dropoff_lng: membro.dropoff_lng ?? null,
        ordem_insercao: nActivos,
      })
      .eq('id', existente.id)
      .select()
      .single();

    if (reErr) throw reErr;
    return reaberto;
  }

  const { data, error } = await supabase
    .from('membros_grupo')
    .insert([
      {
        grupo_id: grupoId,
        passenger_id: membro.passenger_id,
        pickup_name: membro.pickup_name ?? null,
        pickup_lat: membro.pickup_lat ?? null,
        pickup_lng: membro.pickup_lng ?? null,
        dropoff_name: membro.dropoff_name ?? null,
        dropoff_lat: membro.dropoff_lat ?? null,
        dropoff_lng: membro.dropoff_lng ?? null,
        ordem_insercao: nActivos,
        estado: 'pendente',
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * @param {string} grupoId
 * @returns {Promise<object[]>}
 */
export async function listPedidosPendentes(grupoId) {
  if (!grupoId) {
    throw new Error('ID do grupo é obrigatório.');
  }

  const { data, error } = await supabase
    .from('membros_grupo')
    .select('*, perfis(nome_completo, telefone)')
    .eq('grupo_id', grupoId)
    .eq('estado', 'pendente')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Garante que o utilizador autenticado é o owner da procura do grupo.
 * @param {string} grupoId
 * @returns {Promise<string>} owner_id
 */
async function assertOwnerDoGrupo(grupoId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Não autenticado.');
  }

  const { data: grupo, error: grupoError } = await supabase
    .from('grupos')
    .select('id, procura_id, procuras!inner(owner_id)')
    .eq('id', grupoId)
    .single();

  if (grupoError) throw grupoError;

  const ownerId = grupo?.procuras?.owner_id;
  if (user.id !== ownerId) {
    throw new Error('Só o organizador do grupo pode gerir pedidos de entrada.');
  }
  return ownerId;
}

/**
 * Aceita pedido: activa membro + sync N_actual. Não toca propostas abertas.
 * Só o owner da procura (reforço cliente; RLS bloqueia auto-aprovação).
 * @param {string} membroId
 */
export async function aprovarEntrada(membroId) {
  if (!membroId) {
    throw new Error('ID do pedido é obrigatório.');
  }

  const { data: pedido, error: getError } = await supabase
    .from('membros_grupo')
    .select('id, grupo_id, passenger_id, estado, ordem_insercao')
    .eq('id', membroId)
    .single();

  if (getError) throw getError;

  if (String(pedido.estado || '').toLowerCase() !== 'pendente') {
    throw new Error('Este pedido já não está pendente.');
  }

  await assertOwnerDoGrupo(pedido.grupo_id);
  await assertTemVaga(pedido.grupo_id);

  const { data, error } = await supabase
    .from('membros_grupo')
    .update({ estado: 'activo' })
    .eq('id', membroId)
    .select()
    .single();

  if (error) throw error;

  await syncNCandidato(pedido.grupo_id);
  return data;
}

/**
 * Recusa pedido sem alterar N_actual nem propostas.
 * Só o owner da procura.
 * @param {string} membroId
 */
export async function rejeitarEntrada(membroId) {
  if (!membroId) {
    throw new Error('ID do pedido é obrigatório.');
  }

  const { data: pedido, error: getError } = await supabase
    .from('membros_grupo')
    .select('id, grupo_id, estado')
    .eq('id', membroId)
    .single();

  if (getError) throw getError;

  if (String(pedido.estado || '').toLowerCase() !== 'pendente') {
    throw new Error('Este pedido já não está pendente.');
  }

  await assertOwnerDoGrupo(pedido.grupo_id);

  const { data, error } = await supabase
    .from('membros_grupo')
    .update({ estado: 'rejeitado' })
    .eq('id', membroId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Saída de membro activo via RPC SECURITY DEFINER (`leave_grupo_membro`):
 * `activo`→`saiu` + sync N_actual. RLS cliente só permite self reabrir `pendente`.
 * Não invalida nem muta propostas abertas (N_proposto permanece snapshot).
 * Em falha de rede, enfileira com idempotency_key.
 *
 * @param {string} grupoId
 * @param {string} passengerId
 * @param {{ idempotencyKey?: string, forceQueue?: boolean }} [options]
 */
export async function sairDoGrupo(grupoId, passengerId, options = {}) {
  if (!grupoId) {
    throw new Error('ID do grupo é obrigatório.');
  }
  if (!passengerId) {
    throw new Error('ID do passageiro é obrigatório.');
  }

  const idempotencyKey = options.idempotencyKey || uuidv4();
  const rpcArgs = {
    p_grupo_id: grupoId,
    p_passenger_id: passengerId,
    p_idempotency_key: idempotencyKey,
  };

  const queueLeaveGrupo = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      throw new Error('Sessão necessária para guardar a saída do grupo offline.');
    }
    await enqueueRpc({
      rpc: 'leave_grupo_membro',
      args: rpcArgs,
      accessToken,
      idempotencyKey,
    });
    return {
      grupo_id: grupoId,
      passenger_id: passengerId,
      estado: 'saiu',
      offlineQueued: true,
      idempotency_key: idempotencyKey,
    };
  };

  if (options.forceQueue || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return queueLeaveGrupo();
  }

  try {
    const { data, error: rpcError } = await supabase.rpc('leave_grupo_membro', rpcArgs);

    if (rpcError) {
      if (isNetworkFailure(rpcError)) {
        return queueLeaveGrupo();
      }
      throw new Error(rpcError.message || 'Falha ao sair do grupo.');
    }

    return data;
  } catch (err) {
    if (isNetworkFailure(err)) {
      return queueLeaveGrupo();
    }
    throw err;
  }
}
