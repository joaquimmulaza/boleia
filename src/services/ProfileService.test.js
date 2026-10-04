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
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
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
    mockSingle.mockResolvedValue({
      data: { id: 'user-1', nome_completo: 'Teste' },
      error: null,
    });
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    supabase.rpc.mockResolvedValue({
      data: { telefone: '+244923000111', iban: 'AO06TEST' },
      error: null,
    });

    const profile = await getProfile('user-1');

    expect(supabase.from).toHaveBeenCalledWith('perfis');
    expect(supabase.rpc).toHaveBeenCalledWith('get_own_perfil_contacto');
    expect(profile.nome_completo).toBe('Teste');
    expect(profile.telefone).toBe('+244923000111');
    expect(profile.iban).toBe('AO06TEST');
  });

  it('getProfile de outra pessoa não junta o contacto da sessão', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'user-2', nome_completo: 'Outra' },
      error: null,
    });
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });

    const profile = await getProfile('user-2');

    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(profile.telefone).toBeUndefined();
    expect(profile.iban).toBeUndefined();
  });

  it('updateProfile deve atualizar dados', async () => {
    mockSingle.mockResolvedValue({ data: { nome_completo: 'Novo Nome' }, error: null });
    const result = await updateProfile('user-1', { nome_completo: 'Novo Nome' });
    expect(supabase.from).toHaveBeenCalledWith('perfis');
    expect(mockUpdate).toHaveBeenCalledWith({ nome_completo: 'Novo Nome' });
    expect(result.nome_completo).toBe('Novo Nome');
  });

  it('findPassageiroByTelefone encontra perfil pelo telefone normalizado', async () => {
    supabase.rpc.mockResolvedValue({
      data: { id: 'pax-2', nome_completo: 'Bruno' },
      error: null,
    });

    const perfil = await findPassageiroByTelefone('923456789');

    expect(supabase.rpc).toHaveBeenCalledWith('lookup_perfil_por_telefone', {
      p_telefone: '+244923456789',
    });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(perfil).toEqual({ id: 'pax-2', nome_completo: 'Bruno' });
    expect(perfil.telefone).toBeUndefined();
  });

  it('findPassageiroByTelefone lança erro se telefone inválido', async () => {
    await expect(findPassageiroByTelefone('123')).rejects.toThrow(/telefone/i);
  });

  it('findPassageiroByTelefone lança erro se perfil não existir', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });

    await expect(findPassageiroByTelefone('+244923456789')).rejects.toThrow(
      /não encontrámos/i,
    );
  });
});
