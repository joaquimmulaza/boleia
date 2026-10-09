/**
 * Validação de URLs de notificação — só caminhos internos da SPA (anti open-redirect).
 * Sincronizar com src/utils/safeNotificationLink.js
 */

export const INTERNAL_NOTIFICATION_URL_BASE = "https://app.invalid";

export const UNSAFE_NOTIFICATION_LINK_CHARS_RE = /[\u0000-\u001F\u007F\\]/;

/** Validação pós-normalização (URL parser colapsa `..` → pathname `//host`). */
export function isSafeNormalizedInternalPath(out: string): boolean {
  if (!out.startsWith("/") || out.startsWith("//") || out.includes("\\")) {
    return false;
  }
  const q = out.indexOf("?");
  const hashIdx = out.indexOf("#");
  let pathEnd = out.length;
  if (q >= 0) pathEnd = Math.min(pathEnd, q);
  if (hashIdx >= 0) pathEnd = Math.min(pathEnd, hashIdx);
  const pathOnly = out.slice(0, pathEnd);
  try {
    const decoded = decodeURIComponent(pathOnly);
    if (decoded.startsWith("//") || decoded.includes("\\")) {
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
    const out = `${url.pathname}${url.search}${url.hash}`;
    return isSafeNormalizedInternalPath(out);
  } catch {
    return false;
  }
}

export function sanitizeNotificationLink(link: unknown, fallback = "/"): string {
  if (!isSafeInternalNotificationPath(link)) {
    return fallback;
  }
  const url = new URL((link as string).trim(), INTERNAL_NOTIFICATION_URL_BASE);
  const out = `${url.pathname}${url.search}${url.hash}`;
  if (!isSafeNormalizedInternalPath(out)) {
    return fallback;
  }
  return out;
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
