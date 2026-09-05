import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearQueue, listQueueItems } from './db.js';
import {
  drainQueue,
  enqueueRpc,
  isNetworkFailure,
  OFFLINE_SYNC_TAG,
} from './offlineQueue.js';

describe('offlineQueue', () => {
  beforeEach(async () => {
    await clearQueue();
    vi.unstubAllGlobals();
  });

  it('isNetworkFailure detecta navigator.onLine=false', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    expect(isNetworkFailure(null)).toBe(true);
  });

  it('isNetworkFailure detecta Failed to fetch', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    expect(isNetworkFailure(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('enqueueRpc grava UUID e args com p_idempotency_key', async () => {
    const item = await enqueueRpc({
      rpc: 'leave_passenger',
      args: { p_acordo_id: 'acordo-1', p_passenger_id: 'pax-1' },
      accessToken: 'jwt-test',
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon',
      idempotencyKey: '33333333-3333-4333-8333-333333333333',
    });

    expect(item.idempotency_key).toBe('33333333-3333-4333-8333-333333333333');
    expect(item.args.p_idempotency_key).toBe(item.idempotency_key);

    const rows = await listQueueItems();
    expect(rows).toHaveLength(1);
    expect(rows[0].access_token).toBe('jwt-test');
  });

  it('drainQueue remove item após 200 OK e trata segunda sync da mesma key como sucesso', async () => {
    const key = '44444444-4444-4444-8444-444444444444';
    await enqueueRpc({
      rpc: 'leave_passenger',
      args: { p_acordo_id: 'a1', p_passenger_id: 'p1', p_idempotency_key: key },
      accessToken: 'jwt',
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon',
      idempotencyKey: key,
    });

    const seen = [];
    const fetchRpc = vi.fn(async (item) => {
      seen.push(item.idempotency_key);
      // Simula servidor idempotente: primeira e segunda chamada OK
      return { ok: true, status: 200, data: item.args.p_acordo_id };
    });

    const first = await drainQueue({ fetchRpc });
    expect(first.processed).toBe(1);
    expect(first.remaining).toBe(0);
    expect(seen).toEqual([key]);

    // Reenvia o mesmo evento (timeout falso) — fila vazia, mas se re-enfileirar, OK sem duplicar efeito
    await enqueueRpc({
      rpc: 'leave_passenger',
      args: { p_acordo_id: 'a1', p_passenger_id: 'p1', p_idempotency_key: key },
      accessToken: 'jwt',
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon',
      idempotencyKey: key,
    });
    const second = await drainQueue({ fetchRpc });
    expect(second.processed).toBe(1);
    expect(fetchRpc).toHaveBeenCalledTimes(2);
    expect(fetchRpc.mock.calls[1][0].args.p_idempotency_key).toBe(key);
  });

  it('exporta tag de sync correcta', () => {
    expect(OFFLINE_SYNC_TAG).toBe('sync-offline-actions');
  });
});
