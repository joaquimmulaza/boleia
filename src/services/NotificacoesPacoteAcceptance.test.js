/**
 * Pacote notificações — rescisao_solicitada_em, deep-link openAcordoId, leave_passenger copy.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveNotificationRoute } from '../utils/notificationRouter.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');
const MIGRATION_FILE = '20261009210000_notificacoes_pacote.sql';
const MIGRATION_LAST_PAX = '20261009220000_last_passenger_leave_driver_notif.sql';
const MIG_P1 = '20261009200000_p1_encerramento_gaps.sql';

/** @param {string} filename */
function readMigration(filename) {
  return readFileSync(join(MIGRATIONS, filename), 'utf8');
}

/** @param {string} file */
function extractLeavePassengerBody(file) {
  const raw = readMigration(file);
  const m = raw.match(/CREATE OR REPLACE FUNCTION public\.leave_passenger[\s\S]*?AS \$function\$([\s\S]*?)\$function\$/);
  return (m?.[1] || '').trim();
}

describe('Pacote notificações — migração SQL', () => {
  it('ficheiro de migração existe após 20261009200000', () => {
    expect(existsSync(join(MIGRATIONS, MIGRATION_FILE))).toBe(true);
    const sql = readMigration(MIGRATION_FILE);
    expect(sql).toMatch(/rescisao_solicitada_em/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS rescisao_solicitada_em/);
    expect(sql).toMatch(/backfill|UPDATE public\.acordos/i);
  });

  it('terminate_agreement grava rescisao_solicitada_em no pedido consensual novo', () => {
    const sql = readMigration(MIGRATION_FILE);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.terminate_agreement/);
    expect(sql).toMatch(/rescisao_solicitada_em\s*=\s*now\(\)/);
  });

  it('notificações consensuais incluem link openAcordoId + focus=rescisao', () => {
    const sql = readMigration(MIGRATION_FILE);
    expect(sql).toMatch(/openAcordoId=/);
    expect(sql).toMatch(/focus=rescisao/);
    expect(sql).toMatch(/INSERT INTO public\.notificacoes \(user_id, mensagem, tipo, metadata, link\)/);
  });

  it('leave_passenger copia corpo 200000 e mensagem com nome quando disponível', () => {
    const p1Base = extractLeavePassengerBody(MIG_P1);
    const pacote = extractLeavePassengerBody(MIGRATION_FILE);
    expect(pacote).toMatch(/IF v_estado_antes = 'reservado'/);
    expect(pacote).toMatch(/_anular_pagamento_sem_divida/);
    expect(pacote).toMatch(/v_uid IS DISTINCT FROM v_acordo\.driver_id/);
    expect(pacote).toMatch(/Ficou um lugar livre\./);
    expect(pacote).toMatch(/Um passageiro saiu do acordo\./);
    expect(pacote).toMatch(/nome_completo/);
    expect(pacote).toMatch(/metadata, link\)/);
    const baseLines = p1Base.split('\n');
    const pacoteLines = pacote.split('\n');
    const diff = [];
    const max = Math.max(baseLines.length, pacoteLines.length);
    for (let i = 0; i < max; i += 1) {
      const a = baseLines[i];
      const b = pacoteLines[i];
      if (a !== b) diff.push({ i, a, b });
    }
    const joinedDiff = diff.map((d) => `${d.a ?? ''}|${d.b ?? ''}`).join('\n');
    expect(joinedDiff).not.toMatch(/_expirar_lugar_reservado/);
    expect(pacote).toContain('v_pax_nome');
    expect(pacote).toContain('v_mensagem_saida');
  });

  it('GRANT/REVOKE leave_passenger e terminate (authenticated, sem anon)', () => {
    const sql = readMigration(MIGRATION_FILE);
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.leave_passenger\(uuid, uuid, uuid\) TO authenticated;/,
    );
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.leave_passenger\(uuid, uuid, uuid\) FROM anon;/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.terminate_agreement\(uuid, text, text, uuid, text\) TO authenticated;/,
    );
  });

  it('script prova PG leave (190000 saiu + motorista sem notif + nome)', () => {
    expect(existsSync(join(ROOT, '../../supabase/tests/notif_pacote_leave_passenger_pg_proof.sql'))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, '../../scripts/run-notificacoes-pacote-pg-proof.sh'))).toBe(true);
  });
});

describe('Pacote notificações — último passageiro (PM)', () => {
  it('migração 20261009220000 existe', () => {
    expect(existsSync(join(MIGRATIONS, MIGRATION_LAST_PAX))).toBe(true);
  });

  it('leave_passenger activa skip do trigger antes de fechar acordo sem lugares vivos', () => {
    const sql = readMigration(MIGRATION_LAST_PAX);
    const body = extractLeavePassengerBody(MIGRATION_LAST_PAX);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.leave_passenger/);
    expect(body).toContain("set_config('boleia.skip_acordo_cancel_notif', 'on', true)");
    const skipOn = body.indexOf("set_config('boleia.skip_acordo_cancel_notif', 'on', true)");
    const maybeFechar = body.indexOf('PERFORM public._maybe_fechar_acordo_sem_lugares_vivos');
    expect(skipOn).toBeGreaterThan(-1);
    expect(maybeFechar).toBeGreaterThan(skipOn);
    expect(sql).toContain('A tua oferta continua publicada.');
    expect(sql).toContain('saiu e o acordo foi encerrado.');
    expect(sql).toContain('O último passageiro saiu e o acordo foi encerrado.');
  });

  it('último passageiro — notificação sem link (sem CTA); parcial mantém link', () => {
    const pacote = extractLeavePassengerBody(MIGRATION_LAST_PAX);
    expect(pacote).toMatch(/v_ultimo_passageiro_saiu/);
    expect(pacote).toMatch(/INSERT INTO public\.notificacoes \(user_id, mensagem, tipo, metadata\)/);
    expect(pacote).toContain('Ficou um lugar livre.');
  });

  it('documenta reutilização de boleia.skip_acordo_cancel_notif (trigger handle_acordo_notifications)', () => {
    const sql = readMigration(MIGRATION_LAST_PAX);
    expect(sql).toMatch(/handle_acordo_notifications|skip_acordo_cancel_notif/i);
    expect(sql).not.toContain('Um acordo foi cancelado.');
  });
});

describe('Pacote notificações — deep-link', () => {
  it('agreement_update consensual abre acordo com focus rescisao', () => {
    expect(
      resolveNotificationRoute({
        metadata: {
          type: 'agreement_update',
          acordo_id: 'ac-1',
          rescisao_modo: 'consensual',
        },
      }),
    ).toBe('/acordos?openAcordoId=ac-1&focus=rescisao');
  });

  it('fallback link legado com openAcordoId abre detalhe', () => {
    expect(
      resolveNotificationRoute({
        link: '/acordos?openAcordoId=ac-2&focus=rescisao',
        mensagem: 'Teste',
      }),
    ).toBe('/acordos?openAcordoId=ac-2&focus=rescisao');
  });
});
