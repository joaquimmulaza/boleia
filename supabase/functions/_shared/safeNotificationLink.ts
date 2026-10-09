/**
 * Validação de URLs de notificação — só caminhos internos da SPA (anti open-redirect).
 * Sincronizar com src/utils/safeNotificationLink.js
 */

export const INTERNAL_NOTIFICATION_PATH_RE = /^\/(?![/\\])/;

export function isSafeInternalNotificationPath(link: unknown): boolean {
  if (typeof link !== "string") {
    return false;
  }
  const trimmed = link.trim();
  if (!trimmed) {
    return false;
  }
  return INTERNAL_NOTIFICATION_PATH_RE.test(trimmed);
}

export function sanitizeNotificationLink(link: unknown, fallback = "/acordos"): string {
  if (isSafeInternalNotificationPath(link)) {
    return (link as string).trim();
  }
  return fallback;
}

export function resolvePushNotificationUrl(link: unknown, fallback = "/acordos"): string {
  return sanitizeNotificationLink(link, fallback);
}
