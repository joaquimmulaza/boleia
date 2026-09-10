/**
 * PACOTE ENG #20 — E2E fluxos Partial 4 / 8 / 10 (audit E2E 2026-09-10).
 * Evidência Vitest: pagamento happy path · renovação M0→M1 · grupo/push.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  submitPaymentProof,
  adminValidatePayment,
  getAcordoContactos,
  getPlatformIban,
} from './PaymentService.js';
import { renewAgreementPeriod } from './AgreementService.js';
import { pedirEntradaGrupo, aprovarEntrada } from './GrupoService.js';
import {
  allowsContactReveal,
  canTransitionPayment,
} from '../utils/paymentStatus.js';
import { podeRenovarPeriodo } from '../utils/periodoRenovacao.js';
import {
  resolveNotificationRoute,
  notificationRouteMap,
} from '../utils/notificationRouter.js';
import { supabase } from '../lib/supabase';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');
const SW_PATH = join(ROOT, '../sw.js');

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'jwt-e2e' } },
      }),
    },
  },
}));

/** @param {string} filename */
function readMigration(filename) {
  return readFileSync(join(MIGRATIONS, filename), 'utf8');
}

describe('PACOTE ENG #20 — E2E fluxos Partial 4 / 8 / 10', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  describe('Fluxo 4 — Pagamento/comprovativo + admin activation (happy path)', () => {
    it('piloto: upload → comprovativo_enviado → admin aprova → em_custodia', async () => {
      /** @type {string} */
      let estado = 'pendente_pagamento';

      supabase.rpc.mockImplementation(async (name, args) => {
        if (name === 'submit_payment_proof') {
          estado = 'comprovativo_enviado';
          return { data: args.p_pagamento_id, error: null };
        }
        if (name === 'admin_validate_payment' && args.p_aprovar) {
          estado = 'em_custodia';
          return { data: args.p_pagamento_id, error: null };
        }
        if (name === 'get_acordo_contactos') {
          return {
            data: {
              bloqueado: estado !== 'em_custodia',
              motorista: estado === 'em_custodia' ? { telefone: '+244900000001' } : null,
              passageiros: [],
            },
            error: null,
          };
        }
        return { data: null, error: null };
      });

      await submitPaymentProof('pag-e2e-4', 'pax/pag-e2e-4/recibo.pdf');
      expect(estado).toBe('comprovativo_enviado');
      expect(canTransitionPayment('pendente_pagamento', 'comprovativo_enviado')).toBe(true);

      let contactos = await getAcordoContactos('acordo-e2e-4');
      expect(contactos.bloqueado).toBe(true);
      expect(allowsContactReveal('comprovativo_enviado')).toBe(false);

      await adminValidatePayment('pag-e2e-4', true);
      expect(estado).toBe('em_custodia');
      expect(canTransitionPayment('comprovativo_enviado', 'em_custodia')).toBe(true);

      contactos = await getAcordoContactos('acordo-e2e-4');
      expect(contactos.bloqueado).toBe(false);
      expect(allowsContactReveal('em_custodia')).toBe(true);
    });

    it('SQL admin_validate_payment promove reservado→activo (seat-before-custody)', () => {
      const sql = readMigration('20260907190000_seat_before_custody_reservado.sql');
      expect(sql).toMatch(/admin_validate_payment/);
      expect(sql).toMatch(/lower\(v_ap\.estado\) = 'reservado'/);
      expect(sql).toMatch(/SET estado = 'activo'/);
    });

    it('regressão B2: getPlatformIban devolve env quando configurado', () => {
      vi.stubEnv('VITE_PLATFORM_IBAN', 'AO06004000000000000000000');
      expect(getPlatformIban()).toBe('AO06004000000000000000000');
      vi.unstubAllEnvs();
    });

    it('regressão B2: getPlatformIban null sem env (panel empty state)', () => {
      vi.stubEnv('VITE_PLATFORM_IBAN', '');
      expect(getPlatformIban()).toBeNull();
      vi.unstubAllEnvs();
    });
  });

  describe('Fluxo 8 — Renovação M0→M1 explícita + pagamento novo período', () => {
    it('renewAgreementPeriod cria pagamentos e marca renovacao_estado', async () => {
      supabase.rpc.mockResolvedValue({
        data: {
          acordo_id: 'acordo-m0',
          mes_referencia: '2026-10-01',
          pagamentos_criados: 2,
          renovacao_estado: 'renovado',
        },
        error: null,
      });
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'acordo-m0',
                estado: 'activo',
                renovacao_estado: 'renovado',
                valor_mensal_por_passageiro_kz: 40000,
              },
              error: null,
            }),
          }),
        }),
      });

      const result = await renewAgreementPeriod('acordo-m0');
      expect(supabase.rpc).toHaveBeenCalledWith(
        'renew_agreement_period',
        expect.objectContaining({
          p_acordo_id: 'acordo-m0',
          p_idempotency_key: expect.any(String),
        }),
      );
      expect(result.pagamentos_criados).toBe(2);
      expect(podeRenovarPeriodo({ estado: 'activo', renovacao_estado: 'renovado' })).toBe(false);
    });

    it('SQL: renovação só via RPC explícita — sem cron/auto-renew', () => {
      const sql = readMigration('20260907152236_pacote_eng14_renovacao_periodo.sql');
      expect(sql).toMatch(/renew_agreement_period/);
      expect(sql).toMatch(/auth\.uid\(\)/);
      expect(sql).not.toMatch(/pg_cron/i);
      expect(sql).not.toMatch(/cron\.schedule/i);
    });

    it('SQL: novo período herda termos vigentes (_resolve_termos_vigentes_acordo)', () => {
      const sql = readMigration('20260907152236_pacote_eng14_renovacao_periodo.sql');
      expect(sql).toMatch(/_resolve_termos_vigentes_acordo/);
      expect(sql).toMatch(/em_vigor/);
      expect(sql).toMatch(/quota_mensal_kz/);
    });

    it('SQL: pagamentos M1 nascem pendente_pagamento (exigem comprovativo)', () => {
      const eng5 = readMigration('20260906224025_pacote_eng5_pagamentos_escrow.sql');
      expect(eng5).toMatch(/DEFAULT 'pendente_pagamento'/);
      const eng14 = readMigration('20260907152236_pacote_eng14_renovacao_periodo.sql');
      expect(eng14).toMatch(/_create_pagamentos_periodo/);
      expect(eng14).not.toMatch(/estado\s*=\s*'em_custodia'/);
    });

    it('novo período não salta escrow: pendente→comprovativo→em_custodia', () => {
      expect(canTransitionPayment('pendente_pagamento', 'em_custodia')).toBe(false);
      expect(canTransitionPayment('pendente_pagamento', 'comprovativo_enviado')).toBe(true);
    });
  });

  describe('Fluxo 10 — Entrada grupo OR push/PWA deep-links', () => {
    it('grupo: solicitar entrada fica pendente (sem auto-aprovação)', async () => {
      /** @type {object | null} */
      let insertPayload = null;
      let membrosCalls = 0;

      supabase.from.mockImplementation((table) => {
        if (table === 'grupos') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'g-e2e', n_maximo: 4, procura_id: 'pr-e2e' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'membros_grupo') {
          membrosCalls += 1;
          if (membrosCalls <= 2) {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            };
          }
          return {
            insert: vi.fn().mockImplementation((rows) => {
              insertPayload = rows?.[0] ?? null;
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 'm-e2e', ...insertPayload },
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        return {};
      });

      const pedido = await pedirEntradaGrupo('g-e2e', { passenger_id: 'pax-join' });
      expect(insertPayload?.estado).toBe('pendente');
      expect(pedido.estado).toBe('pendente');
    });

    it('grupo: owner aprova pedido pendente → activo', async () => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'owner-e2e' } },
        error: null,
      });

      let step = 0;
      supabase.from.mockImplementation((table) => {
        if (table === 'membros_grupo') {
          step += 1;
          if (step === 1) {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: 'm-e2e',
                      grupo_id: 'g-e2e',
                      passenger_id: 'pax-join',
                      estado: 'pendente',
                      ordem_insercao: 2,
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (step === 2 || step === 4) {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ count: step === 2 ? 1 : 2, error: null }),
                }),
              }),
            };
          }
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 'm-e2e', estado: 'activo' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'grupos') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'g-e2e',
                    n_maximo: 4,
                    procura_id: 'pr-e2e',
                    procuras: { owner_id: 'owner-e2e' },
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'procuras') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {};
      });

      const aprovado = await aprovarEntrada('m-e2e');
      expect(aprovado.estado).toBe('activo');
    });

    it('push: domain events resolvem deep-links autenticados (/acordos?focus=…)', () => {
      expect(
        resolveNotificationRoute({
          metadata: {
            type: 'payment_update',
            acordo_id: 'a-push',
            pagamento_id: 'pag-1',
            estado: 'em_custodia',
          },
        }),
      ).toBe('/acordos?openAcordoId=a-push&focus=pagamento');

      expect(
        notificationRouteMap.renewal_available({ acordo_id: 'a-ren' }),
      ).toBe('/acordos?openAcordoId=a-ren&focus=renovacao');

      expect(
        resolveNotificationRoute({
          metadata: { type: 'proposal_received', inbox: 'motorista' },
        }),
      ).toBe('/motorista');
    });

    it('PWA sw.js: notificationclick usa resolveNotificationRoute', () => {
      const sw = readFileSync(SW_PATH, 'utf8');
      expect(sw).toMatch(/notificationclick/);
      expect(sw).toMatch(/resolveNotificationRoute/);
      expect(sw).toMatch(/clients\.matchAll/);
    });
  });
});
