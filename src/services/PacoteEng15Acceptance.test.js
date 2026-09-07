/**
 * PACOTE ENG #15 — saída parcial de passageiro no acordo 1:N.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leavePassenger } from './AgreementService.js';
import { supabase } from '../lib/supabase';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');
const ENG15_MIGRATION = '20260907050000_pacote_eng15_saida_parcial_passageiro.sql';

/** @param {string} filename */
function readMigration(filename) {
  return readFileSync(join(MIGRATIONS, filename), 'utf8');
}

/** Extrai corpo da função leave_passenger na migração ENG#15. */
function leavePassengerSqlBlock() {
  const sql = readMigration(ENG15_MIGRATION);
  const start = sql.indexOf('CREATE OR REPLACE FUNCTION public.leave_passenger');
  const end = sql.indexOf('$function$;', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end + '$function$;'.length);
}

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

describe('PACOTE ENG #15 — saída parcial passageiro 1:N', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  describe('1 — Saída explícita com auth', () => {
    it('SQL exige auth.uid() e valida permissão', () => {
      const block = leavePassengerSqlBlock();
      expect(block).toMatch(/auth\.uid\(\)/);
      expect(block).toMatch(/Não autenticado/);
      expect(block).toMatch(/Sem permissão para sair deste acordo/);
    });

    it('leavePassenger delega ao RPC com idempotency_key', async () => {
      supabase.rpc.mockResolvedValue({ data: 'acordo-1', error: null });
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'acordo-1',
            n_passageiros_contrato: 3,
            valor_mensal_por_passageiro_kz: 25000,
            valor_mensal_total_kz: 75000,
          },
          error: null,
        }),
      });

      await leavePassenger('acordo-1', 'pax-1');

      expect(supabase.rpc).toHaveBeenCalledWith(
        'leave_passenger',
        expect.objectContaining({
          p_acordo_id: 'acordo-1',
          p_passenger_id: 'pax-1',
          p_idempotency_key: expect.any(String),
        }),
      );
    });
  });

  describe('2 — N_activos desce; N_contrato histórico imutável', () => {
    it('SQL marca só a linha do passageiro como saiu', () => {
      const block = leavePassengerSqlBlock();
      expect(block).toMatch(/UPDATE public\.acordos_passageiros[\s\S]*estado = 'saiu'/);
      expect(block).not.toMatch(/UPDATE public\.acordos[\s\S]*n_passageiros_contrato/);
      expect(block).not.toMatch(/quota_mensal_kz\s*=/);
    });

    it('cliente preserva n_passageiros_contrato e preços congelados após RPC', async () => {
      const cabecalho = {
        id: 'acordo-n',
        oferta_id: 'of-1',
        n_passageiros_contrato: 4,
        valor_mensal_por_passageiro_kz: 30000,
        valor_mensal_total_kz: 120000,
      };
      supabase.rpc.mockResolvedValue({ data: 'acordo-n', error: null });
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: cabecalho, error: null }),
      });

      const result = await leavePassenger('acordo-n', 'pax-sair');

      expect(result.n_passageiros_contrato).toBe(4);
      expect(result.valor_mensal_por_passageiro_kz).toBe(30000);
      expect(result.valor_mensal_total_kz).toBe(120000);
    });
  });

  describe('3 — Preço/liquidação: nunca defaults da plataforma', () => {
    it('SQL leave_passenger não toca pagamentos nem valores do acordo', () => {
      const block = leavePassengerSqlBlock();
      expect(block).not.toMatch(/pagamentos_acordo/);
      expect(block).not.toMatch(/valor_mensal/);
      expect(block).not.toMatch(/n_passageiros_contrato\s*=/);
    });

    it('AgreementService não recalcula quotas no cliente', () => {
      const src = readFileSync(join(ROOT, 'AgreementService.js'), 'utf8');
      const leaveFn = src.slice(
        src.indexOf('export async function leavePassenger'),
        src.indexOf('export async function renegotiateAgreementPricing'),
      );
      expect(leaveFn).not.toMatch(/quota_mensal_kz\s*=/);
      expect(leaveFn).not.toMatch(/valor_mensal.*=/);
      expect(leaveFn).not.toMatch(/resolveAgreementPricing/);
    });
  });

  describe('4 — Capacidade libertada via recount_oferta_vagas (#8)', () => {
    it('SQL usa recount_oferta_vagas em vez de cálculo inline de vagas', () => {
      const block = leavePassengerSqlBlock();
      expect(block).toMatch(/recount_oferta_vagas/);
      expect(block).not.toMatch(/vagas_disponiveis\s*:=/);
      expect(block).not.toMatch(/v_ocupadas/);
    });

    it('promote_waitlist best-effort após recount', () => {
      const block = leavePassengerSqlBlock();
      expect(block).toMatch(/promote_waitlist/);
      expect(block).toMatch(/best-effort/i);
    });
  });

  describe('5 — Resto do acordo 1:N intacto (sem cancelamento total)', () => {
    it('SQL não cancela o cabeçalho do acordo', () => {
      const block = leavePassengerSqlBlock();
      expect(block).not.toMatch(/UPDATE public\.acordos[\s\S]*estado\s*=\s*'cancelado'/);
      expect(block).not.toMatch(/cancelado_em/);
    });

    it('SQL não marca todos os passageiros como saiu', () => {
      const block = leavePassengerSqlBlock();
      const updates = block.match(/UPDATE public\.acordos_passageiros/g) || [];
      expect(updates.length).toBe(1);
      expect(block).not.toMatch(
        /UPDATE public\.acordos_passageiros[\s\S]*WHERE acordo_id[\s\S]*lower\(estado\) = 'activo'/,
      );
    });

    it('leavePassenger não chama terminate_agreement', async () => {
      supabase.rpc.mockResolvedValue({ data: 'acordo-1', error: null });
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'acordo-1', n_passageiros_contrato: 2 },
          error: null,
        }),
      });

      await leavePassenger('acordo-1', 'pax-1');

      expect(supabase.rpc.mock.calls.map(([name]) => name)).not.toContain('terminate_agreement');
    });
  });

  describe('6 — CTAs só com auth; estados claros (UI)', () => {
    it('MyAgreements: Sair só eu usa leavePassenger com user.id', () => {
      const src = readFileSync(join(ROOT, '../pages/MyAgreements.jsx'), 'utf8');
      expect(src).toMatch(/leavePassenger\(acordoId, user\.id\)/);
      expect(src).toMatch(/Sair só eu/);
      expect(src).toMatch(/acordo mantém-se activo para os restantes/i);
    });

    it('MyAgreements: podeSair exige passageiro activo', () => {
      const src = readFileSync(join(ROOT, '../pages/MyAgreements.jsx'), 'utf8');
      expect(src).toMatch(/const podeSair\s*=\s*\n\s*isPassageiro && activo/);
      expect(src).toMatch(/estadoPassageiroLabel/);
      expect(src).toMatch(/saiu/);
    });

    it('MyAgreements: motorista vê Encerrar acordo; Sair só eu condicionado a podeSair', () => {
      const src = readFileSync(join(ROOT, '../pages/MyAgreements.jsx'), 'utf8');
      expect(src).toMatch(/podeEncerrar = activo && \(isMotorista \|\| podeSair\)/);
      expect(src).toMatch(/\{podeSair &&/);
      expect(src).toMatch(/\{podeEncerrar &&/);
      expect(src).toMatch(/Encerrar acordo/);
    });
  });
});
