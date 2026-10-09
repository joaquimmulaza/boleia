import { useEffect, useState } from 'react';
import { drainOfflineQueueOnce } from '../utils/offlineQueueDrain';

/** @type {Set<(online: boolean) => void>} */
const subscribers = new Set();

let globalOnline =
  typeof navigator === 'undefined' ? true : navigator.onLine !== false;

let globalListenersAttached = false;

function notifySubscribers() {
  for (const fn of subscribers) {
    fn(globalOnline);
  }
}

function tryDrainWhenOnline() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  void drainOfflineQueueOnce().catch(() => {});
}

function attachGlobalNetworkListeners() {
  if (globalListenersAttached || typeof window === 'undefined') return;
  globalListenersAttached = true;

  window.addEventListener('online', () => {
    globalOnline = true;
    notifySubscribers();
    tryDrainWhenOnline();
  });
  window.addEventListener('offline', () => {
    globalOnline = false;
    notifySubscribers();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    tryDrainWhenOnline();
  });
}

/**
 * Estado de rede reativo (online/offline).
 * Dono único do drain offline em `online` e `visibilitychange` (via `offlineQueueDrain`).
 * @returns {{ isOnline: boolean, isOffline: boolean }}
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(globalOnline);

  useEffect(() => {
    attachGlobalNetworkListeners();
    /** @param {boolean} online */
    const onChange = (online) => setIsOnline(online);
    subscribers.add(onChange);
    return () => {
      subscribers.delete(onChange);
    };
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
  };
}
