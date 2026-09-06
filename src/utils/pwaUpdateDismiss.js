const STORAGE_KEY = 'pwa-update-dismissed';

/**
 * Versão do SW à espera persistida quando o utilizador clica «Agora não».
 * @returns {string | null}
 */
export function getDismissedUpdateVersion() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * @param {string} version
 */
export function setDismissedUpdateVersion(version) {
  if (!version) return;
  try {
    localStorage.setItem(STORAGE_KEY, version);
  } catch {
    // incognito / quota
  }
}

export function clearDismissedUpdateVersion() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Identificador mínimo da versão pendente — URL do script do SW instalado à espera.
 * @param {ServiceWorkerRegistration | null | undefined} registration
 * @returns {string | null}
 */
export function getWaitingUpdateVersion(registration) {
  return registration?.waiting?.scriptURL ?? null;
}
