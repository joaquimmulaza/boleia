import {
  isAnonOrAuthPrivilegeError,
  isLiveAuthSession,
  isAccessTokenExpiredOrNearExpiry,
} from './authProfileFetch.js';
import { refreshSessionOnceIfAllowed } from './authSessionRefresh.js';

/**
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
