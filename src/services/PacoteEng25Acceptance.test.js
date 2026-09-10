/**
 * PACOTE ENG #25 — ciclo de vida da oferta (motorista)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  updateOferta,
  cancelOferta,
  listOfertasDisponiveis,
} from './OfertaService.js';
import { canEditOferta, canDespublicarOferta } from '../utils/canEditOferta.js';
import { countPropostasAInvalidarPorOferta } from '../utils/ofertaEditImpact.js';
import { supabase } from '../lib/supabase';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');
const ENG25_SQL = '20260910110000_pacote_eng25_oferta_lifecycle.sql';

/** @param {string} filename */
function readMigration(filename) {
  return readFileSync(join(MIGRATIONS, filename), 'utf8');
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

describe('PACOTE ENG #25 — ciclo de vida oferta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'driver-1' } },
    });
  });

  describe('1 — SQL migration', () => {
    it('define update_oferta e cancel_oferta com guard dono + acordo activo', () => {
      const sql = readMigration(ENG25_SQL);
      expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.update_oferta/);
      expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.cancel_oferta/);
      expect(sql).toMatch(/_assert_oferta_editavel/);
      expect(sql).toMatch(/Só o dono pode alterar esta oferta/);
      expect(sql).toMatch(/Já existe um acordo activo para esta oferta/);
    });

    it('propostas abertas: só invalidada ou cancelada — sem mutar snapshot', () => {
      const sql = readMigration(ENG25_SQL);
      expect(sql).toMatch(/UPDATE public\.propostas\s+SET estado = 'invalidada'/);
      expect(sql).toMatch(/UPDATE public\.propostas\s+SET estado = 'cancelada'/);
      expect(sql).not.toMatch(/UPDATE public\.propostas[\s\S]*?valor_mensal_ask_kz\s*=/);
      expect(sql).not.toMatch(/UPDATE public\.propostas[\s\S]*?n_passageiros_propostos\s*=/);
    });

    it('flexível anula OD no UPDATE (CASE WHEN v_flex THEN NULL)', () => {
      const sql = readMigration(ENG25_SQL);
      expect(sql).toMatch(/CASE WHEN v_flex THEN NULL ELSE p_origin_name END/);
    });

    it('cancel_oferta define estado inactiva', () => {
      const sql = readMigration(ENG25_SQL);
      expect(sql).toMatch(/SET estado = 'inactiva'/);
    });
  });

  describe('2 — Utils UI gate', () => {
    it('canEditOferta / canDespublicarOferta', () => {
      expect(canEditOferta({ estado: 'disponivel' })).toBe(true);
      expect(canEditOferta({ estado: 'inactiva' })).toBe(false);
      expect(canDespublicarOferta({ estado: 'parcial' }, { temAcordoActivo: true })).toBe(false);
    });
  });

  describe('3 — Impacto propostas (snapshot intacto)', () => {
    it('preview conta propostas que ficam incompatíveis', () => {
      const n = countPropostasAInvalidarPorOferta({
        propostas: [{
          estado: 'aberta',
          procura_id: 'pr-1',
          n_passageiros_propostos: 1,
        }],
        procurasById: {
          'pr-1': {
            preferred_time: '07:00',
            origin_lat: -8.9,
            origin_lng: 13.2,
            destination_lat: -8.8,
            destination_lng: 13.23,
            dias_semana: [1, 2, 3, 4, 5],
          },
        },
        oferta: {
          departure_time: '09:30',
          flexibilidade_rota: false,
          origin_lat: -8.9,
          origin_lng: 13.2,
          destination_lat: -8.8,
          destination_lng: 13.23,
          vagas_disponiveis: 2,
          dias_semana: [1, 2, 3, 4, 5],
        },
      });
      expect(n).toBe(1);
    });
  });

  describe('4 — OfertaService RPC', () => {
    it('updateOferta chama RPC com campos permitidos e flex anula OD', async () => {
      supabase.rpc.mockResolvedValue({
        data: { id: 'of-1', flexibilidade_rota: true },
        error: null,
      });

      await updateOferta('of-1', {
        departure_time: '08:00',
        return_time: '18:00',
        modo_preco: 'POR_PASSAGEIRO',
        valor_mensal_ask_kz: 45000,
        flexibilidade_rota: true,
        origin_name: 'Talatona',
        origin_lat: -8.9,
        origin_lng: 13.2,
        destination_name: 'Maianga',
        destination_lat: -8.8,
        destination_lng: 13.23,
        dias_semana: [1, 2, 3, 4, 5],
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'update_oferta',
        expect.objectContaining({
          p_oferta_id: 'of-1',
          p_departure_time: '08:00',
          p_flexibilidade_rota: true,
          p_origin_name: null,
          p_origin_lat: null,
          p_destination_name: null,
        }),
      );
    });

    it('cancelOferta chama RPC cancel_oferta (dono-only no servidor)', async () => {
      supabase.rpc.mockResolvedValue({
        data: { id: 'of-1', estado: 'inactiva' },
        error: null,
      });

      const result = await cancelOferta('of-1');
      expect(supabase.rpc).toHaveBeenCalledWith('cancel_oferta', { p_oferta_id: 'of-1' });
      expect(result.estado).toBe('inactiva');
    });

    it('rejeita update sem autenticação', async () => {
      supabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      await expect(
        updateOferta('of-1', {
          departure_time: '08:00',
          modo_preco: 'POR_PASSAGEIRO',
          valor_mensal_ask_kz: 1,
        }),
      ).rejects.toThrow('Não autenticado');
    });
  });

  describe('5 — Confirm snapshot ao editar', () => {
    it('OfertaEditPanel exporta fluxo de confirm antes de persistir (componente testado)', () => {
      const src = readFileSync(
        join(ROOT, '../components/OfertaEditPanel.jsx'),
        'utf8',
      );
      expect(src).toMatch(/oferta-edit-snapshot-confirm/);
      expect(src).toMatch(/countPropostasAInvalidarPorOferta/);
      expect(src).toMatch(/valor negociado das propostas existentes não muda/i);
    });
  });

  describe('6 — Browse reflecte estado', () => {
    it('listOfertasDisponiveis exclui inactiva (só disponivel|parcial)', async () => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'pax-1' } },
      });
      const mockIn = vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          range: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({ in: mockIn }),
      });

      await listOfertasDisponiveis();
      expect(mockIn).toHaveBeenCalledWith('estado', ['disponivel', 'parcial']);
    });
  });
});
