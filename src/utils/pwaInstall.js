export const INSTALL_DISMISS_STORAGE_KEY = 'pwa-install-dismissed-v1';

/** @typedef {'ios' | 'android' | 'desktop' | 'unknown'} InstallPlatform */

/**
 * @returns {boolean}
 */
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia?.('(display-mode: standalone)')?.matches) return true;
    if (window.matchMedia?.('(display-mode: fullscreen)')?.matches) return true;
  } catch {
    // ignore
  }
  return window.navigator.standalone === true;
}

/**
 * @returns {InstallPlatform}
 */
export function detectInstallPlatform() {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';

  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) {
    return 'ios';
  }
  if (/Android/i.test(ua)) {
    return 'android';
  }
  if (/Mobi|Android/i.test(ua)) {
    return 'android';
  }
  if (/Windows|Macintosh|Linux|CrOS/i.test(ua)) {
    return 'desktop';
  }
  return 'unknown';
}

/**
 * Browsers embutidos (Facebook, Instagram, etc.) bloqueiam instalação PWA.
 * @returns {boolean}
 */
export function isInAppBrowser() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|Instagram|Line\/|Twitter|LinkedInApp|MicroMessenger|Snapchat/i.test(ua);
}

/**
 * @returns {boolean}
 */
export function getInstallDismissed() {
  try {
    return localStorage.getItem(INSTALL_DISMISS_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setInstallDismissed() {
  try {
    localStorage.setItem(INSTALL_DISMISS_STORAGE_KEY, '1');
  } catch {
    // incognito / quota
  }
}

export function clearInstallDismissed() {
  try {
    localStorage.removeItem(INSTALL_DISMISS_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * @param {{ canInstallNative?: boolean, platform?: InstallPlatform, isInApp?: boolean }} options
 * @returns {boolean}
 */
export function needsManualInstallInstructions({ canInstallNative = false, platform = 'unknown', isInApp = false } = {}) {
  if (canInstallNative) return false;
  if (isInApp) return true;
  return platform === 'ios' || platform === 'unknown';
}
