import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn(),
      verifyOtp: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}));

import { supabase } from '../lib/supabase';
import { requestPasswordReset, verifyRecoveryToken, updatePassword } from './AuthService';

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requestPasswordReset envia email com redirectTo', async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    await requestPasswordReset('a@b.ao', 'https://app.test/auth?mode=update-password');
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.ao', {
      redirectTo: 'https://app.test/auth?mode=update-password',
    });
  });

  it('requestPasswordReset lança erro do Supabase', async () => {
    const error = new Error('rate limit');
    supabase.auth.resetPasswordForEmail.mockResolvedValue({ data: null, error });
    await expect(requestPasswordReset('a@b.ao', 'x')).rejects.toBe(error);
  });

  it('verifyRecoveryToken troca token_hash por sessão (type recovery)', async () => {
    supabase.auth.verifyOtp.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null });
    const data = await verifyRecoveryToken('hash-123');
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'hash-123', type: 'recovery' });
    expect(data.session.user.id).toBe('u1');
  });

  it('verifyRecoveryToken lança erro em token expirado', async () => {
    const error = new Error('Token has expired or is invalid');
    supabase.auth.verifyOtp.mockResolvedValue({ data: null, error });
    await expect(verifyRecoveryToken('velho')).rejects.toBe(error);
  });

  it('updatePassword chama updateUser e lança em erro', async () => {
    supabase.auth.updateUser.mockResolvedValueOnce({ data: { user: {} }, error: null });
    await updatePassword('novaPass12');
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'novaPass12' });

    const error = new Error('New password should be different from the old password.');
    supabase.auth.updateUser.mockResolvedValueOnce({ data: null, error });
    await expect(updatePassword('igual')).rejects.toBe(error);
  });
});
