/**
 * Validação de URLs de notificação — só caminhos internos da SPA (anti open-redirect).
 * Sincronizar com src/utils/safeNotificationLink.js
 */

export const INTERNAL_NOTIFICATION_URL_BASE = "https://app.invalid";

export const UNSAFE_NOTIFICATION_LINK_CHARS_RE = /[\u0000-\u001F\u007F\\]/;

export function hasUnsafeNotificationLinkChars(link: unknown): boolean {
  return typeof link === "string" && UNSAFE_NOTIFICATION_LINK_CHARS_RE.test(link);
}

export function isSafeInternalNotificationPath(link: unknown): boolean {
  if (typeof link !== "string") {
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
    if (!url.pathname.startsWith("/")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function sanitizeNotificationLink(link: unknown, fallback = "/"): string {
  if (!isSafeInternalNotificationPath(link)) {
    return fallback;
  }
  const url = new URL((link as string).trim(), INTERNAL_NOTIFICATION_URL_BASE);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function resolvePushNotificationUrl(link: unknown, fallback = "/"): string {
  return sanitizeNotificationLink(link, fallback);
}

/**
 * Link push: sanitiza `link` da linha; se ausente/inválido, só deep-link acordo com metadata.acordo_id.
 */
export function resolvePushDataUrl(
  link: unknown,
  metadata: Record<string, unknown> | null | undefined,
): string {
  if (link != null && String(link).trim() !== "") {
    const fromLink = resolvePushNotificationUrl(link, "");
    if (fromLink !== "") {
      return fromLink;
    }
  }
  const acordoId = metadata?.acordo_id;
  if (acordoId != null && String(acordoId).trim() !== "") {
    return resolvePushNotificationUrl(
      `/acordos?openAcordoId=${encodeURIComponent(String(acordoId))}`,
      "/",
    );
  }
  return "/";
}
