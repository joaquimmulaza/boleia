/**
 * Reexport da fonte única em supabase/functions/_shared (edge + cliente + SW).
 */
export {
  INTERNAL_NOTIFICATION_URL_BASE,
  UNSAFE_NOTIFICATION_LINK_CHARS_RE,
  isSafeNormalizedInternalPath,
  hasUnsafeNotificationLinkChars,
  isSafeInternalNotificationPath,
  sanitizeNotificationLink,
  resolvePushNotificationUrl,
  resolvePushDataUrl,
} from '../../supabase/functions/_shared/safeNotificationLink.js';
