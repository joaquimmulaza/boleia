import { detectInstallPlatform, isStandalone } from './pwaInstall';

/**
 * @typedef {'activado' | 'desactivado' | 'activating' | 'bloqueado' | 'erro' | 'sem_suporte'} PushProfileUiState
 */

/**
 * @typedef {Object} PushProfileStateInput
 * @property {boolean} isSupported
 * @property {NotificationPermission | string} permission
 * @property {boolean} isSubscribed
 * @property {boolean} [initialLoading]
 * @property {boolean} [activating]
 * @property {boolean} [activationError]
 * @property {boolean} [isInstalled]
 * @property {import('./pwaInstall').InstallPlatform} [platform]
 */

/**
 * Capacidade de push no perfil (iOS exige PWA no ecrã principal).
 * @param {{ isSupported?: boolean, isInstalled?: boolean, platform?: import('./pwaInstall').InstallPlatform }} input
 * @returns {{ pushAvailable: boolean, showIphoneHelper: boolean }}
 */
export function resolvePushProfileCapability(input = {}) {
  const platform = input.platform ?? detectInstallPlatform();
  const installed = input.isInstalled ?? isStandalone();
  const isSupported = Boolean(input.isSupported);

  if (platform === 'ios' && !installed) {
    return { pushAvailable: false, showIphoneHelper: true };
  }

  return { pushAvailable: isSupported, showIphoneHelper: false };
}

/**
 * Estado UI do interruptor (6 estados Figma /perfil push).
 * @param {PushProfileStateInput} input
 * @returns {PushProfileUiState}
 */
export function resolvePushProfileUiState(input) {
  const {
    isSupported,
    permission,
    isSubscribed,
    initialLoading = false,
    activating = false,
    activationError = false,
    isInstalled,
    platform,
  } = input;

  if (initialLoading) {
    return 'desactivado';
  }

  const { pushAvailable } = resolvePushProfileCapability({
    isSupported,
    isInstalled,
    platform,
  });

  if (!pushAvailable) {
    return 'sem_suporte';
  }

  if (String(permission).toLowerCase() === 'denied') {
    return 'bloqueado';
  }

  if (activating) {
    return 'activating';
  }

  if (activationError) {
    return 'erro';
  }

  if (isSubscribed && String(permission).toLowerCase() === 'granted') {
    return 'activado';
  }

  return 'desactivado';
}
