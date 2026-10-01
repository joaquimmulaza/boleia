import { useCallback, useEffect, useState } from 'react';
import {
  detectInstallPlatform,
  isInAppBrowser,
  isStandalone,
  needsManualInstallInstructions,
} from '../utils/pwaInstall';

/**
 * @typedef {import('../utils/pwaInstall').InstallPlatform} InstallPlatform
 */

/**
 * @typedef {Object} BeforeInstallPromptEvent
 * @property {() => void} preventDefault
 * @property {() => Promise<void>} prompt
 * @property {Promise<{ outcome: 'accepted' | 'dismissed' }>} userChoice
 */

/**
 * Hook para instalação PWA (beforeinstallprompt + detecção de plataforma).
 * @returns {{
 *   canInstallNative: boolean,
 *   isInstalled: boolean,
 *   platform: InstallPlatform,
 *   isInApp: boolean,
 *   needsInstructions: boolean,
 *   promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>,
 * }}
 */
export function usePwaInstall() {
  const [installed, setInstalled] = useState(() => isStandalone());
  /** @type {[BeforeInstallPromptEvent | null, React.Dispatch<React.SetStateAction<BeforeInstallPromptEvent | null>>]} */
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  const platform = detectInstallPlatform();
  const inApp = isInAppBrowser();
  const canInstallNative = Boolean(deferredPrompt) && !installed;
  const needsInstructions = needsManualInstallInstructions({
    canInstallNative,
    platform,
    isInApp: inApp,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const syncInstalled = () => setInstalled(isStandalone());
    syncInstalled();

    /** @param {Event} event */
    const handleBeforeInstall = (event) => {
      event.preventDefault();
      setDeferredPrompt(/** @type {BeforeInstallPromptEvent} */ (event));
    };

    const displayModeQuery = window.matchMedia?.('(display-mode: standalone)');
    displayModeQuery?.addEventListener?.('change', syncInstalled);

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', syncInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', syncInstalled);
      displayModeQuery?.removeEventListener?.('change', syncInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt || installed) return 'unavailable';

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstalled(true);
        setDeferredPrompt(null);
      }
      return outcome;
    } catch {
      return 'unavailable';
    }
  }, [deferredPrompt, installed]);

  return {
    canInstallNative,
    isInstalled: installed,
    platform,
    isInApp: inApp,
    needsInstructions,
    promptInstall,
  };
}
