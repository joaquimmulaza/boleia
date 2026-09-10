/**
 * PACOTE #24 — Motorista: feed procuras + grupos + enviar proposta.
 * Reutiliza MatchingService, DriverDashboard, PropostaService, propostaInbox.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateMatch } from '../utils/matchingFilters.js';
import { findCompatibleProcuras } from './MatchingService.js';
import { createProposta } from './PropostaService.js';
import {
  filterPropostasParaInbox,
  filterPropostasEnviadas,
} from '../utils/propostaInbox.js';
import { supabase } from '../lib/supabase';

const ROOT = dirname(fileURLToPath(import.meta.url));
const REPO = join(ROOT, '../..');

/** @param {string} relPath */
function readSrc(relPath) {
  return readFileSync(join(REPO, relPath), 'utf8');
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe('PACOTE #24 — aceitação motorista feed + enviar proposta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ENG-24-1 — feed match; flexível sem OD na oferta', () => {
    it('findCompatibleProcuras: oferta flexível sem OD casa procuras por tempo/dias/capacidade', async () => {
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'pr-1',
                preferred_time: '07:10:00',
                origin_lat: -8.8473,
                origin_lng: 13.2344,
                destination_lat: -8.855,
                destination_lng: 13.255,
                n_candidato: 1,
                dias_semana: [1, 2, 3, 4, 5],
                estado: 'activa',
              },
            ],
            error: null,
          }),
        }),
      });

      const result = await findCompatibleProcuras({
        flexibilidade_rota: true,
        departure_time: '07:00',
        vagas_disponiveis: 3,
        dias_semana: [1, 2, 3, 4, 5],
        origin_lat: null,
        origin_lng: null,
        destination_lat: null,
        destination_lng: null,
      });

      expect(result.direct).toHaveLength(1);
      expect(result.direct[0].id).toBe('pr-1');
    });

    it('oferta fixa sem OD completa devolve buckets vazios (sem OD inventada)', async () => {
      const result = await findCompatibleProcuras({
        flexibilidade_rota: false,
        departure_time: '07:00',
        vagas_disponiveis: 3,
        origin_lat: null,
        origin_lng: null,
        destination_lat: null,
        destination_lng: null,
      });

      expect(result).toEqual({ direct: [], waitlist: [], incompatible: [] });
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('evaluateMatch confirma flexível direct mesmo com procura longe', () => {
      expect(
        evaluateMatch({
          oferta: {
            departure_time: '07:00',
            flexibilidade_rota: true,
            vagas_disponiveis: 3,
            dias_semana: [1, 2, 3, 4, 5],
            origin_lat: null,
            origin_lng: null,
            destination_lat: null,
            destination_lng: null,
          },
          procura: {
            preferred_time: '07:10',
            origin_lat: -9.5,
            origin_lng: 13.0,
            destination_lat: -9.6,
            destination_lng: 13.1,
            dias_semana: [1, 2, 3, 4, 5],
          },
          n_candidato: 2,
        }),
      ).toBe('direct');
    });
  });

  describe('ENG-24-2 — motorista envia; contraparte aceita (sentido B)', () => {
    it('createProposta (motorista) grava created_by e estado aberta', async () => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'driver-1' } },
      });
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'prop-b',
          oferta_id: 'of-1',
          procura_id: 'pr-1',
          created_by: 'driver-1',
          estado: 'aberta',
          n_passageiros_propostos: 1,
          modo_preco: 'POR_PASSAGEIRO',
          valor_mensal_ask_kz: 45000,
        },
        error: null,
      });
      supabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: mockSingle }),
        }),
      });

      const result = await createProposta({
        oferta_id: 'of-1',
        procura_id: 'pr-1',
        grupo_id: null,
        modo_preco: 'POR_PASSAGEIRO',
        valor_mensal_ask_kz: 45000,
        n_passageiros_propostos: 1,
      });

      expect(result.created_by).toBe('driver-1');
      expect(result.estado).toBe('aberta');
    });

    it('proposta enviada pelo motorista não entra no inbox do motorista', () => {
      const proposta = {
        id: 'prop-b',
        created_by: 'driver-1',
        estado: 'aberta',
      };
      expect(filterPropostasParaInbox([proposta], 'driver-1')).toHaveLength(0);
      expect(filterPropostasEnviadas([proposta], 'driver-1')).toHaveLength(1);
    });

    it('proposta recebida (passageiro→motorista) entra no inbox do motorista', () => {
      const proposta = {
        id: 'prop-a',
        created_by: 'pax-1',
        estado: 'aberta',
      };
      expect(filterPropostasParaInbox([proposta], 'driver-1')).toHaveLength(1);
      expect(filterPropostasEnviadas([proposta], 'driver-1')).toHaveLength(0);
    });

    it('DriverDashboard usa CTA «Enviar proposta» (não «Propor acordo»)', () => {
      const src = readSrc('src/pages/DriverDashboard.jsx');
      expect(src).toMatch(/Enviar proposta/);
      expect(src).not.toMatch(/Propor acordo/);
    });
  });

  describe('ENG-24-3 — grupo incompleto negociável + snapshot N_proposto', () => {
    it('motorista propõe com n_candidato actual (grupo incompleto ok)', async () => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'driver-1' } },
      });
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'prop-grupo',
          grupo_id: 'g-incompleto',
          n_passageiros_propostos: 2,
          modo_preco: 'TOTAL_ACORDO',
          valor_mensal_ask_kz: 80000,
          created_by: 'driver-1',
          estado: 'aberta',
        },
        error: null,
      });
      supabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: mockSingle }),
        }),
      });

      const result = await createProposta({
        oferta_id: 'of-1',
        procura_id: 'pr-grupo',
        grupo_id: 'g-incompleto',
        modo_preco: 'TOTAL_ACORDO',
        valor_mensal_ask_kz: 80000,
        n_passageiros_propostos: 2,
      });

      expect(result.grupo_id).toBe('g-incompleto');
      expect(result.n_passageiros_propostos).toBe(2);
    });

    it('handleProporB usa n_candidato da procura como snapshot', () => {
      const src = readSrc('src/pages/DriverDashboard.jsx');
      expect(src).toMatch(/nProposto = procura\.n_candidato/);
      expect(src).toMatch(/n_passageiros_propostos: nProposto/);
    });
  });

  describe('ENG-24-4 — CTAs só auth', () => {
    it('createProposta falha sem utilizador autenticado', async () => {
      supabase.auth.getUser.mockResolvedValue({ data: { user: null } });

      await expect(
        createProposta({
          oferta_id: 'of-1',
          procura_id: 'pr-1',
          modo_preco: 'POR_PASSAGEIRO',
          valor_mensal_ask_kz: 40000,
          n_passageiros_propostos: 1,
        }),
      ).rejects.toThrow(/Não autenticado/i);
    });

    it('/motorista protegido por ProtectedRoute Motorista', () => {
      const src = readSrc('src/App.jsx');
      expect(src).toMatch(/ProtectedRoute allowedRole="Motorista"/);
      expect(src).toMatch(/path="\/motorista"/);
    });
  });

  describe('ENG-24-5 — WhatsApp auxiliar; path crítico sem wa.me', () => {
    it('DriverDashboard não referencia wa.me nem WhatsApp', () => {
      const src = readSrc('src/pages/DriverDashboard.jsx');
      expect(src).not.toMatch(/wa\.me|whatsapp/i);
    });
  });
});
