/**
 * T25 — E2E marketplace: TOTAL_ACORDO N=3/4 + leave sem recalcular quotas.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveAgreementPricing } from '../utils/resolveAgreementPricing.js';
import { leavePassenger } from '../services/AgreementService.js';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('Agreements marketplace E2E (T25)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  describe('leavePassenger — invariante de quota', () => {
    const cabecalho = {
      id: 'acordo-1',
      oferta_id: 'of-1',
      valor_mensal_por_passageiro_kz: 30000,
      valor_mensal_total_kz: 120000,
      n_passageiros_contrato: 4,
    };

    /**
     * Acordo 120k / 4 × 30k; pax-1 sai → cabeçalho e quotas dos 3 restantes intactos.
     */
    it('não altera valor_mensal_* do cabeçalho nem quota_mensal_kz dos restantes', async () => {
      const restantesAntes = [
        { passenger_id: 'pax-2', quota_mensal_kz: 30000, estado: 'activo' },
        { passenger_id: 'pax-3', quota_mensal_kz: 30000, estado: 'activo' },
        { passenger_id: 'pax-4', quota_mensal_kz: 30000, estado: 'activo' },
      ];
      const activosAntes = [
        { passenger_id: 'pax-1', quota_mensal_kz: 30000, estado: 'activo' },
        ...restantesAntes,
      ];

      let selectPassageirosCalls = 0;
      let updatePassageirosPayload = null;
      let acordosUpdateCalled = false;

      supabase.from.mockImplementation((table) => {
        if (table === 'acordos') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { ...cabecalho }, error: null }),
              }),
            }),
            update: vi.fn().mockImplementation(() => {
              acordosUpdateCalled = true;
              return { eq: vi.fn().mockResolvedValue({ error: null }) };
            }),
          };
        }
        if (table === 'acordos_passageiros') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockImplementation(() => {
                  selectPassageirosCalls += 1;
                  const rows =
                    selectPassageirosCalls === 1 ? activosAntes : restantesAntes;
                  return Promise.resolve({ data: rows, error: null });
                }),
              }),
            }),
            update: vi.fn().mockImplementation((payload) => {
              updatePassageirosPayload = payload;
              return {
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ error: null }),
                }),
              };
            }),
          };
        }
        if (table === 'ofertas_capacidade') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'of-1', vagas_totais: 4, vagas_disponiveis: 0 },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {};
      });

      const result = await leavePassenger('acordo-1', 'pax-1');

      expect(result.valor_mensal_por_passageiro_kz).toBe(30000);
      expect(result.valor_mensal_total_kz).toBe(120000);
      expect(result.n_passageiros_contrato).toBe(4);
      expect(updatePassageirosPayload).toEqual({ estado: 'saiu' });
      expect(updatePassageirosPayload).not.toHaveProperty('quota_mensal_kz');
      expect(acordosUpdateCalled).toBe(false);
      expect(selectPassageirosCalls).toBeGreaterThanOrEqual(2);
    });

    it('falha se quotas dos restantes mudarem após saída (sem UPDATE de preço)', async () => {
      const activosAntes = [
        { passenger_id: 'pax-1', quota_mensal_kz: 30000, estado: 'activo' },
        { passenger_id: 'pax-2', quota_mensal_kz: 30000, estado: 'activo' },
        { passenger_id: 'pax-3', quota_mensal_kz: 30000, estado: 'activo' },
        { passenger_id: 'pax-4', quota_mensal_kz: 30000, estado: 'activo' },
      ];
      // Simula recálculo errado por COUNT(activos)=3 → 40000
      const restantesRecalculados = [
        { passenger_id: 'pax-2', quota_mensal_kz: 40000, estado: 'activo' },
        { passenger_id: 'pax-3', quota_mensal_kz: 40000, estado: 'activo' },
        { passenger_id: 'pax-4', quota_mensal_kz: 40000, estado: 'activo' },
      ];

      let selectPassageirosCalls = 0;

      supabase.from.mockImplementation((table) => {
        if (table === 'acordos') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { ...cabecalho }, error: null }),
              }),
            }),
          };
        }
        if (table === 'acordos_passageiros') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockImplementation(() => {
                  selectPassageirosCalls += 1;
                  const rows =
                    selectPassageirosCalls === 1
                      ? activosAntes
                      : restantesRecalculados;
                  return Promise.resolve({ data: rows, error: null });
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
          };
        }
        if (table === 'ofertas_capacidade') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'of-1', vagas_totais: 4, vagas_disponiveis: 0 },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {};
      });

      await expect(leavePassenger('acordo-1', 'pax-1')).rejects.toThrow(
        /não pode alterar quotas dos restantes/i,
      );
    });
  });

  describe('anti-padrões de preço / leave', () => {
    it('AgreementService não recalcula por COUNT(activos) nem usa / 4', () => {
      const dir = dirname(fileURLToPath(import.meta.url));
      const src = readFileSync(
        join(dir, '../services/AgreementService.js'),
        'utf8',
      );

      expect(src).not.toMatch(/COUNT\s*\(\s*activos\s*\)/i);
      expect(src).not.toMatch(/\/\s*4(\.0)?\b/);
      expect(src).not.toMatch(/valor_mensal.*=.*N_activos/i);
      expect(src).not.toMatch(/quota_mensal_kz\s*:/);
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
});
