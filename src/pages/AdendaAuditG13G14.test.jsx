/**
 * G13/G14 — auditoria adendas (effective_from mês seguinte, sem retroactivo).
 * Espelha cenários da visão §5 Marketplace Renegotiation Audit.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  renegotiateAgreementPricing,
  acceptAgreementAdenda,
  rejectAgreementAdenda,
  respondAgreementAdenda,
} from '../services/AgreementService.js';
import { firstDayNextMonthLuanda, isAdendaBeforeEffectiveFrom } from '../utils/adendaEffectiveFrom.js';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'jwt-test' } },
      }),
    },
  },
}));

describe('Marketplace Renegotiation Audit — G13/G14', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const QUOTA_LIVE = 30000;
  const ACORDO_LIVE = {
    id: 'acordo-g13',
    modo_preco: 'POR_PASSAGEIRO',
    n_passageiros_contrato: 2,
    valor_mensal_total_kz: 60000,
    valor_mensal_por_passageiro_kz: QUOTA_LIVE,
    estado: 'activo',
  };

  function mockProposeAdenda(adendaOverrides = {}) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-31T22:00:00.000Z'));
    const effectiveFrom = firstDayNextMonthLuanda();

    supabase.rpc.mockResolvedValue({ data: 'acordo-g13', error: null });
    supabase.from.mockImplementation((table) => {
      if (table === 'acordos_passageiros') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 2, data: null, error: null }),
            }),
          }),
        };
      }
      if (table === 'acordos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  ...ACORDO_LIVE,
                  acordos_adendas: [
                    {
                      id: 'adenda-g13',
                      estado: 'pendente_passageiro',
                      effective_from: effectiveFrom,
                      valor_mensal_por_passageiro_kz: 35000,
                      valor_mensal_total_kz: 70000,
                      applied_at: null,
                      superseded_at: null,
                      ...adendaOverrides,
                    },
                  ],
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    return { effectiveFrom };
  }

  it('G13 — aceite não altera preço live no mês corrente; effective_from = dia 1 mês seguinte', async () => {
    const { effectiveFrom } = mockProposeAdenda();

    const proposed = await renegotiateAgreementPricing('acordo-g13', {
      modo_preco: 'POR_PASSAGEIRO',
      valor_ask_kz: 35000,
      n_passageiros: 2,
    });

    expect(proposed.valor_mensal_por_passageiro_kz).toBe(QUOTA_LIVE);
    expect(proposed.adenda_pendente.effective_from).toBe(effectiveFrom);
    expect(effectiveFrom).toBe('2026-09-01');
    expect(isAdendaBeforeEffectiveFrom(effectiveFrom)).toBe(true);

    supabase.rpc.mockResolvedValue({ data: 'adenda-g13', error: null });
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'adenda-g13',
              acordo_id: 'acordo-g13',
              estado: 'aceite_agendada',
              effective_from: effectiveFrom,
              valor_mensal_por_passageiro_kz: 35000,
              applied_at: null,
            },
            error: null,
          }),
        }),
      }),
    });

    const adendaAceite = await acceptAgreementAdenda('adenda-g13');

    expect(String(adendaAceite.estado).toLowerCase()).toMatch(/aceite/);
    expect(adendaAceite.applied_at).toBeNull();
    expect(isAdendaBeforeEffectiveFrom(adendaAceite.effective_from)).toBe(true);
    expect(proposed.valor_mensal_por_passageiro_kz).toBe(QUOTA_LIVE);
  });

  it('G14 — rejeição mantém acordo activo e quota live intacta', async () => {
    mockProposeAdenda();

    await renegotiateAgreementPricing('acordo-g13', {
      modo_preco: 'POR_PASSAGEIRO',
      valor_ask_kz: 40000,
      n_passageiros: 2,
    });

    supabase.rpc.mockResolvedValue({ data: 'adenda-g13', error: null });
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'adenda-g13',
              acordo_id: 'acordo-g13',
              estado: 'rejeitada',
              applied_at: null,
            },
            error: null,
          }),
        }),
      }),
    });

    const adenda = await rejectAgreementAdenda('adenda-g13');

    expect(String(adenda.estado).toLowerCase()).toBe('rejeitada');
    expect(adenda.applied_at).toBeNull();
    expect(supabase.rpc).toHaveBeenCalledWith(
      'reject_agreement_adenda',
      expect.objectContaining({ p_adenda_id: 'adenda-g13' }),
    );
  });

  it('G13 boundary — viragem 1 Set: effective_from aponta para Outubro', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-01T00:30:00.000Z'));

    expect(firstDayNextMonthLuanda()).toBe('2026-10-01');
  });

  it('respondAgreementAdenda delega accept/reject via RPC respond_agreement_adenda', async () => {
    supabase.rpc.mockResolvedValue({ data: 'adenda-1', error: null });
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'adenda-1', estado: 'aceite_agendada' },
            error: null,
          }),
        }),
      }),
    });

    await respondAgreementAdenda('adenda-1', true);

    expect(supabase.rpc).toHaveBeenCalledWith(
      'respond_agreement_adenda',
      expect.objectContaining({
        p_adenda_id: 'adenda-1',
        p_accept: true,
        p_idempotency_key: expect.any(String),
      }),
    );
  });
});
