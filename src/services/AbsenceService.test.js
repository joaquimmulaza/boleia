import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAbsences, logAbsence } from './AbsenceService.js';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('AbsenceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAbsences', () => {
    it('devolve lista de faltas para um acordo', async () => {
      const mockEq = vi.fn().mockResolvedValue({
        data: [{ id: 'f1', id_acordo: 'acordo-1', tipo: 'Passageiro' }],
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      supabase.from.mockReturnValue({ select: mockSelect });

      const result = await getAbsences('acordo-1');

      expect(supabase.from).toHaveBeenCalledWith('faltas');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('id_acordo', 'acordo-1');
      expect(result).toHaveLength(1);
    });

    it('lança erro quando acordoId não é fornecido', async () => {
      await expect(getAbsences()).rejects.toThrow('ID do acordo é obrigatório.');
      await expect(getAbsences('')).rejects.toThrow('ID do acordo é obrigatório.');
    });

    it('propaga erro do Supabase', async () => {
      const mockEq = vi.fn().mockResolvedValue({ data: null, error: { message: 'RLS' } });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      supabase.from.mockReturnValue({ select: mockSelect });

      await expect(getAbsences('acordo-1')).rejects.toEqual({ message: 'RLS' });
    });
  });

  describe('logAbsence', () => {
    it('insere falta com campos correctos', async () => {
      const faltaPayload = {
        id_acordo: 'acordo-1',
        data_falta: '2024-10-15',
        tipo: 'Motorista',
        observacao: 'Consulta médica',
      };
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: 'f1', ...faltaPayload },
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      supabase.from.mockReturnValue({ insert: mockInsert });

      const result = await logAbsence(faltaPayload);

      expect(supabase.from).toHaveBeenCalledWith('faltas');
      expect(mockInsert).toHaveBeenCalledWith([
        {
          ...faltaPayload,
          passenger_id: null,
          viagem: 'ambas',
        },
      ]);
      expect(result.tipo).toBe('Motorista');
    });

    it('lança erro quando id_acordo está em falta', async () => {
      await expect(logAbsence({ data_falta: '2024-10-15', tipo: 'Passageiro' }))
        .rejects.toThrow('ID do acordo é obrigatório.');
    });

    it('propaga erro do Supabase no insert', async () => {
      const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      supabase.from.mockReturnValue({ insert: mockInsert });

      await expect(logAbsence({
        id_acordo: 'acordo-1',
        data_falta: '2024-10-15',
        tipo: 'Passageiro',
      })).rejects.toEqual({ message: 'Insert failed' });
    });
  });
});
