import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearQueue, listQueueItems } from './db.js';
import { drainQueue } from './offlineQueue.js';
import {
  acceptAgreementAdenda,
  createAgreementFromProposal,
  leavePassenger,
  renegotiateAgreementPricing,
} from './AgreementService.js';
import { cancelProposta } from './PropostaService.js';
import { sairDoGrupo } from './GrupoService.js';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
    auth: {
      getSession: vi.fn(),
    },
  },
}));

describe('OfflineSyncEngine', () => {
  beforeEach(async () => {
    await clearQueue();
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'jwt-offline' } },
    });
  });

  it('quando a rede falha, leave_passenger fica na fila IndexedDB com idempotency_key', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    const result = await leavePassenger('acordo-1', 'pax-1');

    expect(result.offlineQueued).toBe(true);
    expect(result.idempotency_key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const rows = await listQueueItems();
    expect(rows).toHaveLength(1);
    expect(rows[0].rpc).toBe('leave_passenger');
    expect(rows[0].idempotency_key).toBe(result.idempotency_key);
    expect(rows[0].args.p_idempotency_key).toBe(result.idempotency_key);
    expect(rows[0].args.p_acordo_id).toBe('acordo-1');
  });

  it('quando a rede falha, cancel_proposal fica na fila com a mesma chave nos args', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    const result = await cancelProposta('prop-1');
    expect(result.offlineQueued).toBe(true);

    const rows = await listQueueItems();
    expect(rows).toHaveLength(1);
    expect(rows[0].rpc).toBe('cancel_proposal');
    expect(rows[0].args.p_proposta_id).toBe('prop-1');
  });

  it('quando a rede falha, accept_proposal fica na fila com p_idempotency_key', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    const result = await createAgreementFromProposal('prop-2');
    expect(result.offlineQueued).toBe(true);

    const rows = await listQueueItems();
    expect(rows).toHaveLength(1);
    expect(rows[0].rpc).toBe('accept_proposal');
    expect(rows[0].args.p_proposta_id).toBe('prop-2');
    expect(rows[0].args.p_idempotency_key).toBe(result.idempotency_key);
  });

  it('quando a rede falha, renegotiate_agreement_pricing fica na fila', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    const result = await renegotiateAgreementPricing('acordo-2', {
      modo_preco: 'TOTAL_ACORDO',
      valor_ask_kz: 90000,
      n_passageiros: 3,
    });
    expect(result.offlineQueued).toBe(true);

    const rows = await listQueueItems();
    expect(rows[0].rpc).toBe('renegotiate_agreement_pricing');
    expect(rows[0].args.p_acordo_id).toBe('acordo-2');
    expect(rows[0].args.p_idempotency_key).toBe(result.idempotency_key);
  });

  it('quando a rede falha, accept_agreement_adenda fica na fila', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    const result = await acceptAgreementAdenda('adenda-9');
    expect(result.offlineQueued).toBe(true);

    const rows = await listQueueItems();
    expect(rows[0].rpc).toBe('accept_agreement_adenda');
    expect(rows[0].args.p_adenda_id).toBe('adenda-9');
  });

  it('quando a rede falha, leave_grupo_membro fica na fila', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    const result = await sairDoGrupo('g-9', 'pax-9');
    expect(result.offlineQueued).toBe(true);

    const rows = await listQueueItems();
    expect(rows[0].rpc).toBe('leave_grupo_membro');
    expect(rows[0].args.p_grupo_id).toBe('g-9');
    expect(rows[0].args.p_passenger_id).toBe('pax-9');
  });

  it('reconciliação: drainQueue restaura consistência quando a ligação volta', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    await leavePassenger('acordo-9', 'pax-9');
    expect(await listQueueItems()).toHaveLength(1);

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    const fetchRpc = vi.fn().mockResolvedValue({ ok: true, status: 200, data: 'acordo-9' });
    const summary = await drainQueue({ fetchRpc });

    expect(summary.remaining).toBe(0);
    expect(summary.processed).toBe(1);
    expect(fetchRpc).toHaveBeenCalledOnce();
  });

  it('dedupe: duas sincronizações com o mesmo UUID resolvem sem erro (servidor idempotente)', async () => {
    const key = '55555555-5555-4555-8555-555555555555';
    const calls = [];
    const fetchRpc = vi.fn(async (item) => {
      calls.push(item.args.p_idempotency_key);
      return { ok: true, status: 200, data: 'acordo-1' };
    });

    await leavePassenger('acordo-1', 'pax-1', { idempotencyKey: key, forceQueue: true });
    await drainQueue({ fetchRpc });

    await leavePassenger('acordo-1', 'pax-1', { idempotencyKey: key, forceQueue: true });
    await drainQueue({ fetchRpc });

    expect(calls).toEqual([key, key]);
    expect(await listQueueItems()).toHaveLength(0);
  });
});
