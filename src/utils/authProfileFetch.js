/**
 * Erro PostgREST/GoTrue típico de pedido sem JWT válido (role `anon` → 42501 em perfis).
 * @param {{ code?: string, message?: string, status?: number, statusCode?: number } | null | undefined} error
 * @returns {boolean}
 */
export function isAnonOrAuthPrivilegeError(error) {
  if (!error) return false;
  const status = error.status ?? error.statusCode;
  if (status === 401 || status === 403) return true;
  const code = String(error.code || '');
  if (code === '42501' || code === 'PGRST301') return true;
  const msg = String(error.message || '').toLowerCase();
  return msg.includes('42501') || msg.includes('permission denied for table perfis');
}

/**
 * @param {import('@supabase/supabase-js').Session | null | undefined} session
 * @returns {boolean}
 */
export function isLiveAuthSession(session) {
  return Boolean(session?.access_token && session?.user?.id);
}
