/** Chave sessionStorage para destino pós-OAuth. */
export const AUTH_RETURN_STORAGE_KEY = 'bc_auth_return';

/**
 * @param {string} path
 * @returns {boolean}
 */
function hasControlChars(path) {
  for (let i = 0; i < path.length; i += 1) {
    const code = path.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/**
 * Rejeita caminhos que browsers podem normalizar para URL externa ou protocol-relative.
 * @param {string} path
 * @returns {boolean}
 */
function isUnsafeAbsolutePath(path) {
  if (!path.startsWith('/')) return true;
  if (path.startsWith('//')) return true;
  if (path.includes('://')) return true;
  if (path.includes('\\')) return true;
  if (hasControlChars(path)) return true;
  if (/\s/.test(path.slice(1))) return true;
  return false;
}

/**
 * Valida caminho de retorno pós-login (só rotas internas; evita open redirect).
 * @param {string | null | undefined} raw
 * @returns {string | null}
 */
export function resolveSafeReturnPath(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || isUnsafeAbsolutePath(trimmed)) return null;

  let decoded;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    return null;
  }

  const decodedTrimmed = decoded.trim();
  if (!decodedTrimmed || isUnsafeAbsolutePath(decodedTrimmed)) return null;

  return decodedTrimmed;
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
