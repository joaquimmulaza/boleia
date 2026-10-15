/** @typedef {ServiceWorkerRegistration} ServiceWorkerRegistration */

export const DISMISS_STORAGE_KEY = 'pwa-update-dismissed-build-id';
const LEGACY_DISMISS_STORAGE_KEY = 'pwa-update-dismissed';

const BUILD_ID_MESSAGE_TIMEOUT_MS = 2000;

/** @type {ServiceWorkerRegistration | null} */
let sharedRegistration = null;
/** @type {ReturnType<typeof setInterval> | null} */
let hourlyUpdateIntervalId = null;
let visibilityListenerAttached = false;

/**
 * @returns {string | null}
 */
export function getDismissedBuildId() {
  try {
    const current = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (current) return current;

    const legacy = localStorage.getItem(LEGACY_DISMISS_STORAGE_KEY);
    if (legacy && isLegacyScriptUrlDismiss(legacy)) {
      localStorage.removeItem(LEGACY_DISMISS_STORAGE_KEY);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * @param {string} buildId
 */
export function setDismissedBuildId(buildId) {
  if (!buildId) return;
  try {
    localStorage.setItem(DISMISS_STORAGE_KEY, buildId);
    localStorage.removeItem(LEGACY_DISMISS_STORAGE_KEY);
  } catch {
    // incognito / quota
  }
}

export function clearDismissedBuildId() {
  try {
    localStorage.removeItem(DISMISS_STORAGE_KEY);
    localStorage.removeItem(LEGACY_DISMISS_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isLegacyScriptUrlDismiss(value) {
  if (!value) return false;
  if (value === '/sw.js') return true;
  try {
    const url = new URL(value, 'https://app.test');
    return url.pathname.endsWith('/sw.js');
  } catch {
    return value.includes('/sw.js');
  }
}

/**
 * Obtém o build id do service worker em waiting (deploy novo), não do bundle activo.
 *
 * @param {ServiceWorkerRegistration | null | undefined} registration
 * @returns {Promise<string | null>}
 */
export function fetchWaitingBuildId(registration) {
  const waiting = registration?.waiting;
  if (!waiting || typeof waiting.postMessage !== 'function') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timeoutId;
    const channel = new MessageChannel();

    const finish = (/** @type {string | null} */ buildId) => {
      if (timeoutId) clearTimeout(timeoutId);
      channel.port1.onmessage = null;
      resolve(buildId);
    };

    channel.port1.onmessage = (event) => {
      if (event.data?.type === 'BUILD_ID' && typeof event.data.buildId === 'string') {
        finish(event.data.buildId);
      }
    };

    timeoutId = setTimeout(() => finish(null), BUILD_ID_MESSAGE_TIMEOUT_MS);

    try {
      waiting.postMessage({ type: 'GET_BUILD_ID' }, [channel.port2]);
    } catch {
      finish(null);
    }
  });
}

function handleVisibilityChange() {
  if (typeof document === 'undefined') return;
  if (document.visibilityState !== 'visible') return;
  sharedRegistration?.update?.();
}

/**
 * Intervalo horário + visibilitychange (singleton — UpdatePrompt pode remontar).
 *
 * @param {ServiceWorkerRegistration | null | undefined} registration
 */
export function ensureServiceWorkerUpdateChecks(registration) {
  if (!registration) return;
  sharedRegistration = registration;

  if (hourlyUpdateIntervalId == null) {
    hourlyUpdateIntervalId = setInterval(() => {
      sharedRegistration?.update?.();
    }, 60 * 60 * 1000);
  }

  if (!visibilityListenerAttached && typeof document !== 'undefined') {
    visibilityListenerAttached = true;
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
}

/** Só para testes — repõe estado de módulo. */
export function resetServiceWorkerUpdateChecksForTests() {
  if (hourlyUpdateIntervalId != null) {
    clearInterval(hourlyUpdateIntervalId);
    hourlyUpdateIntervalId = null;
  }
  if (visibilityListenerAttached && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    visibilityListenerAttached = false;
  }
  sharedRegistration = null;
}
