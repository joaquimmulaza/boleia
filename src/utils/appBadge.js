/**
 * Syncs the OS app icon badge (Badging API) with unread notification count.
 * Only applies when the PWA is installed; no-ops gracefully elsewhere.
 */

export async function setAppBadgeCount(count) {
  if (typeof navigator === 'undefined' || !('setAppBadge' in navigator)) {
    return;
  }

  try {
    if (count > 0) {
      await navigator.setAppBadge(count);
    } else if ('clearAppBadge' in navigator) {
      await navigator.clearAppBadge();
    } else {
      await navigator.setAppBadge(0);
    }
  } catch {
    // Permission denied, unsupported OS, or user blocked badging.
  }
}

export async function clearAppBadge() {
  if (typeof navigator === 'undefined' || !('clearAppBadge' in navigator)) {
    return;
  }

  try {
    await navigator.clearAppBadge();
  } catch {
    // Ignore unsupported or denied badging.
  }
}
