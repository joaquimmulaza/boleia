import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getProfile, updateProfile, getVehicle, updateVehicle } from './ProfileService';
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
});
