import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createAgreementFromProposal,
  leavePassenger,
  renegotiateAgreementPricing,
  acceptAgreementAdenda,
  rejectAgreementAdenda,
  terminateAgreement,
  getAgreementsForDriver,
  getAgreementsForPassenger,
} from './AgreementService.js';
import { resolveAgreementPricing } from '../utils/resolveAgreementPricing.js';
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

describe('AgreementService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  describe('createAgreementFromProposal', () => {
    it('chama RPC accept_proposal com p_idempotency_key e devolve acordo', async () => {
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

      expect(supabase.rpc).toHaveBeenCalledWith(
        'accept_proposal',
        expect.objectContaining({
          p_proposta_id: 'prop-1',
          p_idempotency_key: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
          ),
        }),
      );
      expect(result.id).toBe('acordo-1');
      expect(result.valor_mensal_por_passageiro_kz).toBe(40000);
    });

    it('envia p_member_ids quando memberIds é fornecido', async () => {
      supabase.rpc.mockResolvedValue({ data: 'acordo-2', error: null });
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'acordo-2', n_passageiros_contrato: 2 },
              error: null,
            }),
          }),
        }),
      });

      await createAgreementFromProposal('prop-1', {
        memberIds: ['pax-a', 'pax-b'],
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'accept_proposal',
        expect.objectContaining({
          p_proposta_id: 'prop-1',
          p_member_ids: ['pax-a', 'pax-b'],
          p_idempotency_key: expect.any(String),
        }),
      );
    });

    it('em falha de rede enfileira accept_proposal e devolve offlineQueued', async () => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

      const result = await createAgreementFromProposal('prop-1');

      expect(result.offlineQueued).toBe(true);
      expect(result.idempotency_key).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(supabase.rpc).not.toHaveBeenCalled();
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

    it('propaga erro quando o criador tenta aceitar a própria proposta', async () => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'Só a contraparte pode aceitar ou rejeitar esta proposta.',
        },
      });
      await expect(createAgreementFromProposal('prop-1')).rejects.toThrow(
        /só a contraparte/i,
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

    function mockLeaveRpcOk() {
      supabase.rpc.mockResolvedValue({ data: 'acordo-1', error: null });
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { ...preco }, error: null }),
          }),
        }),
      });
    }

    it('chama RPC leave_passenger (atómica: saiu + vagas + waitlist no servidor)', async () => {
      mockLeaveRpcOk();

      const result = await leavePassenger('acordo-1', 'pax-1');

      expect(supabase.rpc).toHaveBeenCalledWith(
        'leave_passenger',
        expect.objectContaining({
          p_acordo_id: 'acordo-1',
          p_passenger_id: 'pax-1',
          p_idempotency_key: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
          ),
        }),
      );
      expect(result.valor_mensal_por_passageiro_kz).toBe(30000);
      expect(result.valor_mensal_total_kz).toBe(120000);
      expect(result.n_passageiros_contrato).toBe(4);
      });

    it('preserva N_contrato e totais no cabeçalho devolvido (sem recálculo por N_activos)', async () => {
      mockLeaveRpcOk();

      const result = await leavePassenger('acordo-1', 'pax-1');

      expect(result.n_passageiros_contrato).toBe(4);
      expect(result.valor_mensal_total_kz).toBe(120000);
    });

    it('propaga erro da RPC (ex. sem permissão / já saiu)', async () => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Sem permissão para sair deste acordo.' },
      });

      await expect(leavePassenger('acordo-1', 'pax-1')).rejects.toThrow(
        /sem permissão/i,
      );
    });

    it('exige acordoId e passengerId', async () => {
      await expect(leavePassenger('', 'pax-1')).rejects.toThrow(/obrigatór/i);
      await expect(leavePassenger('acordo-1', '')).rejects.toThrow(/obrigatór/i);
      expect(supabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe('renegotiateAgreementPricing', () => {
    /**
     * Mock: conta activos (head) + RPC + select acordo actualizado.
     * @param {{ acordo?: object, rpcError?: { message: string }|null, activosCount?: number }} [opts]
     */
    function mockRenegotiateFlow(opts = {}) {
      const activosCount = opts.activosCount ?? 3;
      const acordo = opts.acordo ?? {
        id: 'acordo-1',
        modo_preco: 'TOTAL_ACORDO',
        n_passageiros_contrato: 3,
        valor_mensal_total_kz: 90000,
        valor_mensal_por_passageiro_kz: 30000,
        estado: 'activo',
      };

      if (opts.rpcError) {
        supabase.rpc.mockResolvedValue({ data: null, error: opts.rpcError });
      } else {
        supabase.rpc.mockResolvedValue({ data: 'acordo-1', error: null });
      }

      supabase.from.mockImplementation((table) => {
        if (table === 'acordos_passageiros') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  count: activosCount,
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
                single: vi.fn().mockResolvedValue({ data: acordo, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      return { acordo };
    }

    it('após leave (N activos=3) agenda adenda sem mutar preço do mês corrente', async () => {
      const pricing = resolveAgreementPricing({
        modo_preco: 'TOTAL_ACORDO',
        valor_ask_kz: 90000,
        n_passageiros: 3,
      });
      mockRenegotiateFlow({
        activosCount: 3,
        acordo: {
          id: 'acordo-1',
          modo_preco: 'TOTAL_ACORDO',
          // Mês corrente permanece no contrato original (ex. 120k / 4)
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
            previo_valor_mensal_total_kz: 120000,
            previo_valor_mensal_por_passageiro_kz: 30000,
            previo_n_passageiros_contrato: 4,
          },
        },
      });

      const result = await renegotiateAgreementPricing('acordo-1', {
        modo_preco: 'TOTAL_ACORDO',
        valor_ask_kz: 90000,
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'renegotiate_agreement_pricing',
        expect.objectContaining({
          p_acordo_id: 'acordo-1',
          p_modo_preco: 'TOTAL_ACORDO',
          p_valor_ask_kz: 90000,
          p_n_passageiros: 3,
          p_idempotency_key: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
          ),
        }),
      );
      // Live (mês corrente) intacto
      expect(result.n_passageiros_contrato).toBe(4);
      expect(result.valor_mensal_total_kz).toBe(120000);
      expect(result.valor_mensal_por_passageiro_kz).toBe(30000);
      // Novo preço só na adenda pendente (próximo mês)
      expect(result.adenda_pendente.effective_from).toBe('2026-10-01');
      expect(result.adenda_pendente.valor_mensal_total_kz).toBe(90000);
      expect(result.adenda_pendente.n_passageiros_contrato).toBe(3);
      expect(result.adenda_pendente.previo_valor_mensal_total_kz).toBe(120000);
      expect(pricing.quotas).toEqual([30000, 30000, 30000]);
    });

    it('POR_PASSAGEIRO resolve pricing e agenda adenda (live intacto)', async () => {
      const pricing = resolveAgreementPricing({
        modo_preco: 'POR_PASSAGEIRO',
        valor_ask_kz: 35000,
        n_passageiros: 2,
      });
      mockRenegotiateFlow({
        activosCount: 2,
        acordo: {
          id: 'acordo-1',
          modo_preco: 'POR_PASSAGEIRO',
          n_passageiros_contrato: 2,
          valor_mensal_total_kz: 60000,
          valor_mensal_por_passageiro_kz: 30000,
          estado: 'activo',
          adenda_pendente: {
            effective_from: '2026-10-01',
            modo_preco: 'POR_PASSAGEIRO',
            n_passageiros_contrato: 2,
            valor_mensal_total_kz: pricing.valor_mensal_total_kz,
            valor_mensal_por_passageiro_kz: pricing.valor_mensal_por_passageiro_kz,
            previo_valor_mensal_por_passageiro_kz: 30000,
          },
        },
      });

      const result = await renegotiateAgreementPricing('acordo-1', {
        modo_preco: 'POR_PASSAGEIRO',
        valor_ask_kz: 35000,
        n_passageiros: 2,
      });

      expect(result.valor_mensal_por_passageiro_kz).toBe(30000);
      expect(result.valor_mensal_total_kz).toBe(60000);
      expect(result.adenda_pendente.valor_mensal_por_passageiro_kz).toBe(35000);
      expect(result.adenda_pendente.valor_mensal_total_kz).toBe(70000);
      expect(pricing.quotas).toEqual([35000, 35000]);
    });

    it('TOTAL_ACORDO com resto espelha resolveAgreementPricing na adenda pendente', async () => {
      const pricing = resolveAgreementPricing({
        modo_preco: 'TOTAL_ACORDO',
        valor_ask_kz: 100000,
        n_passageiros: 3,
      });
      mockRenegotiateFlow({
        activosCount: 3,
        acordo: {
          id: 'acordo-1',
          modo_preco: 'TOTAL_ACORDO',
          n_passageiros_contrato: 3,
          valor_mensal_total_kz: 90000,
          valor_mensal_por_passageiro_kz: 30000,
          estado: 'activo',
          adenda_pendente: {
            effective_from: '2026-10-01',
            modo_preco: 'TOTAL_ACORDO',
            n_passageiros_contrato: 3,
            valor_mensal_total_kz: pricing.valor_mensal_total_kz,
            valor_mensal_por_passageiro_kz: pricing.valor_mensal_por_passageiro_kz,
          },
        },
      });

      const result = await renegotiateAgreementPricing('acordo-1', {
        modo_preco: 'TOTAL_ACORDO',
        valor_ask_kz: 100000,
        n_passageiros: 3,
      });

      expect(result.valor_mensal_por_passageiro_kz).toBe(30000);
      expect(result.adenda_pendente.valor_mensal_por_passageiro_kz).toBe(33333);
      expect(pricing.quotas).toEqual([33334, 33333, 33333]);
      expect(supabase.rpc).toHaveBeenCalledWith(
        'renegotiate_agreement_pricing',
        expect.objectContaining({
          p_valor_ask_kz: 100000,
          p_n_passageiros: 3,
        }),
      );
    });

    it('adenda_pendente inclui effective_from no 1.º dia do mês seguinte e contrato prévio auditável', async () => {
      mockRenegotiateFlow({
        activosCount: 3,
        acordo: {
          id: 'acordo-1',
          modo_preco: 'POR_PASSAGEIRO',
          n_passageiros_contrato: 3,
          valor_mensal_total_kz: 120000,
          valor_mensal_por_passageiro_kz: 40000,
          estado: 'activo',
          adenda_pendente: {
            id: 'adenda-1',
            effective_from: '2026-10-01',
            modo_preco: 'TOTAL_ACORDO',
            n_passageiros_contrato: 3,
            valor_mensal_total_kz: 90000,
            valor_mensal_por_passageiro_kz: 30000,
            previo_modo_preco: 'POR_PASSAGEIRO',
            previo_n_passageiros_contrato: 3,
            previo_valor_mensal_total_kz: 120000,
            previo_valor_mensal_por_passageiro_kz: 40000,
            previo_quotas: [
              { passenger_id: 'pax-1', quota_mensal_kz: 40000 },
              { passenger_id: 'pax-2', quota_mensal_kz: 40000 },
              { passenger_id: 'pax-3', quota_mensal_kz: 40000 },
            ],
            applied_at: null,
          },
        },
      });

      const result = await renegotiateAgreementPricing('acordo-1', {
        modo_preco: 'TOTAL_ACORDO',
        valor_ask_kz: 90000,
        n_passageiros: 3,
      });

      expect(result.adenda_pendente.effective_from).toMatch(/^\d{4}-\d{2}-01$/);
      expect(result.adenda_pendente.previo_valor_mensal_total_kz).toBe(120000);
      expect(result.adenda_pendente.previo_quotas).toHaveLength(3);
      expect(result.adenda_pendente.applied_at).toBeNull();
    });

    it('rejeita se não autenticado (erro RPC)', async () => {
      mockRenegotiateFlow({
        rpcError: { message: 'Não autenticado.' },
      });

      await expect(
        renegotiateAgreementPricing('acordo-1', {
          modo_preco: 'TOTAL_ACORDO',
          valor_ask_kz: 90000,
          n_passageiros: 3,
        }),
      ).rejects.toThrow(/não autenticado/i);
    });

    it('rejeita se não for o motorista do acordo', async () => {
      mockRenegotiateFlow({
        rpcError: { message: 'Sem permissão para renegociar este acordo.' },
      });

      await expect(
        renegotiateAgreementPricing('acordo-1', {
          modo_preco: 'TOTAL_ACORDO',
          valor_ask_kz: 90000,
          n_passageiros: 3,
        }),
      ).rejects.toThrow(/sem permissão/i);
    });

    it('rejeita se o acordo não estiver activo', async () => {
      mockRenegotiateFlow({
        rpcError: { message: 'Acordo não está activo.' },
      });

      await expect(
        renegotiateAgreementPricing('acordo-1', {
          modo_preco: 'TOTAL_ACORDO',
          valor_ask_kz: 90000,
          n_passageiros: 3,
        }),
      ).rejects.toThrow(/não está activo/i);
    });

    it('exige acordoId e input de preço', async () => {
      await expect(renegotiateAgreementPricing('', { modo_preco: 'TOTAL_ACORDO', valor_ask_kz: 1 })).rejects.toThrow(
        /acordo/i,
      );
      await expect(renegotiateAgreementPricing('acordo-1', null)).rejects.toThrow();
    });

    it('adenda criada fica pendente_passageiro até consentimento', async () => {
      mockRenegotiateFlow({
        activosCount: 2,
        acordo: {
          id: 'acordo-1',
          modo_preco: 'POR_PASSAGEIRO',
          n_passageiros_contrato: 2,
          valor_mensal_total_kz: 80000,
          valor_mensal_por_passageiro_kz: 40000,
          estado: 'activo',
          acordos_adendas: [
            {
              id: 'adenda-new',
              estado: 'pendente_passageiro',
              effective_from: '2026-10-01',
              valor_mensal_por_passageiro_kz: 45000,
              valor_mensal_total_kz: 90000,
              applied_at: null,
              superseded_at: null,
            },
          ],
        },
      });

      const result = await renegotiateAgreementPricing('acordo-1', {
        modo_preco: 'POR_PASSAGEIRO',
        valor_ask_kz: 45000,
        n_passageiros: 2,
      });

      expect(result.adenda_pendente.estado).toBe('pendente_passageiro');
      expect(result.adenda_pendente.applied_at).toBeNull();
    });

    it('em falha de rede enfileira renegotiate_agreement_pricing e devolve offlineQueued', async () => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

      const result = await renegotiateAgreementPricing('acordo-1', {
        modo_preco: 'TOTAL_ACORDO',
        valor_ask_kz: 90000,
        n_passageiros: 3,
      });

      expect(result.offlineQueued).toBe(true);
      expect(result.idempotency_key).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(supabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe('acceptAgreementAdenda', () => {
    it('chama RPC accept_agreement_adenda com p_idempotency_key e devolve adenda aceite', async () => {
      supabase.rpc.mockResolvedValue({ data: 'adenda-1', error: null });
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'adenda-1',
                acordo_id: 'acordo-1',
                estado: 'aceite',
                effective_from: '2026-10-01',
                applied_at: null,
                aceite_em: '2026-09-05T16:00:00Z',
              },
              error: null,
            }),
          }),
        }),
      });

      const result = await acceptAgreementAdenda('adenda-1');

      expect(supabase.rpc).toHaveBeenCalledWith(
        'accept_agreement_adenda',
        expect.objectContaining({
          p_adenda_id: 'adenda-1',
          p_idempotency_key: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
          ),
        }),
      );
      expect(result.estado).toBe('aceite');
      expect(result.applied_at).toBeNull();
      expect(result.aceite_em).toBeTruthy();
    });

    it('em falha de rede enfileira accept_agreement_adenda e devolve offlineQueued', async () => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

      const result = await acceptAgreementAdenda('adenda-1');

      expect(result.offlineQueued).toBe(true);
      expect(result.idempotency_key).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('propaga erro da RPC (ex. motorista a tentar aceitar)', async () => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Apenas um passageiro activo do acordo pode aceitar a adenda.' },
      });

      await expect(acceptAgreementAdenda('adenda-1')).rejects.toThrow(
        /passageiro activo/i,
      );
    });

    it('exige id da adenda', async () => {
      await expect(acceptAgreementAdenda('')).rejects.toThrow(/adenda/i);
    });
  });

  describe('rejectAgreementAdenda', () => {
    it('chama RPC reject_agreement_adenda e devolve adenda rejeitada', async () => {
      supabase.rpc.mockResolvedValue({ data: 'adenda-1', error: null });
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'adenda-1',
                acordo_id: 'acordo-1',
                estado: 'rejeitada',
                applied_at: null,
              },
              error: null,
            }),
          }),
        }),
      });

      const result = await rejectAgreementAdenda('adenda-1');

      expect(supabase.rpc).toHaveBeenCalledWith('reject_agreement_adenda', {
        p_adenda_id: 'adenda-1',
      });
      expect(result.estado).toBe('rejeitada');
    });

    it('em falha de rede enfileira reject_agreement_adenda', async () => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

      const result = await rejectAgreementAdenda('adenda-1');

      expect(result.offlineQueued).toBe(true);
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('exige id da adenda', async () => {
      await expect(rejectAgreementAdenda('')).rejects.toThrow(/adenda/i);
    });
  });

  describe('terminateAgreement', () => {
    it('chama RPC terminate_agreement com modo aviso_previo', async () => {
      supabase.rpc.mockResolvedValue({ data: 'acordo-1', error: null });
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'acordo-1', estado: 'cancelamento_pendente' },
              error: null,
            }),
          }),
        }),
      });

      const result = await terminateAgreement('acordo-1', { modo: 'aviso_previo' });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'terminate_agreement',
        expect.objectContaining({
          p_acordo_id: 'acordo-1',
          p_modo: 'aviso_previo',
          p_idempotency_key: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
          ),
        }),
      );
      expect(result.estado).toBe('cancelamento_pendente');
    });

    it('envia justificativa para justa_causa', async () => {
      supabase.rpc.mockResolvedValue({ data: 'acordo-1', error: null });
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'acordo-1', estado: 'cancelado_justificado' },
              error: null,
            }),
          }),
        }),
      });

      await terminateAgreement('acordo-1', {
        modo: 'justa_causa',
        justificativa: 'avaria_veiculo',
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'terminate_agreement',
        expect.objectContaining({
          p_modo: 'justa_causa',
          p_justificativa: 'avaria_veiculo',
        }),
      );
    });

    it('exige acordoId e modo válido', async () => {
      await expect(terminateAgreement('', { modo: 'consensual' })).rejects.toThrow(/acordo/i);
      await expect(terminateAgreement('acordo-1', { modo: '' })).rejects.toThrow(/modo/i);
    });
  });

  describe('listagens', () => {
    it('getAgreementsForDriver filtra por driver_id e aplica lazy RPCs', async () => {
      supabase.rpc.mockResolvedValue({ data: 0, error: null });
      const mockOrder = vi.fn().mockResolvedValue({ data: [{ id: 'a1' }], error: null });
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ order: mockOrder }),
        }),
      });
      const result = await getAgreementsForDriver('driver-1');
      expect(result).toHaveLength(1);
      expect(supabase.rpc).toHaveBeenCalledWith('apply_due_agreement_adendas', {
        p_acordo_id: null,
      });
      expect(supabase.rpc).toHaveBeenCalledWith('apply_due_agreement_terminations', {
        p_acordo_id: null,
      });
    });

    it('getAgreementsForPassenger via acordos_passageiros e aplica lazy RPCs', async () => {
      supabase.rpc.mockResolvedValue({ data: 0, error: null });
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
      expect(supabase.rpc).toHaveBeenCalledWith('apply_due_agreement_terminations', {
        p_acordo_id: null,
      });
    });
  });
});
