/**
 * PACOTE ENG #16 — push/PWA eventos domínio + deep-links
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  acordosDeepLink,
  notificationRouteMap,
  resolveNotificationRoute,
} from '../utils/notificationRouter.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');
const ENG16_SQL = '20260907060000_pacote_eng16_domain_notifications.sql';

/** @param {string} filename */
function readMigration(filename) {
  return readFileSync(join(MIGRATIONS, filename), 'utf8');
}

/** Chaves OD proibidas em metadata de notificação. */
const OD_FORBIDDEN = [
  'pickup_name',
  'pickup_lat',
  'pickup_lng',
  'dropoff_name',
  'dropoff_lat',
  'dropoff_lng',
  'origem',
  'destino',
  'od_',
];

describe('PACOTE ENG #16 — eventos domínio + deep-links', () => {
  describe('1 — SQL migration', () => {
    it('define notify_domain_event com skip actor', () => {
      const sql = readMigration(ENG16_SQL);
      expect(sql).toMatch(/notify_domain_event/);
      expect(sql).toMatch(/p_actor_id IS NOT NULL AND p_user_id = p_actor_id/);
    });

    it('trigger pagamentos notifica payment_update, em_custodia e payout_liquidated', () => {
      const sql = readMigration(ENG16_SQL);
      expect(sql).toMatch(/trg_pagamentos_acordo_notify/);
      expect(sql).toMatch(/'type', 'payment_update'/);
      expect(sql).toMatch(/'type', 'payout_liquidated'/);
      expect(sql).toMatch(/_maybe_notify_renewal_available/);
      expect(sql).toMatch(/'type', 'renewal_available'/);
    });

    it('metadata jsonb_build_object não inclui campos OD', () => {
      const sql = readMigration(ENG16_SQL);
      for (const key of OD_FORBIDDEN) {
        expect(sql).not.toMatch(new RegExp(`'${key}'`));
      }
    });

    it('notifica passageiro no INSERT; em_custodia avisa passageiro+motorista; sem spam em comprovativo_enviado', () => {
      const sql = readMigration(ENG16_SQL);
      expect(sql).toMatch(/NEW\.passenger_id/);
      expect(sql).toMatch(/NEW\.driver_id/);
      expect(sql).not.toMatch(/lower\(NEW\.estado\) = 'comprovativo_enviado'/);
    });

    it('dedup renovação — não reenvia renewal_available em 7 dias', () => {
      const sql = readMigration(ENG16_SQL);
      expect(sql).toMatch(/interval '7 days'/);
      expect(sql).toMatch(/renewal_available/);
    });
  });

  describe('2 — Deep-links notificationRouter', () => {
    it('acordosDeepLink monta openAcordoId e focus', () => {
      expect(acordosDeepLink({ acordo_id: 'a-1' }, 'pagamento')).toBe(
        '/acordos?openAcordoId=a-1&focus=pagamento',
      );
    });

    it('payment_update abre secção pagamento', () => {
      expect(
        notificationRouteMap.payment_update({
          acordo_id: 'a-1',
          pagamento_id: 'p-1',
          estado: 'em_custodia',
        }),
      ).toBe('/acordos?openAcordoId=a-1&focus=pagamento');
    });

    it('agreement_update com adenda pendente abre focus adenda', () => {
      expect(
        notificationRouteMap.agreement_update({
          acordo_id: 'a-1',
          adenda_estado: 'pendente_passageiro',
        }),
      ).toBe('/acordos?openAcordoId=a-1&focus=adenda');
    });

    it('renewal_available abre secção renovação', () => {
      expect(
        resolveNotificationRoute({
          metadata: { type: 'renewal_available', acordo_id: 'a-2' },
        }),
      ).toBe('/acordos?openAcordoId=a-2&focus=renovacao');
    });

    it('payout_liquidated abre acordo (motorista)', () => {
      expect(
        notificationRouteMap.payout_liquidated({ acordo_id: 'a-3' }),
      ).toBe('/acordos?openAcordoId=a-3&focus=pagamento');
    });

    it('proposal_received mantém hub contraparte (regressão)', () => {
      expect(
        resolveNotificationRoute({
          metadata: { type: 'proposal_received', inbox: 'passageiro' },
        }),
      ).toBe('/passageiro');
    });
  });

  describe('3 — Payloads sem OD', () => {
    it('estratégias só usam ids de domínio (acordo, pagamento, mes)', () => {
      const samples = [
        { type: 'payment_update', acordo_id: 'a', pagamento_id: 'p', mes_referencia: '2026-09-01' },
        { type: 'renewal_available', acordo_id: 'a', mes_referencia: '2026-10-01' },
        { type: 'payout_liquidated', acordo_id: 'a', pagamento_id: 'p' },
      ];

      for (const meta of samples) {
        const route = resolveNotificationRoute({ metadata: meta });
        expect(route).toMatch(/^\/acordos/);
        const serialized = JSON.stringify(meta);
        for (const key of OD_FORBIDDEN) {
          expect(serialized).not.toContain(key);
        }
      }
    });
  });
});
