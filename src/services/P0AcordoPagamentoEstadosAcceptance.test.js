/**
 * P0 acordo × pagamento — contrato migração + serviços (fail-on-old-code em main).
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getObrigacaoPagamentoPassageiro,
  listPagamentosPendentesMotoristaAcordo,
  listPagamentosResolucaoAdmin,
} from './PaymentService.js';
import { supabase } from '../lib/supabase';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');
const MIGRATION_FILE = '20261009180000_p0_acordo_pagamento_estados.sql';
const PG_PROOF = join(ROOT, '../../scripts/run-p0-acordo-pagamento-pg-proof.sh');
const BACKFILL = join(ROOT, '../../supabase/scripts/p0_backfill.sql');

/** @param {string} filename */
function readMigration(filename) {
  return readFileSync(join(MIGRATIONS, filename), 'utf8');
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

describe('P0 acordo pagamento estados — migração obrigatória', () => {
  /** @type {string} */
  let sql;

  beforeAll(() => {
    sql = readMigration(MIGRATION_FILE);
  });

  it('ficheiro de migração 20261009180000 existe (main falha aqui)', () => {
    expect(existsSync(join(MIGRATIONS, MIGRATION_FILE))).toBe(true);
  });

  it('script backfill separado existe', () => {
    expect(existsSync(BACKFILL)).toBe(true);
  });

  it('script prova PG main→#243→branch existe', () => {
    expect(existsSync(PG_PROOF)).toBe(true);
    const sh = readFileSync(PG_PROOF, 'utf8');
    expect(sh).toMatch(/20261009180000_p0_acordo_pagamento_estados/);
    expect(sh).toMatch(/sec-default-privileges/);
  });

  it('estado anulado no CHECK de pagamentos_acordo', () => {
    expect(sql).toMatch(/'anulado'::text/);
  });

  it('função única calc_quota_proporcional_kz + build_ui_obrigacao_snapshot', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.calc_quota_proporcional_kz/);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.build_ui_obrigacao_snapshot/);
    expect(sql).toMatch(/'valor_em_divida', v_valor/);
    expect(sql).toMatch(/'quota', v_quota/);
    expect(sql).toMatch(/get_obrigacao_pagamento_passageiro/);
    expect(sql).toMatch(/list_pagamentos_pendentes_motorista_acordo/);
    expect(sql).toMatch(/valor_comprovativo integer/);
    expect(sql).toMatch(/valor_comprovativo := CASE/);
    expect(sql).toMatch(/list_pagamentos_resolucao_admin/);
  });

  it('admin_validate_payment não promove activo com acordo cancelado', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.admin_validate_payment/);
    expect(sql).toMatch(/requer_resolucao_admin = true/);
  });

  it('reservado expira para expirado + pagamento anulado', () => {
    expect(sql).toMatch(/_expirar_lugar_reservado_sem_divida/);
    expect(sql).toMatch(/estado = 'anulado'/);
  });

  it('terminate_agreement idempotência «Já confirmado» + rescisao_confirmada_*', () => {
    expect(sql).toMatch(/rescisao_confirmada_por/);
    expect(sql).toMatch(/rescisao_confirmada_em/);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.terminate_agreement/);
    expect(sql).toMatch(/_p0_finalize_lugares_rescisao_imediata/);
  });

  it('leave_passenger proporcional vs reservado sem dívida', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.leave_passenger/);
    expect(sql).toMatch(/ajustar_obrigacao_pagamento_mes/);
  });

  it('prazo_pagamento_em na criação do pagamento', () => {
    expect(sql).toMatch(/prazo_pagamento_em/);
    expect(sql).toMatch(/reservado_expira_em/);
  });

});

describe('P0 acordo pagamento — PaymentService RPC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getObrigacaoPagamentoPassageiro chama RPC com acordo_passageiro_id', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { pagamento: { id: 'p1' }, obrigacao: { valor: 1000 } },
      error: null,
    });
    const out = await getObrigacaoPagamentoPassageiro('ap-1');
    expect(supabase.rpc).toHaveBeenCalledWith('get_obrigacao_pagamento_passageiro', {
      p_acordo_passageiro_id: 'ap-1',
    });
    expect(out.obrigacao.valor).toBe(1000);
  });

  it('listPagamentosPendentesMotoristaAcordo — rede duplicada devolve mesma lista', async () => {
    const rows = [{ pagamento_id: 'pg-1', valor: 5000 }];
    vi.mocked(supabase.rpc).mockResolvedValue({ data: rows, error: null });
    const a = await listPagamentosPendentesMotoristaAcordo('ac-1');
    const b = await listPagamentosPendentesMotoristaAcordo('ac-1');
    expect(a).toEqual(rows);
    expect(b).toEqual(rows);
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });

  it('listPagamentosResolucaoAdmin propaga erro de rede', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'offline' },
    });
    await expect(listPagamentosResolucaoAdmin()).rejects.toEqual({ message: 'offline' });
  });
});
