import { useEffect, useState } from 'react';
import { drainQueue } from '../services/offlineQueue';

/**
 * Estado de rede reativo (online/offline).
 * No evento `online`, tenta drenar a fila offline (fallback sem Background Sync).
 * @returns {{ isOnline: boolean, isOffline: boolean }}
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void drainQueue().catch(() => {});
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
  };
}
