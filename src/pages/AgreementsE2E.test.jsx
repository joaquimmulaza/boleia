/**
 * T25 — E2E marketplace: TOTAL_ACORDO N=3/4 + leave sem recalcular quotas.
 * Adenda temporal — effective_from = próximo mês; contrato original auditável.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveAgreementPricing } from '../utils/resolveAgreementPricing.js';
import {
  leavePassenger,
  renegotiateAgreementPricing,
} from '../services/AgreementService.js';
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

describe('Agreements marketplace E2E (T25)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  describe('TOTAL_ACORDO — resolução de preço (N_contrato)', () => {
    it('ask 120000 TOTAL_ACORDO N=3 → 40000/pax', () => {
      const result = resolveAgreementPricing({
        modo_preco: 'TOTAL_ACORDO',
        valor_ask_kz: 120000,
        n_passageiros: 3,
      });

      expect(result.valor_mensal_total_kz).toBe(120000);
      expect(result.valor_mensal_por_passageiro_kz).toBe(40000);
      expect(result.quotas).toEqual([40000, 40000, 40000]);
      expect(result.quotas.reduce((a, b) => a + b, 0)).toBe(120000);
    });

    it('ask 120000 TOTAL_ACORDO N=4 → 30000/pax', () => {
      const result = resolveAgreementPricing({
        modo_preco: 'TOTAL_ACORDO',
        valor_ask_kz: 120000,
        n_passageiros: 4,
      });

      expect(result.valor_mensal_total_kz).toBe(120000);
      expect(result.valor_mensal_por_passageiro_kz).toBe(30000);
      expect(result.quotas).toEqual([30000, 30000, 30000, 30000]);
    });

    it('100000/3 resto → 33334, 33333, 33333', () => {
      const result = resolveAgreementPricing({
        modo_preco: 'TOTAL_ACORDO',
        valor_ask_kz: 100000,
        n_passageiros: 3,
      });

      expect(result.valor_mensal_por_passageiro_kz).toBe(33333);
      expect(result.quotas).toEqual([33334, 33333, 33333]);
      expect(result.quotas.reduce((a, b) => a + b, 0)).toBe(100000);
    });
  });

  describe('leavePassenger — invariante de quota (RPC atómica)', () => {
    const cabecalho = {
      id: 'acordo-1',
      oferta_id: 'of-1',
      valor_mensal_por_passageiro_kz: 30000,
      valor_mensal_total_kz: 120000,
      n_passageiros_contrato: 4,
    };

    /**
     * Acordo 120k / 4 × 30k; pax-1 sai → cabeçalho intacto (servidor não recalcula).
     */
    it('não altera valor_mensal_* do cabeçalho após leave_passenger', async () => {
      supabase.rpc.mockResolvedValue({ data: 'acordo-1', error: null });
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { ...cabecalho }, error: null }),
          }),
        }),
      });

      const result = await leavePassenger('acordo-1', 'pax-1');

      expect(supabase.rpc).toHaveBeenCalledWith(
        'leave_passenger',
        expect.objectContaining({
          p_acordo_id: 'acordo-1',
          p_passenger_id: 'pax-1',
          p_idempotency_key: expect.any(String),
        }),
      );
      expect(result.valor_mensal_por_passageiro_kz).toBe(30000);
      expect(result.valor_mensal_total_kz).toBe(120000);
      expect(result.n_passageiros_contrato).toBe(4);
    });

    it('propaga falha da RPC sem mutar preço no cliente', async () => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Passageiro não está activo neste acordo.' },
      });

      await expect(leavePassenger('acordo-1', 'pax-1')).rejects.toThrow(
        /não está activo/i,
      );
    });
  });

  describe('anti-padrões de preço / leave', () => {
    it('AgreementService leave usa RPC leave_passenger e não recalcula quotas no cliente', () => {
      const dir = dirname(fileURLToPath(import.meta.url));
      const src = readFileSync(
        join(dir, '../services/AgreementService.js'),
        'utf8',
      );

      expect(src).toMatch(/leave_passenger/);
      expect(src).not.toMatch(/\/\s*4(\.0)?\b/);
      expect(src).not.toMatch(/valor_mensal.*=.*N_activos/i);
      expect(src).not.toMatch(/quota_mensal_kz\s*:/);
      expect(src).not.toMatch(/vagas_disponiveis/);
    });

    it('resolveAgreementPricing divide por N_contrato (n_passageiros), nunca por vagas', () => {
      const dir = dirname(fileURLToPath(import.meta.url));
      const src = readFileSync(
        join(dir, '../utils/resolveAgreementPricing.js'),
        'utf8',
      );
      // Ignorar JSDoc (pode mencionar N_activos como anti-padrão)
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

      expect(code).toMatch(/n_passageiros/);
      expect(code).not.toMatch(/vagas/);
      expect(code).not.toMatch(/N_activos/);
      expect(code).not.toMatch(/\/\s*4(\.0)?\b/);
    });
  });

  describe('adenda temporal — effective_from próximo mês', () => {
    /**
     * Mock: count activos + RPC + select com live intacto + adenda_pendente.
     */
    function mockAdendaTemporal() {
      const pricing = resolveAgreementPricing({
        modo_preco: 'TOTAL_ACORDO',
        valor_ask_kz: 90000,
        n_passageiros: 3,
      });
      const live = {
        id: 'acordo-1',
        modo_preco: 'TOTAL_ACORDO',
        n_passageiros_contrato: 4,
        valor_mensal_total_kz: 120000,
        valor_mensal_por_passageiro_kz: 30000,
        estado: 'activo',
        adenda_pendente: {
          effective_from: '2026-10-01',
          modo_preco: 'TOTAL_ACORDO',
          n_passageiros_contrato: 3,
          valor_mensal_total_kz: pricing.valor_mensal_total_kz,
          valor_mensal_por_passageiro_kz: pricing.valor_mensal_por_passageiro_kz,
          previo_modo_preco: 'TOTAL_ACORDO',
          previo_n_passageiros_contrato: 4,
          previo_valor_mensal_total_kz: 120000,
          previo_valor_mensal_por_passageiro_kz: 30000,
          previo_quotas: [
            { passenger_id: 'pax-1', quota_mensal_kz: 30000 },
            { passenger_id: 'pax-2', quota_mensal_kz: 30000 },
            { passenger_id: 'pax-3', quota_mensal_kz: 30000 },
            { passenger_id: 'pax-4', quota_mensal_kz: 30000 },
          ],
          applied_at: null,
        },
      };

      supabase.rpc.mockResolvedValue({ data: 'acordo-1', error: null });
      supabase.from.mockImplementation((table) => {
        if (table === 'acordos_passageiros') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  count: 3,
                  data: null,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'acordos') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: live, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      return { live, pricing };
    }

    it('renegotiate NÃO altera cabeçalho live; novo preço só em adenda_pendente', async () => {
      const { live, pricing } = mockAdendaTemporal();

      const result = await renegotiateAgreementPricing('acordo-1', {
        modo_preco: 'TOTAL_ACORDO',
        valor_ask_kz: 90000,
      });

      expect(result.valor_mensal_total_kz).toBe(live.valor_mensal_total_kz);
      expect(result.valor_mensal_por_passageiro_kz).toBe(live.valor_mensal_por_passageiro_kz);
      expect(result.n_passageiros_contrato).toBe(4);
      expect(result.adenda_pendente.valor_mensal_total_kz).toBe(pricing.valor_mensal_total_kz);
      expect(result.adenda_pendente.n_passageiros_contrato).toBe(3);
      expect(result.adenda_pendente.effective_from).toBe('2026-10-01');
    });

    it('contrato original fica auditável em previo_* da adenda', async () => {
      mockAdendaTemporal();

      const result = await renegotiateAgreementPricing('acordo-1', {
        modo_preco: 'TOTAL_ACORDO',
        valor_ask_kz: 90000,
        n_passageiros: 3,
      });

      expect(result.adenda_pendente.previo_valor_mensal_total_kz).toBe(120000);
      expect(result.adenda_pendente.previo_n_passageiros_contrato).toBe(4);
      expect(result.adenda_pendente.previo_quotas).toHaveLength(4);
      expect(result.adenda_pendente.applied_at).toBeNull();
    });

    it('leave após adenda pendente continua sem recalcular quotas (RPC leave_passenger)', async () => {
      mockAdendaTemporal();
      await renegotiateAgreementPricing('acordo-1', {
        modo_preco: 'TOTAL_ACORDO',
        valor_ask_kz: 90000,
        n_passageiros: 3,
      });

      supabase.rpc.mockResolvedValue({ data: 'acordo-1', error: null });
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'acordo-1',
                oferta_id: 'of-1',
                valor_mensal_por_passageiro_kz: 30000,
                valor_mensal_total_kz: 120000,
                n_passageiros_contrato: 4,
              },
              error: null,
            }),
          }),
        }),
      });

      const afterLeave = await leavePassenger('acordo-1', 'pax-1');

      expect(supabase.rpc).toHaveBeenCalledWith(
        'leave_passenger',
        expect.objectContaining({
          p_acordo_id: 'acordo-1',
          p_passenger_id: 'pax-1',
          p_idempotency_key: expect.any(String),
        }),
      );
      expect(afterLeave.valor_mensal_total_kz).toBe(120000);
      expect(afterLeave.n_passageiros_contrato).toBe(4);
    });

    it('serviço de adenda não faz UPDATE directo a quotas no cliente', () => {
      const dir = dirname(fileURLToPath(import.meta.url));
      const src = readFileSync(
        join(dir, '../services/AgreementService.js'),
        'utf8',
      );
      const renegotiateBlock = src.slice(
        src.indexOf('renegotiateAgreementPricing'),
        src.indexOf('getAgreementsForDriver'),
      );

      expect(renegotiateBlock).toMatch(/renegotiate_agreement_pricing/);
      expect(renegotiateBlock).not.toMatch(/\.update\(/);
      expect(renegotiateBlock).not.toMatch(/quota_mensal_kz/);
    });
  });
});
