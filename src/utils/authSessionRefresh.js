/**
 * Caminho único de refresh JWT (partilhado por AuthContext.fetchProfile e apply_due_* / listagens).
 * Guardas #255: uma tentativa por `user.id:access_token`, cooldown 60s — nunca duplicar noutro módulo.
 */
import {
  isLiveAuthSession,
  isAccessTokenExpiredOrNearExpiry,
  isAnonOrAuthPrivilegeError,
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
 * Um `refreshSession` por par `user.id:access_token`, respeitando cooldown global (#255).
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
 * Executa operação autenticada com no máximo um `refreshSession` (proactivo ou reactivo).
 * @template T
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {() => Promise<T>} run
 * @returns {Promise<T>}
 */
export async function withLiveSessionAuthCall(client, run) {
  const getSession = client.auth?.getSession?.bind(client.auth);
  if (!getSession) {
    return run();
  }

  let didRefresh = false;

  const { data: { session: initial } } = await getSession();
  if (
    isLiveAuthSession(initial)
    && isAccessTokenExpiredOrNearExpiry(initial)
  ) {
    didRefresh = Boolean(await refreshSessionOnceIfAllowed(client, initial));
  }

  let result = await run();
  const error = result && typeof result === 'object' && 'error' in result
    ? /** @type {{ error?: unknown }} */ (result).error
    : null;

  if (!isAnonOrAuthPrivilegeError(error)) {
    return result;
  }

  if (!didRefresh) {
    const { data: { session: current } } = await getSession();
    if (isLiveAuthSession(current)) {
      didRefresh = Boolean(await refreshSessionOnceIfAllowed(client, current));
    }
  }

  if (didRefresh) {
    return run();
  }

  return result;
}
