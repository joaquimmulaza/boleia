/**
 * PACOTE #19 — gaps visão no path crítico (browse → proposta → acordo → pagamento).
 * Audit-first: valida contratos públicos + invariantes UI/serviço sem inventar Pack B.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { labelRotaOferta } from '../utils/ofertaLabels.js';
import { labelOfertaRota, listOfertasDisponiveis } from './OfertaService.js';
import { buildPropostaReview } from '../utils/propostaReview.js';
import { syncNCandidato } from './GrupoService.js';
import {
  firstDayNextMonthLuanda,
  isAdendaBeforeEffectiveFrom,
} from '../utils/adendaEffectiveFrom.js';
import {
  filterPropostasParaInbox,
  filterPropostasEnviadas,
} from '../utils/propostaInbox.js';
import { supabase } from '../lib/supabase';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, '..');
const MIGRATIONS = join(ROOT, '../../supabase/migrations');

/** @param {string} rel */
function readSrc(rel) {
  return readFileSync(join(SRC, rel.replace(/^\.\.\//, '')), 'utf8');
}

/** @param {string} filename */
function readMigration(filename) {
  return readFileSync(join(MIGRATIONS, filename), 'utf8');
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'jwt-test' } },
      }),
    },
  },
}));

describe('PACOTE #19 — gaps visão path crítico', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AC1 — Oferta flexível sem OD inventada', () => {
    it('labelRotaOferta devolve copy humana flexível (nunca Origem/Destino)', () => {
      expect(labelRotaOferta({ flexibilidade_rota: true })).toEqual({
        origem: 'Oferta flexível',
        destino: 'Sem origem/destino fixos',
      });
      expect(labelOfertaRota({ flexibilidade_rota: true })).toBe('Oferta flexível');
    });

    it('OfertaMatchCard usa labelRotaOferta (não origin_name directo)', () => {
      const src = readSrc('components/OfertaMatchCard.jsx');
      expect(src).toMatch(/labelRotaOferta/);
      expect(src).not.toMatch(/oferta\.origin_name/);
    });

    it('MyAgreements detalhe flexível não usa rótulos Partida/Chegada', () => {
      const src = readSrc('pages/MyAgreements.jsx');
      expect(src).toMatch(/isOfertaFlexivel\(oferta\)/);
      expect(src).toMatch(/acordo-rota-flexivel/);
      expect(src).toMatch(/sem origem\/destino fixos/i);
    });

    it('AcordoPagamentoPanel não renderiza OD (só valor acordado)', () => {
      const src = readSrc('components/AcordoPagamentoPanel.jsx');
      expect(src).not.toMatch(/origin_name|destination_name|Origem|Destino/);
      expect(src).toMatch(/pagamento\.valor_kz/);
    });

    it('resolveOdFields anula OD quando flexível (API)', () => {
      const src = readSrc('services/OfertaService.js');
      expect(src).toMatch(/if \(allowed\.flexibilidade_rota\)/);
      expect(src).toMatch(/origin_name = null/);
    });
  });

  describe('AC2 — 1:N snapshots imutáveis', () => {
    it('buildPropostaReview congela N_proposto mesmo com N_actual diferente', () => {
      const review = buildPropostaReview(
        {
          grupo_id: 'g-1',
          modo_preco: 'POR_PASSAGEIRO',
          valor_mensal_ask_kz: 35000,
          n_passageiros_propostos: 2,
        },
        [
          { passenger_id: 'p1', perfis: { nome_completo: 'Ana' } },
          { passenger_id: 'p2', perfis: { nome_completo: 'Bruno' } },
          { passenger_id: 'p3', perfis: { nome_completo: 'Carla' } },
        ],
      );
      expect(review.titulo).toBe('Grupo · 2 pessoas');
      expect(review.requiresMemberSelection).toBe(true);
      expect(review.membros).toHaveLength(3);
    });

    it('syncNCandidato só actualiza procuras.n_candidato (não propostas)', async () => {
      const updates = [];
      supabase.from.mockImplementation((table) => {
        if (table === 'grupos') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'g-1', procura_id: 'pr-1' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'membros_grupo') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
              }),
            }),
          };
        }
        if (table === 'procuras') {
          return {
            update: vi.fn().mockImplementation((payload) => {
              updates.push(payload);
              return {
                eq: vi.fn().mockResolvedValue({ error: null }),
              };
            }),
          };
        }
        return {};
      });

      const n = await syncNCandidato('g-1');
      expect(n).toBe(2);
      expect(updates).toHaveLength(1);
      expect(updates[0]).toMatchObject({ n_candidato: 2 });
      expect(supabase.from).not.toHaveBeenCalledWith('propostas');
    });
  });

  describe('AC3 — Adendas effective_from mês seguinte (ENG#7 / G13/G14)', () => {
    it('firstDayNextMonthLuanda → dia 1 do mês seguinte', () => {
      expect(firstDayNextMonthLuanda(new Date('2026-09-15T12:00:00Z'))).toBe('2026-10-01');
    });

    it('isAdendaBeforeEffectiveFrom protege mês corrente', () => {
      expect(isAdendaBeforeEffectiveFrom('2026-10-01', new Date('2026-09-30T12:00:00Z'))).toBe(true);
      expect(isAdendaBeforeEffectiveFrom('2026-10-01', new Date('2026-10-01T12:00:00Z'))).toBe(false);
    });

    it('renegotiate_agreement_pricing SQL agenda effective_from', () => {
      const sql = readMigration('20260906224517_eng7_renegotiate_cancelada_substituta.sql');
      expect(sql).toMatch(/effective_from/);
      expect(sql).toMatch(/date_trunc\('month'/);
    });

    it('apply_due_agreement_adendas só aplica após effective_from', () => {
      const sql = readMigration('20260906224452_eng7_adenda_rpc_functions.sql');
      expect(sql).toMatch(/effective_from <= v_today/);
    });
  });

  describe('AC4 — WhatsApp auxiliar (não substitui fluxo in-app)', () => {
    it('WhatsApp só no fallback colapsável de GrupoProcuraPanel', () => {
      const src = readSrc('components/GrupoProcuraPanel.jsx');
      expect(src).toMatch(/Fallback: Convidar por telefone/);
      expect(src).toMatch(/wa\.me/);
      expect(src).toMatch(/telefoneFallbackOpen/);
      expect(src).not.toMatch(/Propor acordo[\s\S]*wa\.me/);
    });

    it('path crítico (OfertaMatchCard / PropostaReviewCard / AcordoPagamento) sem wa.me', () => {
      for (const rel of [
        'components/OfertaMatchCard.jsx',
        'components/PropostaReviewCard.jsx',
        'components/AcordoPagamentoPanel.jsx',
        'pages/PassengerDashboard.jsx',
        'pages/MyAgreements.jsx',
      ]) {
        expect(readSrc(rel)).not.toMatch(/wa\.me|WhatsApp/i);
      }
    });
  });

  describe('AC5 — Valores do acordo/snapshot (nunca defaults plataforma)', () => {
    it('AcordoPagamentoPanel usa pagamento.valor_kz', () => {
      const src = readSrc('components/AcordoPagamentoPanel.jsx');
      expect(src).toMatch(/formatKwanza\(pagamento\.valor_kz\)/);
      expect(src).not.toMatch(/35000|43000|valor_default/);
    });

    it('accept_proposal SQL congela valor da proposta (não oferta)', () => {
      const sql = readMigration('20260907190530_seat_before_custody_accept_proposal.sql');
      expect(sql).toMatch(/v_prop\.valor_mensal_ask_kz/);
      expect(sql).not.toMatch(/v_oferta\.valor_mensal_ask_kz/);
    });
  });

  describe('AC6 — CTAs só com auth', () => {
    it('listOfertasDisponiveis exige utilizador autenticado', async () => {
      supabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      await expect(listOfertasDisponiveis()).rejects.toThrow(/autenticado/i);
    });

    it('inbox propostas vazia sem userId', () => {
      expect(filterPropostasParaInbox([{ id: 'p1', estado: 'aberta', created_by: 'x' }], '')).toEqual([]);
      expect(filterPropostasEnviadas([{ id: 'p1', estado: 'aberta', created_by: 'x' }], '')).toEqual([]);
    });

    it('feed browse não passa onPropor ao OfertaMatchCard', () => {
      const src = readSrc('pages/PassengerDashboard.jsx');
      const browseBlock = src.match(/browseOfertas\.map\([\s\S]*?\)\)\}/);
      expect(browseBlock).not.toBeNull();
      expect(browseBlock[0]).toMatch(/variant="browse"/);
      expect(browseBlock[0]).not.toMatch(/onPropor/);
    });
  });
});
