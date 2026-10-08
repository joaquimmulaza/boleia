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
 * @param {string} path
 * @returns {{ pathname: string, search: string, fragment: string }}
 */
function splitPathQueryFragment(path) {
  const hashIdx = path.indexOf('#');
  const withoutHash = hashIdx === -1 ? path : path.slice(0, hashIdx);
  const fragment = hashIdx === -1 ? '' : path.slice(hashIdx);

  const qIdx = withoutHash.indexOf('?');
  const pathname = qIdx === -1 ? withoutHash : withoutHash.slice(0, qIdx);
  const search = qIdx === -1 ? '' : withoutHash.slice(qIdx);

  return { pathname, search, fragment };
}

/**
 * Verificações completas no valor RAW (codificado).
 * @param {string} path
 * @returns {boolean}
 */
function isUnsafeRawAbsolutePath(path) {
  if (!path.startsWith('/')) return true;
  if (path.startsWith('//')) return true;
  if (path.includes('://')) return true;
  if (path.includes('\\')) return true;
  if (hasControlChars(path)) return true;
  if (/\s/.test(path)) return true;
  return false;
}

/**
 * Pathname descodificado — rejeita protocol-relative e caracteres perigosos.
 * @param {string} pathname
 * @returns {boolean}
 */
function isUnsafeDecodedPathname(pathname) {
  if (!pathname.startsWith('/')) return true;
  if (pathname.startsWith('//')) return true;
  if (pathname.includes('\\')) return true;
  if (hasControlChars(pathname)) return true;
  if (/\s/.test(pathname)) return true;
  return false;
}

/**
 * Query ou fragment descodificados — só rejeitam caracteres de controlo.
 * @param {string} part
 * @returns {boolean}
 */
function isUnsafeDecodedQueryOrFragment(part) {
  if (!part) return false;
  return hasControlChars(part);
}

/**
 * Valida caminho de retorno pós-login (só rotas internas; evita open redirect).
 * Devolve o valor RAW (trimmed), nunca descodificado.
 * @param {string | null | undefined} raw
 * @returns {string | null}
 */
export function resolveSafeReturnPath(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || isUnsafeRawAbsolutePath(trimmed)) return null;

  let decoded;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    return null;
  }

  const decodedTrimmed = decoded.trim();
  if (!decodedTrimmed) return null;

  const { pathname, search, fragment } = splitPathQueryFragment(decodedTrimmed);
  if (isUnsafeDecodedPathname(pathname)) return null;
  if (isUnsafeDecodedQueryOrFragment(search)) return null;
  if (isUnsafeDecodedQueryOrFragment(fragment)) return null;

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
