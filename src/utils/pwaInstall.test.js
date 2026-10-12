import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isStandalone,
  detectInstallPlatform,
  isInAppBrowser,
  isIosSafariBrowser,
  isIpadOsDesktopUa,
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
    Object.defineProperty(window.navigator, 'platform', {
      configurable: true,
      value: 'Win32',
    });
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      configurable: true,
      value: 0,
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

    it('identifica iPadOS com UA Macintosh e touch', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        configurable: true,
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      });
      Object.defineProperty(window.navigator, 'platform', {
        configurable: true,
        value: 'MacIntel',
      });
      Object.defineProperty(window.navigator, 'maxTouchPoints', {
        configurable: true,
        value: 5,
      });
      expect(isIpadOsDesktopUa()).toBe(true);
      expect(detectInstallPlatform()).toBe('ios');
    });
  });

  describe('isIosSafariBrowser', () => {
    it('Safari iOS é Safari', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        configurable: true,
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      });
      expect(isIosSafariBrowser()).toBe(true);
    });

    it('Chrome iOS (CriOS) não é Safari', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        configurable: true,
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
      });
      expect(isIosSafariBrowser()).toBe(false);
    });

    it('Firefox iOS (FxiOS) não é Safari', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        configurable: true,
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120.0 Mobile/15E148 Safari/605.1.15',
      });
      expect(isIosSafariBrowser()).toBe(false);
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
