/**
 * Validação de URLs de notificação — só caminhos internos da SPA (anti open-redirect).
 * Sincronizar com supabase/functions/_shared/safeNotificationLink.ts (send-push).
 */

/** Caminho relativo interno: `/rota` sem `//` protocol-relative nem `\`. */
export const INTERNAL_NOTIFICATION_PATH_RE = /^\/(?![/\\])/;

/**
 * @param {unknown} link
 * @returns {boolean}
 */
export function isSafeInternalNotificationPath(link) {
  if (typeof link !== 'string') {
    return false;
  }
  const trimmed = link.trim();
  if (!trimmed) {
    return false;
  }
  return INTERNAL_NOTIFICATION_PATH_RE.test(trimmed);
}

/**
 * @param {unknown} link
 * @param {string} [fallback='/acordos']
 * @returns {string}
 */
export function sanitizeNotificationLink(link, fallback = '/acordos') {
  if (isSafeInternalNotificationPath(link)) {
    return /** @type {string} */ (link).trim();
  }
  return fallback;
}

/**
 * URL no payload push (data.url) — mesmo contrato que o router in-app.
 *
 * @param {unknown} link
 * @param {string} [fallback='/acordos']
 * @returns {string}
 */
export function resolvePushNotificationUrl(link, fallback = '/acordos') {
  return sanitizeNotificationLink(link, fallback);
}
