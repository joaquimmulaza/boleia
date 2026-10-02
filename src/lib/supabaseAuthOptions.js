/**
 * Opções do cliente Supabase Auth.
 * PKCE + detecção do código no URL ficam no SDK; segredos OAuth não entram aqui.
 */
export const supabaseAuthOptions = {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
};
