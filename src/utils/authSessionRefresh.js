/**
 * Caminho único de refresh JWT (partilhado por AuthContext.fetchProfile e apply_due_* / listagens).
 * Guardas #255: uma tentativa por `user.id:access_token`, cooldown 60s — nunca duplicar noutro módulo.
 */
import {
  isLiveAuthSession,
  isAccessTokenExpiredOrNearExpiry,
  isAnonOrAuthPrivilegeError,
  shouldRefreshSessionForAuthError,
  profileFetchSessionKey,
  hasAuthSessionShape,
} from './authProfileFetch.js';

/** Cooldown mínimo entre `refreshSession` por utilizador (evita loop 401/TOKEN_REFRESHED). */
export const AUTH_REFRESH_COOLDOWN_MS = 60_000;

/** Limite de chaves `user.id:access_token` guardadas (evita crescimento ilimitado). */
export const AUTH_REFRESH_ATTEMPT_KEYS_MAX = 64;

/** @type {Set<string>} */
const profileRefreshAttempted = new Set();

/** @type {Record<string, number>} */
const authRetryAt = {};

/**
 * @param {string} sessionKey
 */
function trackRefreshAttempt(sessionKey) {
  if (profileRefreshAttempted.size >= AUTH_REFRESH_ATTEMPT_KEYS_MAX) {
    profileRefreshAttempted.clear();
  }
  profileRefreshAttempted.add(sessionKey);
}

/**
 * @param {string} userId
 */
function clearRefreshAttemptsForUser(userId) {
  for (const key of profileRefreshAttempted) {
    if (key.startsWith(`${userId}:`)) {
      profileRefreshAttempted.delete(key);
    }
  }
}

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
  if (!hasAuthSessionShape(session)) return null;

  const userId = session.user.id;
  const sessionKey = profileFetchSessionKey(session);
  const lastRetryAt = authRetryAt[userId] ?? 0;
  const cooldownElapsed = Date.now() - lastRetryAt >= AUTH_REFRESH_COOLDOWN_MS;

  if (!cooldownElapsed || profileRefreshAttempted.has(sessionKey)) {
    return null;
  }

  trackRefreshAttempt(sessionKey);
  authRetryAt[userId] = Date.now();

  const { data: refreshed, error: refreshError } = await client.auth.refreshSession();
  if (
    refreshError
    || !isLiveAuthSession(refreshed?.session)
    || refreshed.session.user.id !== userId
  ) {
    return null;
  }
  clearRefreshAttemptsForUser(userId);
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
  const initialSessionKey = hasAuthSessionShape(initial)
    ? profileFetchSessionKey(initial)
    : null;

  if (
    hasAuthSessionShape(initial)
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

  const { data: { session: current } } = await getSession();

  if (
    initialSessionKey
    && hasAuthSessionShape(current)
    && profileFetchSessionKey(current) !== initialSessionKey
    && isLiveAuthSession(current)
  ) {
    return run();
  }

  if (!didRefresh && shouldRefreshSessionForAuthError(error, current ?? initial)) {
    didRefresh = Boolean(await refreshSessionOnceIfAllowed(client, current ?? initial));
  }

  if (didRefresh) {
    return run();
  }

  return result;
}
