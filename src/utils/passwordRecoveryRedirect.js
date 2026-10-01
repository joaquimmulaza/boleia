/**
 * Indica se o browser deve redireccionar para /auth?mode=update-password
 * (links antigos que aterram na raiz com tokens Supabase no hash).
 * @param {{ pathname?: string, hash?: string }} [location]
 * @returns {boolean}
 */
export const shouldRedirectRecoveryToAuth = (location = {}) => {
  const pathname = location.pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  const hash = location.hash ?? (typeof window !== 'undefined' ? window.location.hash : '');
  if (pathname === '/auth') return false;
  return hash.includes('type=recovery');
};

/**
 * Path completo (query + hash) para o ecrã de nova palavra-passe.
 * @param {{ hash?: string }} [location]
 * @returns {string}
 */
export const buildRecoveryAuthPath = (location = {}) => {
  const hash = location.hash ?? (typeof window !== 'undefined' ? window.location.hash : '');
  return `/auth?mode=update-password${hash}`;
};
