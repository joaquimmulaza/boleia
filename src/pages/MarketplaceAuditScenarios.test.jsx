/**
 * Auditoria marketplace — invariantes G1–G4 (contrato público AgreementService + RPC).
 * Cascata / capacidade / N_actual vs N_proposto vivem no servidor; o cliente
 * propaga erros e não muta propostas/quotas localmente.
 *
 * Mensagens RPC alinhadas a `accept_proposal` / `leave_passenger` (projecto boleia).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createAgreementFromProposal,
  leavePassenger,
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

describe('Marketplace audit — cenários G1–G4', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  /**
   * @param {object} acordo
   */
  function mockAcordoSelect(acordo) {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: acordo, error: null }),
        }),
      }),
    });
  }

  describe('G1 — cancelamento em cascata (irmãs abertas → cancelada)', () => {
    it('createAgreementFromProposal chama só accept_proposal e devolve acordo (cascata no servidor)', async () => {
      const acordo = {
        id: 'acordo-aceite',
        procura_id: 'proc-1',
        n_passageiros_contrato: 2,
        valor_mensal_por_passageiro_kz: 50000,
        valor_mensal_total_kz: 100000,
        estado: 'activo',
      };
      supabase.rpc.mockResolvedValue({ data: 'acordo-aceite', error: null });
      mockAcordoSelect(acordo);

      const result = await createAgreementFromProposal('prop-aceitada');

      expect(supabase.rpc).toHaveBeenCalledTimes(1);
      expect(supabase.rpc).toHaveBeenCalledWith('accept_proposal', {
        p_proposta_id: 'prop-aceitada',
      });
      expect(supabase.from).toHaveBeenCalledWith('acordos');
      expect(supabase.from).not.toHaveBeenCalledWith('propostas');
      expect(result.id).toBe('acordo-aceite');
      expect(result.estado).toBe('activo');
    });

    it('documenta efeito RPC: irmãs abertas da mesma procura ficam cancelada (sem UPDATE client)', async () => {
      // Contrato servidor (accept_proposal): após aceite,
      // UPDATE propostas SET estado='cancelada' WHERE procura_id=… AND id<>aceite AND estado='aberta'.
      // O serviço público não cancela no cliente — só RPC + select do acordo.
      supabase.rpc.mockResolvedValue({ data: 'acordo-1', error: null });
      mockAcordoSelect({ id: 'acordo-1', estado: 'activo' });

      await createAgreementFromProposal('prop-1');

      const rpcCalls = supabase.rpc.mock.calls.map(([name]) => name);
      expect(rpcCalls).toEqual(['accept_proposal']);
      expect(supabase.from.mock.calls.every(([table]) => table === 'acordos')).toBe(true);

      const estadoPosRpcEsperado = [
        { id: 'prop-1', estado: 'aceite' },
        { id: 'prop-irma-a', estado: 'cancelada' },
        { id: 'prop-irma-b', estado: 'cancelada' },
      ];
      expect(estadoPosRpcEsperado.filter((p) => p.estado === 'cancelada')).toHaveLength(2);
      expect(estadoPosRpcEsperado.find((p) => p.id === 'prop-1')?.estado).toBe('aceite');
    });
  });

  describe('G2 — N_actual < N_proposto ⇒ aceite falha', () => {
    it('propaga erro RPC quando o grupo tem menos membros que o proposto', async () => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'O grupo tem apenas 2 membros activos; a proposta exige 3.',
        },
      });

      await expect(createAgreementFromProposal('prop-n-alto')).rejects.toThrow(
        /grupo tem apenas 2 membros activos; a proposta exige 3/i,
      );

      expect(supabase.rpc).toHaveBeenCalledWith('accept_proposal', {
        p_proposta_id: 'prop-n-alto',
      });
      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe('G3 — overbooking / capacidade (sem acordo parcial)', () => {
    it('segundo aceite com vagas insuficientes é rejeitado e não selecciona acordo', async () => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'Vagas insuficientes para este grupo. Use lista de espera.',
        },
      });

      await expect(createAgreementFromProposal('prop-overbook')).rejects.toThrow(
        /Vagas insuficientes.*lista de espera/i,
      );

      expect(supabase.rpc).toHaveBeenCalledWith('accept_proposal', {
        p_proposta_id: 'prop-overbook',
      });
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('primeiro aceite com capacidade ok devolve acordo; segundo com insuficiência falha (sem parcial)', async () => {
      const acordoOk = {
        id: 'acordo-1',
        oferta_id: 'of-1',
        n_passageiros_contrato: 2,
        valor_mensal_total_kz: 80000,
        valor_mensal_por_passageiro_kz: 40000,
        estado: 'activo',
      };

      supabase.rpc
        .mockResolvedValueOnce({ data: 'acordo-1', error: null })
        .mockResolvedValueOnce({
          data: null,
          error: {
            message: 'Vagas insuficientes para este grupo. Use lista de espera.',
          },
        });
      mockAcordoSelect(acordoOk);

      const primeiro = await createAgreementFromProposal('prop-a');
      expect(primeiro.id).toBe('acordo-1');
      expect(primeiro.n_passageiros_contrato).toBe(2);

      await expect(createAgreementFromProposal('prop-b')).rejects.toThrow(
        /Vagas insuficientes/i,
      );
      expect(supabase.rpc).toHaveBeenCalledTimes(2);
    });
  });

  describe('G4 — leavePassenger + promote best-effort no servidor', () => {
    const cabecalhoCongelado = {
      id: 'acordo-1',
      oferta_id: 'of-1',
      valor_mensal_por_passageiro_kz: 30000,
      valor_mensal_total_kz: 120000,
      n_passageiros_contrato: 4,
    };

    it('chama leave_passenger e preserva N_contrato / preços no retorno (sem recálculo no cliente)', async () => {
      supabase.rpc.mockResolvedValue({ data: 'acordo-1', error: null });
      mockAcordoSelect({ ...cabecalhoCongelado });

      const result = await leavePassenger('acordo-1', 'pax-sair');

      expect(supabase.rpc).toHaveBeenCalledWith(
        'leave_passenger',
        expect.objectContaining({
          p_acordo_id: 'acordo-1',
          p_passenger_id: 'pax-sair',
          p_idempotency_key: expect.any(String),
        }),
      );
      // Promote waitlist é best-effort dentro da RPC leave_passenger — cliente não chama promote_waitlist.
      expect(supabase.rpc).toHaveBeenCalledTimes(1);
      expect(supabase.rpc.mock.calls.map(([n]) => n)).not.toContain('promote_waitlist');

      expect(result.n_passageiros_contrato).toBe(4);
      expect(result.valor_mensal_por_passageiro_kz).toBe(30000);
      expect(result.valor_mensal_total_kz).toBe(120000);
      expect(supabase.from).toHaveBeenCalledWith('acordos');
      expect(supabase.from).not.toHaveBeenCalledWith('acordos_passageiros');
    });
  });
});

describe.skip('Marketplace audit — G5–G12 (esboço)', () => {
  it.todo('G5 — leave promove waitlist FIFO (notificada, sem auto-aceitar)');
  it.todo('G6 — Sense B createProposta created_by motorista');
  it.todo('G7 — copy adenda «próximo mês»');
  it.todo('G8 — notificationRouter waitlist_promoted');
  it.todo('G9 — falta quota/dias_uteis numérica');
  it.todo('G10 — overbooking multi-acordo (já coberto em G3 do serviço)');
  it.todo('G11 — RLS sem UPDATE client em tabelas críticas');
  it.todo('G12 — UI hubs sem jargon N_* / POR_PASSAGEIRO');
});
