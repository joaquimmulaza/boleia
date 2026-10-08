/** Chave sessionStorage para destino pós-OAuth. */
export const AUTH_RETURN_STORAGE_KEY = 'bc_auth_return';

/**
 * Valida caminho de retorno pós-login (só rotas internas; evita open redirect).
 * @param {string | null | undefined} raw
 * @returns {string | null}
 */
export function resolveSafeReturnPath(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/')) return null;
  if (trimmed.startsWith('//')) return null;
  if (trimmed.includes('://')) return null;
  return trimmed;
}

/**
 * @param {string} authPath — ex. `/auth` ou `/auth?mode=register&role=passenger`
 * @param {string | null | undefined} returnPath
 * @returns {string}
 */
export function buildAuthUrlWithNext(authPath, returnPath) {
  const safe = resolveSafeReturnPath(returnPath);
  const [pathname, search = ''] = authPath.split('?');
  const params = new URLSearchParams(search);
  if (safe) params.set('next', safe);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * Destino pós-login: `next` seguro ou fallback por papel.
 * @param {string | null | undefined} nextRaw
 * @param {string | null | undefined} tipoPerfil
 * @returns {string}
 */
export function resolvePostLoginPath(nextRaw, tipoPerfil) {
  const safe = resolveSafeReturnPath(nextRaw);
  if (safe) return safe;
  return tipoPerfil === 'Motorista' ? '/motorista' : '/passageiro';
}
