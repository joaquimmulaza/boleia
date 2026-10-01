import { supabase } from '../lib/supabase';

/**
 * @param {string} email
 * @param {string} redirectTo
 */
export const requestPasswordReset = async (email, redirectTo) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
};

/**
 * Troca o `token_hash` do email de recuperação por sessão.
 * @param {string} tokenHash
 */
export const verifyRecoveryToken = async (tokenHash) => {
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
  if (error) throw error;
  return data;
};

/**
 * @param {string} password
 */
export const updatePassword = async (password) => {
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  return data;
};
