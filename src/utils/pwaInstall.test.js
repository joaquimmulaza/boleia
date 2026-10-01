import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isStandalone,
  detectInstallPlatform,
  isInAppBrowser,
  getInstallDismissed,
  setInstallDismissed,
  INSTALL_DISMISS_STORAGE_KEY,
} from './pwaInstall';

describe('pwaInstall', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    Object.defineProperty(window.navigator, 'standalone', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0',
    });
  });

  describe('isStandalone', () => {
    it('devolve true quando display-mode é standalone', () => {
      vi.stubGlobal('matchMedia', vi.fn((query) => ({ matches: query.includes('standalone') })));
      expect(isStandalone()).toBe(true);
    });

    it('devolve true quando navigator.standalone no iOS', () => {
      Object.defineProperty(window.navigator, 'standalone', {
        configurable: true,
        value: true,
      });
      expect(isStandalone()).toBe(true);
    });

    it('devolve false no browser normal', () => {
      expect(isStandalone()).toBe(false);
    });
  });

  describe('detectInstallPlatform', () => {
    it('identifica iOS Safari', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        configurable: true,
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
      });
      expect(detectInstallPlatform()).toBe('ios');
    });

    it('identifica Android', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        configurable: true,
        value: 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0 Mobile Safari/537.36',
      });
      expect(detectInstallPlatform()).toBe('android');
    });

    it('identifica desktop', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        configurable: true,
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      });
      expect(detectInstallPlatform()).toBe('desktop');
    });
  });

  describe('isInAppBrowser', () => {
    it('detecta Facebook in-app browser', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        configurable: true,
        value: 'Mozilla/5.0 FBAN/FB4A',
      });
      expect(isInAppBrowser()).toBe(true);
    });

    it('devolve false no Chrome normal', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        configurable: true,
        value: 'Mozilla/5.0 Chrome/120.0.0.0',
      });
      expect(isInAppBrowser()).toBe(false);
    });
  });

  describe('dismiss storage', () => {
    it('persiste e lê dismiss do localStorage', () => {
      expect(getInstallDismissed()).toBe(false);
      setInstallDismissed();
      expect(localStorage.getItem(INSTALL_DISMISS_STORAGE_KEY)).toBe('1');
      expect(getInstallDismissed()).toBe(true);
    });
  });
});
