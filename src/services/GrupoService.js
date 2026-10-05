import { supabase } from '../lib/supabase';
import {
  callRpcWithOfflineFallback,
  resolveIdempotencyKey,
} from '../utils/callRpcWithOfflineFallback.js';
import { acordoBloqueiaApagarGrupo } from '../utils/grupoKebab.js';

const N_MAXIMO_MIN = 2;
const N_MAXIMO_MAX = 8;
const N_MAXIMO_DEFAULT = 4;

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function sanitizeOptionalText(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function sanitizeOptionalCoord(value) {
  if (value == null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

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
    .select('*, perfis(nome_completo)')
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
 *   pickup_name?: string | null,
 *   pickup_lat?: number | null,
 *   pickup_lng?: number | null,
 *   dropoff_name?: string | null,
 *   dropoff_lat?: number | null,
 *   dropoff_lng?: number | null,
 *   ordem_insercao?: number,
 * }} membro
 */
export async function addMembroGrupo(grupoId, membro) {
  if (!membro?.passenger_id) {
    throw new Error('passenger_id é obrigatório.');
  }

  await assertOwnerDoGrupo(grupoId);
  await assertTemVaga(grupoId);

  const pickupName = sanitizeOptionalText(membro.pickup_name);
  const pickupLat = pickupName ? sanitizeOptionalCoord(membro.pickup_lat) : null;
  const pickupLng = pickupName ? sanitizeOptionalCoord(membro.pickup_lng) : null;

  const dropoffName = sanitizeOptionalText(membro.dropoff_name);
  const dropoffLat = dropoffName ? sanitizeOptionalCoord(membro.dropoff_lat) : null;
  const dropoffLng = dropoffName ? sanitizeOptionalCoord(membro.dropoff_lng) : null;

  const { data, error } = await supabase
    .from('membros_grupo')
    .insert([
      {
        grupo_id: grupoId,
        passenger_id: membro.passenger_id,
        pickup_name: pickupName,
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        dropoff_name: dropoffName,
        dropoff_lat: dropoffLat,
        dropoff_lng: dropoffLng,
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
 * Grupos em que o passageiro já tem pedido de entrada pendente.
 * @param {string} passengerId
 * @returns {Promise<Set<string>>}
 */
async function grupoIdsComPedidoPendente(passengerId) {
  const { data, error } = await supabase
    .from('membros_grupo')
    .select('grupo_id')
    .eq('passenger_id', passengerId)
    .eq('estado', 'pendente');

  if (error) throw error;

  const ids = new Set();
  for (const row of data || []) {
    if (row?.grupo_id) ids.add(row.grupo_id);
  }
  return ids;
}

/**
 * Grupos públicos com vagas (N_actual < n_maximo) e procura activa.
 * Com `passengerId`, marca `pedido_pendente` sem retirar o grupo da lista.
 * @param {{ excludeOwnerId?: string, excludeGrupoId?: string, passengerId?: string }} [opts]
 * @returns {Promise<object[]>}
 */
export async function listGruposAbertos(opts = {}) {
  const gruposQuery = supabase
    .from('grupos')
    .select(
      'id, nome, n_maximo, procura_id, created_at, procuras(id, owner_id, origin_name, destination_name, preferred_time, n_candidato, estado)',
    );
  const pendentesQuery = opts.passengerId
    ? grupoIdsComPedidoPendente(opts.passengerId)
    : Promise.resolve(null);

  const [{ data, error }, pendentes] = await Promise.all([gruposQuery, pendentesQuery]);

  if (error) throw error;

  const rows = data || [];
  const abertos = rows.filter((g) => {
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

  if (!pendentes || pendentes.size === 0) return abertos;

  return abertos.map((g) => (pendentes.has(g.id) ? { ...g, pedido_pendente: true } : g));
}

/**
 * Pedido de entrada — estado pendente; NÃO sincroniza N_actual.
 * @param {string} grupoId
 * @param {{
 *   passenger_id: string,
 *   pickup_name?: string | null,
 *   pickup_lat?: number | null,
 *   pickup_lng?: number | null,
 *   dropoff_name?: string | null,
 *   dropoff_lat?: number | null,
 *   dropoff_lng?: number | null,
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

  const pickupName = sanitizeOptionalText(membro.pickup_name);
  const pickupLat = pickupName ? sanitizeOptionalCoord(membro.pickup_lat) : null;
  const pickupLng = pickupName ? sanitizeOptionalCoord(membro.pickup_lng) : null;

  const dropoffName = sanitizeOptionalText(membro.dropoff_name);
  const dropoffLat = dropoffName ? sanitizeOptionalCoord(membro.dropoff_lat) : null;
  const dropoffLng = dropoffName ? sanitizeOptionalCoord(membro.dropoff_lng) : null;

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
        pickup_name: pickupName,
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        dropoff_name: dropoffName,
        dropoff_lat: dropoffLat,
        dropoff_lng: dropoffLng,
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
        pickup_name: pickupName,
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        dropoff_name: dropoffName,
        dropoff_lat: dropoffLat,
        dropoff_lng: dropoffLng,
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
    .select('*, perfis(nome_completo)')
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

  const idempotencyKey = resolveIdempotencyKey(options.idempotencyKey);
  const rpcArgs = {
    p_grupo_id: grupoId,
    p_passenger_id: passengerId,
    p_idempotency_key: idempotencyKey,
  };

  return callRpcWithOfflineFallback({
    rpc: 'leave_grupo_membro',
    rpcArgs,
    options: { ...options, idempotencyKey },
    sessionErrorMessage: 'Sessão necessária para guardar a saída do grupo offline.',
    rpcErrorMessage: 'Falha ao sair do grupo.',
    offlineResult: (key) => ({
      grupo_id: grupoId,
      passenger_id: passengerId,
      estado: 'saiu',
      offlineQueued: true,
      idempotency_key: key,
    }),
  });
}

/**
 * Há acordo ainda vivo neste grupo ou nesta procura.
 * Cancelado e expirado não bloqueiam apagar.
 * @param {string | null | undefined} grupoId
 * @param {string | null | undefined} procuraId
 * @returns {Promise<boolean>}
 */
export async function grupoTemAcordoActivo(grupoId, procuraId) {
  const partes = [];
  if (grupoId) partes.push(`grupo_id.eq.${grupoId}`);
  if (procuraId) partes.push(`procura_id.eq.${procuraId}`);
  if (partes.length === 0) return false;

  const { data, error } = await supabase
    .from('acordos')
    .select('id, estado')
    .or(partes.join(','));

  if (error) throw error;
  return (data || []).some((row) => acordoBloqueiaApagarGrupo(row.estado));
}

/**
 * Capacidade desejada ≥ membros activos. Não mexe em propostas.
 * O CHECK da base continua 2–8: gravar 1 devolve mensagem explícita.
 * @param {string} grupoId
 * @param {number} nDesejado
 * @returns {Promise<object>}
 */
export async function updateGrupoCapacidade(grupoId, nDesejado) {
  if (!grupoId) {
    throw new Error('ID do grupo é obrigatório.');
  }

  const { count, error: countError } = await supabase
    .from('membros_grupo')
    .select('*', { count: 'exact', head: true })
    .eq('grupo_id', grupoId)
    .eq('estado', 'activo');

  if (countError) throw countError;

  const nActivos = count ?? 0;
  const floor = Math.max(1, nActivos);
  const n = Number(nDesejado);
  if (!Number.isInteger(n) || n < floor || n > N_MAXIMO_MAX) {
    throw new Error(
      `A capacidade desejada tem de ser pelo menos ${floor} e no máximo ${N_MAXIMO_MAX}.`,
    );
  }

  const { data, error } = await supabase
    .from('grupos')
    .update({ n_maximo: n })
    .eq('id', grupoId)
    .select()
    .single();

  if (error) {
    if (error.code === '23514') {
      throw new Error('A capacidade mínima que podes guardar é 2 pessoas.');
    }
    throw error;
  }
  return data;
}

/**
 * Actualiza só o ponto de recolha do membro. Não reescreve propostas.
 * @param {string} membroId
 * @param {{ pickup_name?: string | null, pickup_lat?: number | null, pickup_lng?: number | null }} pickup
 */
export async function updateMembroRecolha(membroId, pickup) {
  if (!membroId) {
    throw new Error('ID do membro é obrigatório.');
  }

  const pickupName = sanitizeOptionalText(pickup?.pickup_name);
  const payload = {
    pickup_name: pickupName,
    pickup_lat: pickupName ? sanitizeOptionalCoord(pickup?.pickup_lat) : null,
    pickup_lng: pickupName ? sanitizeOptionalCoord(pickup?.pickup_lng) : null,
  };

  const { data, error } = await supabase
    .from('membros_grupo')
    .update(payload)
    .eq('id', membroId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Apaga o grupo só com um membro activo e sem acordo vivo.
 * Propostas ficam com o snapshot (grupo_id passa a nulo por FK, sem UPDATE de preço/N).
 * @param {string} grupoId
 * @param {{ procuraId?: string | null }} [opts]
 */
export async function apagarGrupo(grupoId, opts = {}) {
  if (!grupoId) {
    throw new Error('ID do grupo é obrigatório.');
  }

  const { count, error: countError } = await supabase
    .from('membros_grupo')
    .select('*', { count: 'exact', head: true })
    .eq('grupo_id', grupoId)
    .eq('estado', 'activo');

  if (countError) throw countError;
  if ((count ?? 0) !== 1) {
    throw new Error('Só podes apagar o grupo quando és o único membro.');
  }

  const bloqueia = await grupoTemAcordoActivo(grupoId, opts.procuraId ?? null);
  if (bloqueia) {
    throw new Error('Não podes apagar o grupo enquanto houver um acordo activo.');
  }

  const { error } = await supabase.from('grupos').delete().eq('id', grupoId);
  if (error) throw error;
}
