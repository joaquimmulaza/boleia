import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteOwnAccount } from './AccountService.js';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe('deleteOwnAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('chama a RPC sem id de utilizador', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });

    await deleteOwnAccount();

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith('delete_own_account');
  });

  it('propaga o erro da RPC', async () => {
    const error = new Error('Não autenticado.');
    supabase.rpc.mockResolvedValue({ data: null, error });

    await expect(deleteOwnAccount()).rejects.toBe(error);
  });
});
