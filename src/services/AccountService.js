import { supabase } from '../lib/supabase';

/**
 * Apaga a conta da sessão actual e os dados que lhe pertencem.
 * A RPC não recebe id: só `auth.uid()` no servidor.
 * @returns {Promise<void>}
 */
export async function deleteOwnAccount() {
  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw error;
}
