import { v4 as uuidv4 } from 'uuid';
import { listQueueItems, putQueueItem, removeQueueItem } from './db.js';

export const OFFLINE_SYNC_TAG = 'sync-offline-actions';

/**
 * @param {unknown} error
 * @returns {boolean}
 */
export function isNetworkFailure(error) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }
  if (!error) return false;
  const msg = String(/** @type {{ message?: string }} */ (error).message || error);
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(msg)) {
    return true;
  }
  const name = /** @type {{ name?: string }} */ (error).name;
  if (name === 'TypeError' && /fetch|network/i.test(msg)) {
    return true;
  }
  return false;
}

/**
 * @param {{
 *   rpc: 'leave_passenger' | 'cancel_proposal' | string,
 *   args: Record<string, unknown>,
 *   accessToken: string,
 *   idempotencyKey?: string,
 *   supabaseUrl?: string,
 *   supabaseAnonKey?: string,
 * }} input
 */
export async function enqueueRpc(input) {
  if (!input?.rpc) {
    throw new Error('rpc é obrigatório.');
  }
  if (!input.accessToken) {
    throw new Error('accessToken é obrigatório para sincronizar offline.');
  }

  const idempotency_key = input.idempotencyKey || uuidv4();
  const item = {
    idempotency_key,
    rpc: input.rpc,
    args: { ...input.args, p_idempotency_key: input.args?.p_idempotency_key || idempotency_key },
    access_token: input.accessToken,
    supabase_url: input.supabaseUrl || import.meta.env.VITE_SUPABASE_URL,
    supabase_anon_key: input.supabaseAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY,
    created_at: new Date().toISOString(),
  };

  await putQueueItem(item);
  await registerBackgroundSync();
  return item;
}

/**
 * @returns {Promise<boolean>} true se registrou Background Sync
 */
export async function registerBackgroundSync() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    const syncManager = /** @type {{ sync?: { register: (tag: string) => Promise<void> } }} */ (
      registration
    ).sync;
    if (!syncManager?.register) return false;
    await syncManager.register(OFFLINE_SYNC_TAG);
    return true;
  } catch {
    return false;
  }
}

/**
 * Executa uma RPC via REST PostgREST (usado pelo SW e pelo drain no cliente).
 * @param {object} item
 * @returns {Promise<{ ok: boolean, status: number, data?: unknown, errorText?: string }>}
 */
export async function executeQueuedRpc(item) {
  const url = `${String(item.supabase_url).replace(/\/$/, '')}/rest/v1/rpc/${item.rpc}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: item.supabase_anon_key,
      Authorization: `Bearer ${item.access_token}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(item.args || {}),
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
    errorText: response.ok ? undefined : text,
  };
}

/**
 * Drena a fila sequencialmente. Remove item em 2xx ou 4xx de negócio.
 * Mantém item se falha de rede / 5xx.
 * @param {{ fetchRpc?: typeof executeQueuedRpc }} [opts]
 * @returns {Promise<{ processed: number, remaining: number, conflicts: object[] }>}
 */
export async function drainQueue(opts = {}) {
  const fetchRpc = opts.fetchRpc || executeQueuedRpc;
  const pending = await listQueueItems();
  const sorted = [...pending].sort((a, b) =>
    String(a.created_at || '').localeCompare(String(b.created_at || '')),
  );

  let processed = 0;
  /** @type {object[]} */
  const conflicts = [];

  for (const item of sorted) {
    try {
      const result = await fetchRpc(item);
      if (result.ok) {
        await removeQueueItem(item.idempotency_key);
        processed += 1;
        continue;
      }
      // 4xx: conflito / regra de negócio — não reintentar infinitamente
      if (result.status >= 400 && result.status < 500) {
        await removeQueueItem(item.idempotency_key);
        conflicts.push({ item, status: result.status, errorText: result.errorText });
        processed += 1;
        continue;
      }
      // 5xx / outro — manter na fila
      break;
    } catch (err) {
      if (isNetworkFailure(err)) break;
      // erro inesperado: manter e parar
      break;
    }
  }

  const remaining = (await listQueueItems()).length;
  return { processed, remaining, conflicts };
}

export async function listPending() {
  return listQueueItems();
}
