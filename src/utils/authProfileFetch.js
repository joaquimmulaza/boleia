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

/**
 * Chave estável para limitar refresh-retry (user + token actual).
 * @param {import('@supabase/supabase-js').Session} session
 * @returns {string}
 */
export function profileFetchSessionKey(session) {
  return `${session.user.id}:${session.access_token}`;
}

/**
 * @param {import('@supabase/supabase-js').Session | null | undefined} session
 * @param {number} [skewSec] segundos antes de `expires_at` para considerar «perto de expirar»
 * @returns {boolean}
 */
export function isAccessTokenExpiredOrNearExpiry(session, skewSec = 90) {
  if (!session?.access_token) return false;
  const exp = session.expires_at;
  if (typeof exp !== 'number') return true;
  const nowSec = Math.floor(Date.now() / 1000);
  return exp <= nowSec + skewSec;
}
