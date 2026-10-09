import {
  isLiveAuthSession,
  isAccessTokenExpiredOrNearExpiry,
  profileFetchSessionKey,
} from './authProfileFetch.js';

/** Cooldown mínimo entre `refreshSession` por utilizador (evita loop 401/TOKEN_REFRESHED). */
export const AUTH_REFRESH_COOLDOWN_MS = 60_000;

/** @type {Set<string>} */
const profileRefreshAttempted = new Set();

/** @type {Record<string, number>} */
const authRetryAt = {};

/** Limpa estado partilhado (SIGNED_OUT / testes). */
export function resetAuthSessionRefreshState() {
  profileRefreshAttempted.clear();
  Object.keys(authRetryAt).forEach((k) => {
    delete authRetryAt[k];
  });
}

/**
 * Um `refreshSession` por par user+token, respeitando cooldown global.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {import('@supabase/supabase-js').Session} session
 * @returns {Promise<import('@supabase/supabase-js').Session | null>}
 */
export async function refreshSessionOnceIfAllowed(client, session) {
  if (!isLiveAuthSession(session)) return null;

  const userId = session.user.id;
  const sessionKey = profileFetchSessionKey(session);
  const lastRetryAt = authRetryAt[userId] ?? 0;
  const cooldownElapsed = Date.now() - lastRetryAt >= AUTH_REFRESH_COOLDOWN_MS;

  if (!cooldownElapsed || profileRefreshAttempted.has(sessionKey)) {
    return null;
  }

  profileRefreshAttempted.add(sessionKey);
  authRetryAt[userId] = Date.now();

  const { data: refreshed, error: refreshError } = await client.auth.refreshSession();
  if (
    refreshError
    || !isLiveAuthSession(refreshed?.session)
    || refreshed.session.user.id !== userId
  ) {
    return null;
  }
  return refreshed.session;
}

/**
 * Garante sessão com JWT utilizável (refresh proactivo se expirado/perto).
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @returns {Promise<import('@supabase/supabase-js').Session | null>}
 */
export async function ensureLiveSession(client) {
  const { data: { session }, error } = await client.auth.getSession();
  if (error || !isLiveAuthSession(session)) {
    return null;
  }

  if (!isAccessTokenExpiredOrNearExpiry(session)) {
    return session;
  }

  const refreshed = await refreshSessionOnceIfAllowed(client, session);
  if (refreshed) {
    return refreshed;
  }

  const { data: { session: after } } = await client.auth.getSession();
  return isLiveAuthSession(after) ? after : null;
}
