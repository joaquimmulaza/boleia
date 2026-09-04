import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  getProfile,
  updateProfile,
  findPassageiroByTelefone,
} from './ProfileService';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('ProfileService', () => {
  let mockEq, mockSelect, mockSingle, mockUpdate, mockInsert;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSingle = vi.fn();
    mockSelect = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockSingle }), single: mockSingle });
    mockEq = vi.fn().mockReturnValue({ single: mockSingle, select: mockSelect });
    mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

    supabase.from.mockReturnValue({
      select: mockSelect,
      update: mockUpdate,
      insert: mockInsert,
    });
  });

  it('getProfile deve chamar o supabase e retornar dados', async () => {
    mockSingle.mockResolvedValue({ data: { nome_completo: 'Teste' }, error: null });
    const profile = await getProfile('user-1');
    expect(supabase.from).toHaveBeenCalledWith('perfis');
    expect(profile.nome_completo).toBe('Teste');
  });

  it('updateProfile deve atualizar dados', async () => {
    mockSingle.mockResolvedValue({ data: { nome_completo: 'Novo Nome' }, error: null });
    const result = await updateProfile('user-1', { nome_completo: 'Novo Nome' });
    expect(supabase.from).toHaveBeenCalledWith('perfis');
    expect(mockUpdate).toHaveBeenCalledWith({ nome_completo: 'Novo Nome' });
    expect(result.nome_completo).toBe('Novo Nome');
  });

  it('findPassageiroByTelefone encontra perfil pelo telefone normalizado', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'pax-2', nome_completo: 'Bruno', telefone: '+244923456789' },
      error: null,
    });
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }),
      }),
    });

    const perfil = await findPassageiroByTelefone('923456789');
    expect(supabase.from).toHaveBeenCalledWith('perfis');
    expect(perfil.id).toBe('pax-2');
  });

  it('findPassageiroByTelefone lança erro se telefone inválido', async () => {
    await expect(findPassageiroByTelefone('123')).rejects.toThrow(/telefone/i);
  });

  it('findPassageiroByTelefone lança erro se perfil não existir', async () => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    await expect(findPassageiroByTelefone('+244923456789')).rejects.toThrow(
      /não encontrámos/i,
    );
  });
});
