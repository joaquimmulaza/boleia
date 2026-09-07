import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAbsences, logAbsence } from './AbsenceService.js';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
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
    it('regista falta via RPC log_falta', async () => {
      const faltaPayload = {
        id_acordo: 'acordo-1',
        data_falta: '2024-10-15',
        tipo: 'Motorista',
        observacao: 'Consulta médica',
      };
      supabase.rpc.mockResolvedValue({
        data: { id: 'f1', ...faltaPayload, viagem: 'ambas' },
        error: null,
      });

      const result = await logAbsence(faltaPayload);

      expect(supabase.rpc).toHaveBeenCalledWith('log_falta', {
        p_id_acordo: 'acordo-1',
        p_data_falta: '2024-10-15',
        p_tipo: 'Motorista',
        p_observacao: 'Consulta médica',
        p_passenger_id: null,
        p_viagem: 'ambas',
      });
      expect(result.tipo).toBe('Motorista');
    });

    it('lança erro quando id_acordo está em falta', async () => {
      await expect(logAbsence({ data_falta: '2024-10-15', tipo: 'Passageiro' }))
        .rejects.toThrow('ID do acordo é obrigatório.');
    });

    it('propaga erro do Supabase no RPC', async () => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Registo de faltas disponível após pagamento validado em custódia.' },
      });

      await expect(logAbsence({
        id_acordo: 'acordo-1',
        data_falta: '2024-10-15',
        tipo: 'Passageiro',
      })).rejects.toEqual({
        message: 'Registo de faltas disponível após pagamento validado em custódia.',
      });
    });
  });
});
