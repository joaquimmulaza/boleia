import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createOferta,
  listOfertasByDriver,
  getOferta,
  updateOferta,
} from './OfertaService.js';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

describe('OfertaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createOferta', () => {
    it('cria oferta com vagas do veículo e modo_preco', async () => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'driver-1' } },
      });

      const mockVeiculoSingle = vi.fn().mockResolvedValue({
        data: { id: 'vei-1', vagas_passageiros: 3 },
        error: null,
      });
      const mockOfertaSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'of-1',
          driver_id: 'driver-1',
          vagas_totais: 3,
          vagas_disponiveis: 3,
          modo_preco: 'POR_PASSAGEIRO',
          estado: 'disponivel',
        },
        error: null,
      });

      supabase.from.mockImplementation((table) => {
        if (table === 'veiculos') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ single: mockVeiculoSingle }),
            }),
          };
        }
        if (table === 'ofertas_capacidade') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({ single: mockOfertaSingle }),
            }),
          };
        }
        return {};
      });

      const result = await createOferta({
        modo_preco: 'POR_PASSAGEIRO',
        valor_mensal_ask_kz: 40000,
        origin_name: 'Talatona',
        origin_lat: -8.9,
        origin_lng: 13.2,
        destination_name: 'Maianga',
        destination_lat: -8.8,
        destination_lng: 13.23,
        departure_time: '07:00',
        return_time: '18:00',
      });

      expect(result.vagas_totais).toBe(3);
      expect(result.vagas_disponiveis).toBe(3);
      expect(result.modo_preco).toBe('POR_PASSAGEIRO');
    });

    it('rejeita sem autenticação', async () => {
      supabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      await expect(createOferta({ modo_preco: 'POR_PASSAGEIRO', valor_mensal_ask_kz: 1 }))
        .rejects.toThrow('Não autenticado');
    });

    it('rejeita modo_preco inválido', async () => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'driver-1' } },
      });
      await expect(
        createOferta({ modo_preco: 'XYZ', valor_mensal_ask_kz: 1000 }),
      ).rejects.toThrow('Modo de preço inválido');
    });

    it('rejeita sem veículo', async () => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'driver-1' } },
      });
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
          }),
        }),
      });
      await expect(
        createOferta({
          modo_preco: 'TOTAL_ACORDO',
          valor_mensal_ask_kz: 120000,
          departure_time: '07:00',
        }),
      ).rejects.toThrow('veículo');
    });
  });

  describe('listOfertasByDriver', () => {
    it('lista ofertas do motorista', async () => {
      const mockOrder = vi.fn().mockResolvedValue({
        data: [{ id: 'of-1' }],
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      supabase.from.mockReturnValue({ select: mockSelect });

      const result = await listOfertasByDriver('driver-1');
      expect(supabase.from).toHaveBeenCalledWith('ofertas_capacidade');
      expect(mockEq).toHaveBeenCalledWith('driver_id', 'driver-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('getOferta', () => {
    it('devolve oferta por id', async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: 'of-1' },
        error: null,
      });
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: mockSingle }),
        }),
      });
      const result = await getOferta('of-1');
      expect(result.id).toBe('of-1');
    });
  });

  describe('updateOferta', () => {
    it('actualiza campos permitidos', async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: 'of-1', estado: 'inactiva' },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: mockSingle }),
      });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      supabase.from.mockReturnValue({ update: mockUpdate });

      const result = await updateOferta('of-1', { estado: 'inactiva' });
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ estado: 'inactiva' }),
      );
      expect(result.estado).toBe('inactiva');
    });
  });
});
