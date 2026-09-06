/**
 * G15 — auditoria cancelamento (agendado vs justa causa).
 * Espelha cenários da visão §5 Marketplace Renegotiation and Termination Audit.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  terminateAgreement,
  getAgreementsForPassenger,
} from '../services/AgreementService.js';
import { firstDayNextMonthLuanda } from '../utils/adendaEffectiveFrom.js';
import { supabase } from '../lib/supabase';

const AUDIT_DIR = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(AUDIT_DIR, '../../supabase/migrations');

/** @param {string} filename */
function readMigration(filename) {
  return readFileSync(join(MIGRATIONS_DIR, filename), 'utf8');
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

describe('Marketplace Termination Audit — G15', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const ACORDO_LIVE = {
    id: 'acordo-g15',
    estado: 'activo',
    modo_preco: 'POR_PASSAGEIRO',
    n_passageiros_contrato: 2,
    valor_mensal_total_kz: 60000,
    valor_mensal_por_passageiro_kz: 30000,
    dias_uteis_mes: 22,
    oferta_id: 'oferta-g15',
  };

  /** @param {object} acordo */
  function mockAcordoSelect(acordo) {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: acordo, error: null }),
        }),
      }),
    });
  }

  it('G15 — aviso prévio (sem justa causa) → cancelamento_pendente; preços congelados intactos', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T10:00:00.000Z'));
    const effectiveFrom = firstDayNextMonthLuanda();

    supabase.rpc.mockResolvedValue({ data: 'acordo-g15', error: null });
    mockAcordoSelect({
      ...ACORDO_LIVE,
      estado: 'cancelamento_pendente',
      rescisao_modo: 'aviso_previo',
      rescisao_effective_on: effectiveFrom,
      valor_mensal_por_passageiro_kz: 30000,
      valor_mensal_total_kz: 60000,
    });

    const result = await terminateAgreement('acordo-g15', { modo: 'aviso_previo' });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'terminate_agreement',
      expect.objectContaining({
        p_acordo_id: 'acordo-g15',
        p_modo: 'aviso_previo',
        p_idempotency_key: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
      }),
    );
    expect(String(result.estado).toLowerCase()).toBe('cancelamento_pendente');
    expect(result.rescisao_effective_on).toBe(effectiveFrom);
    expect(result.valor_mensal_por_passageiro_kz).toBe(30000);
    expect(result.valor_mensal_total_kz).toBe(60000);
  });

  it('G15 — justa causa → cancelado imediato (cancelado_justificado); envia justificativa', async () => {
    supabase.rpc.mockResolvedValue({ data: 'acordo-g15', error: null });
    mockAcordoSelect({
      ...ACORDO_LIVE,
      estado: 'cancelado_justificado',
      rescisao_modo: 'justa_causa',
      rescisao_justificativa: 'avaria_veiculo',
      cancelado_em: '2026-09-06T12:00:00.000Z',
    });

    const result = await terminateAgreement('acordo-g15', {
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
    expect(String(result.estado).toLowerCase()).toMatch(/cancelado/);
  });

  it('G15 — idempotência: mesma chave reutilizada na RPC', async () => {
    const key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    supabase.rpc.mockResolvedValue({ data: 'acordo-g15', error: null });
    mockAcordoSelect({ ...ACORDO_LIVE, estado: 'cancelamento_pendente' });

    await terminateAgreement('acordo-g15', { modo: 'aviso_previo' }, { idempotencyKey: key });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'terminate_agreement',
      expect.objectContaining({ p_idempotency_key: key }),
    );
  });

  it('G15 — apply_due_agreement_terminations no load liberta acordo após effective_on', async () => {
    supabase.rpc.mockImplementation(async (name) => {
      if (name === 'apply_due_agreement_adendas') return { data: 0, error: null };
      if (name === 'apply_due_agreement_terminations') return { data: 1, error: null };
      return { data: null, error: null };
    });

    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                acordo_id: 'acordo-g15',
                acordos: {
                  id: 'acordo-g15',
                  estado: 'cancelado',
                  rescisao_effective_on: '2026-09-01',
                },
              },
            ],
            error: null,
          }),
        }),
      }),
    });

    const rows = await getAgreementsForPassenger('pax-g15');

    expect(supabase.rpc).toHaveBeenCalledWith('apply_due_agreement_terminations', {
      p_acordo_id: null,
    });
    expect(String(rows[0].estado).toLowerCase()).toBe('cancelado');
  });

  it('G15 — contrato SQL aviso_previo: não liberta vagas (sem recount_oferta_vagas)', () => {
    const sql = readMigration('20260906114309_s22_terminate_agreement.sql');
    const avisoBlock = sql.slice(
      sql.indexOf("IF v_modo = 'aviso_previo'"),
      sql.indexOf("ELSIF v_modo = 'consensual'"),
    );

    expect(avisoBlock).toContain("estado = 'cancelamento_pendente'");
    expect(avisoBlock).toContain('rescisao_effective_on = v_effective');
    expect(avisoBlock).not.toMatch(/recount_oferta_vagas/);
  });

  it('G15 — contrato SQL justa_causa: liberta vagas via recount_oferta_vagas', () => {
    const sql = readMigration('20260906114309_s22_terminate_agreement.sql');
    const justaBlock = sql.slice(
      sql.indexOf("estado = 'cancelado_justificado'"),
      sql.indexOf('v_mensagem := \'A outra parte rescindiu'),
    );

    expect(justaBlock).toMatch(/recount_oferta_vagas/);
    expect(justaBlock).toMatch(/promote_waitlist/);
  });

  it('G15 — contrato SQL apply_due: cancelamento_pendente → cancelado + passageiros saiu + vagas', () => {
    const sql = readMigration('20260906123609_s22_rpc_grants_hardening.sql');
    const applyBlock = sql.slice(
      sql.indexOf('CREATE OR REPLACE FUNCTION public.apply_due_agreement_terminations'),
      sql.indexOf('REVOKE ALL ON FUNCTION public.renegotiate_agreement_pricing'),
    );

    expect(applyBlock).toContain("lower(estado) = 'cancelamento_pendente'");
    expect(applyBlock).toContain("estado = 'cancelado'");
    expect(applyBlock).toMatch(/recount_oferta_vagas/);
    expect(applyBlock).toContain("estado = 'saiu'");
  });

  it('G15 — contrato SQL idempotência: early return se chave já existe', () => {
    const sql = readMigration('20260906114309_s22_terminate_agreement.sql');

    expect(sql).toMatch(
      /IF p_idempotency_key IS NOT NULL[\s\S]*?RETURN p_acordo_id/,
    );
    expect(sql).toContain("'terminate_agreement'");
  });
});
