import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createAgreementFromProposal,
  leavePassenger,
  getAgreementsForDriver,
  getAgreementsForPassenger,
} from './AgreementService.js';
import { promoteWaitlist } from './WaitlistService.js';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('./WaitlistService.js', () => ({
  promoteWaitlist: vi.fn().mockResolvedValue(null),
}));

describe('AgreementService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createAgreementFromProposal', () => {
    it('chama RPC accept_proposal e devolve acordo', async () => {
      supabase.rpc.mockResolvedValue({ data: 'acordo-1', error: null });
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'acordo-1',
                n_passageiros_contrato: 3,
                valor_mensal_por_passageiro_kz: 40000,
                valor_mensal_total_kz: 120000,
              },
              error: null,
            }),
          }),
        }),
      });

      const result = await createAgreementFromProposal('prop-1');

      expect(supabase.rpc).toHaveBeenCalledWith('accept_proposal', {
        p_proposta_id: 'prop-1',
      });
      expect(result.id).toBe('acordo-1');
      expect(result.valor_mensal_por_passageiro_kz).toBe(40000);
    });

    it('propaga erro da RPC (ex. vagas insuficientes)', async () => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Vagas insuficientes para este grupo. Use lista de espera.' },
      });
      await expect(createAgreementFromProposal('prop-1')).rejects.toThrow(
        'Vagas insuficientes',
      );
    });
  });

  describe('leavePassenger', () => {
    const preco = {
      id: 'acordo-1',
      oferta_id: 'of-1',
      valor_mensal_por_passageiro_kz: 30000,
      valor_mensal_total_kz: 120000,
      n_passageiros_contrato: 4,
    };

    /**
     * Mock: leave lê quotas activas antes/depois; UPDATE só { estado: 'saiu' }.
     * @param {{ quotasDepois?: object[] }} [opts]
     */
    function mockLeaveFlow(opts = {}) {
      const activosAntes = [
        { passenger_id: 'pax-1', quota_mensal_kz: 30000, estado: 'activo' },
        { passenger_id: 'pax-2', quota_mensal_kz: 30000, estado: 'activo' },
        { passenger_id: 'pax-3', quota_mensal_kz: 30000, estado: 'activo' },
        { passenger_id: 'pax-4', quota_mensal_kz: 30000, estado: 'activo' },
      ];
      const restantes =
        opts.quotasDepois ??
        [
          { passenger_id: 'pax-2', quota_mensal_kz: 30000, estado: 'activo' },
          { passenger_id: 'pax-3', quota_mensal_kz: 30000, estado: 'activo' },
          { passenger_id: 'pax-4', quota_mensal_kz: 30000, estado: 'activo' },
        ];

      let selectPassageirosCalls = 0;
      let updatePayload = null;

      supabase.from.mockImplementation((table) => {
        if (table === 'acordos') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { ...preco }, error: null }),
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
                  const rows = selectPassageirosCalls === 1 ? activosAntes : restantes;
                  return Promise.resolve({ data: rows, error: null });
                }),
              }),
            }),
            update: vi.fn().mockImplementation((payload) => {
              updatePayload = payload;
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

      return {
        getSelectPassageirosCalls: () => selectPassageirosCalls,
        getUpdatePayload: () => updatePayload,
      };
    }

    it('marca passageiro saiu e não altera preços do cabeçalho', async () => {
      const spy = mockLeaveFlow();

      const result = await leavePassenger('acordo-1', 'pax-1');

      expect(result.valor_mensal_por_passageiro_kz).toBe(30000);
      expect(result.valor_mensal_total_kz).toBe(120000);
      expect(result.n_passageiros_contrato).toBe(4);
      expect(spy.getUpdatePayload()).toEqual({ estado: 'saiu' });
      expect(spy.getSelectPassageirosCalls()).toBeGreaterThanOrEqual(2);
    });

    it('preserva quota_mensal_kz dos restantes (sem recálculo por N_activos)', async () => {
      mockLeaveFlow();

      const result = await leavePassenger('acordo-1', 'pax-1');

      expect(result.n_passageiros_contrato).toBe(4);
      expect(result.valor_mensal_total_kz).toBe(120000);
    });

    it('lança se quotas restantes forem alteradas após leave', async () => {
      mockLeaveFlow({
        quotasDepois: [
          { passenger_id: 'pax-2', quota_mensal_kz: 40000, estado: 'activo' },
          { passenger_id: 'pax-3', quota_mensal_kz: 40000, estado: 'activo' },
          { passenger_id: 'pax-4', quota_mensal_kz: 40000, estado: 'activo' },
        ],
      });

      await expect(leavePassenger('acordo-1', 'pax-1')).rejects.toThrow(
        /não pode alterar quotas dos restantes/i,
      );
      expect(promoteWaitlist).not.toHaveBeenCalled();
    });

    it('após leave bem-sucedido promove 1º da waitlist (notif, sem auto-aceitar)', async () => {
      mockLeaveFlow();
      promoteWaitlist.mockResolvedValue({
        id: 'w-1',
        oferta_id: 'of-1',
        estado: 'notificada',
      });

      await leavePassenger('acordo-1', 'pax-1');

      expect(promoteWaitlist).toHaveBeenCalledWith('of-1');
      expect(promoteWaitlist).toHaveBeenCalledTimes(1);
    });

    it('leave não falha se promoção waitlist falhar (best-effort)', async () => {
      mockLeaveFlow();
      promoteWaitlist.mockRejectedValue(new Error('RPC indisponível'));

      const result = await leavePassenger('acordo-1', 'pax-1');

      expect(result.id).toBe('acordo-1');
      expect(promoteWaitlist).toHaveBeenCalledWith('of-1');
    });
  });

  describe('listagens', () => {
    it('getAgreementsForDriver filtra por driver_id', async () => {
      const mockOrder = vi.fn().mockResolvedValue({ data: [{ id: 'a1' }], error: null });
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ order: mockOrder }),
        }),
      });
      const result = await getAgreementsForDriver('driver-1');
      expect(result).toHaveLength(1);
    });

    it('getAgreementsForPassenger via acordos_passageiros', async () => {
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ acordo_id: 'a1', acordos: { id: 'a1', estado: 'activo' } }],
              error: null,
            }),
          }),
        }),
      });
      const result = await getAgreementsForPassenger('pax-1');
      expect(result[0].id).toBe('a1');
    });
  });
});
