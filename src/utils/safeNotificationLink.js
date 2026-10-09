/**
 * Validação de URLs de notificação — só caminhos internos da SPA (anti open-redirect).
 * Sincronizar com supabase/functions/_shared/safeNotificationLink.ts (send-push).
 */

/** Base fictícia para resolver URLs relativas sem expor origem real. */
export const INTERNAL_NOTIFICATION_URL_BASE = 'https://app.invalid';

/** Control chars (incl. tab/LF/CR) e backslash — rejeitar antes do parser URL. */
// eslint-disable-next-line no-control-regex -- B2: bloquear chars de controlo em links de notificação
export const UNSAFE_NOTIFICATION_LINK_CHARS_RE = /[\u0000-\u001F\u007F\\]/;

/**
 * Validação pós-normalização (URL parser colapsa `..` → pathname `//host` open-redirect).
 *
 * @param {string} out pathname + search + hash
 * @returns {boolean}
 */
export function isSafeNormalizedInternalPath(out) {
  if (!out.startsWith('/') || out.startsWith('//') || out.includes('\\')) {
    return false;
  }
  const q = out.indexOf('?');
  const hashIdx = out.indexOf('#');
  let pathEnd = out.length;
  if (q >= 0) pathEnd = Math.min(pathEnd, q);
  if (hashIdx >= 0) pathEnd = Math.min(pathEnd, hashIdx);
  const pathOnly = out.slice(0, pathEnd);
  try {
    const decoded = decodeURIComponent(pathOnly);
    if (decoded.startsWith('//') || decoded.includes('\\')) {
      return false;
    }
  } catch {
    return false;
  }
  try {
    const url = new URL(out, INTERNAL_NOTIFICATION_URL_BASE);
    return url.origin === INTERNAL_NOTIFICATION_URL_BASE;
  } catch {
    return false;
  }
}

/**
 * @param {unknown} link
 * @returns {boolean}
 */
export function hasUnsafeNotificationLinkChars(link) {
  return typeof link === 'string' && UNSAFE_NOTIFICATION_LINK_CHARS_RE.test(link);
}

/**
 * @param {unknown} link
 * @returns {boolean}
 */
export function isSafeInternalNotificationPath(link) {
  if (typeof link !== 'string') {
    return false;
  }
  const trimmed = link.trim();
  if (!trimmed || hasUnsafeNotificationLinkChars(trimmed)) {
    return false;
  }
  try {
    const url = new URL(trimmed, INTERNAL_NOTIFICATION_URL_BASE);
    if (url.origin !== INTERNAL_NOTIFICATION_URL_BASE) {
      return false;
    }
    const out = `${url.pathname}${url.search}${url.hash}`;
    return isSafeNormalizedInternalPath(out);
  } catch {
    return false;
  }
}

/**
 * @param {unknown} link
 * @param {string} [fallback='/']
 * @returns {string}
 */
export function sanitizeNotificationLink(link, fallback = '/') {
  if (!isSafeInternalNotificationPath(link)) {
    return fallback;
  }
  const url = new URL(/** @type {string} */ (link).trim(), INTERNAL_NOTIFICATION_URL_BASE);
  const out = `${url.pathname}${url.search}${url.hash}`;
  if (!isSafeNormalizedInternalPath(out)) {
    return fallback;
  }
  return out;
}

/**
 * URL no payload push (data.url) — mesmo contrato que o router in-app.
 *
 * @param {unknown} link
 * @param {string} [fallback='/']
 * @returns {string}
 */
export function resolvePushNotificationUrl(link, fallback = '/') {
  return sanitizeNotificationLink(link, fallback);
}
