import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PASSWORD_RECOVERY_STORAGE_KEY,
  readPasswordRecoveryPending,
  markPasswordRecoveryPending,
  clearPasswordRecoveryStorage,
  normalizeRecoveryRedirect,
} from './passwordRecovery';

/**
 * @param {string} href
 */
const fakeWindow = (href) => {
  const url = new URL(href);
  return {
    location: { pathname: url.pathname, search: url.search, hash: url.hash },
    history: { replaceState: vi.fn() },
  };
};

describe('passwordRecovery storage helpers', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('começa a false sem chave', () => {
    expect(readPasswordRecoveryPending()).toBe(false);
  });

  it('mark → read true; clear → false', () => {
    markPasswordRecoveryPending();
    expect(sessionStorage.getItem(PASSWORD_RECOVERY_STORAGE_KEY)).toBe('1');
    expect(readPasswordRecoveryPending()).toBe(true);
    clearPasswordRecoveryStorage();
    expect(readPasswordRecoveryPending()).toBe(false);
  });
});

describe('normalizeRecoveryRedirect', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('link de recuperação que caiu na raiz vai para /auth?mode=update-password mantendo o hash', () => {
    const hash = '#access_token=abc&refresh_token=def&type=recovery';
    const win = fakeWindow(`https://app.test/${hash}`);

    expect(normalizeRecoveryRedirect(win)).toBe('recovery');
    expect(win.history.replaceState).toHaveBeenCalledWith(null, '', `/auth?mode=update-password${hash}`);
    expect(readPasswordRecoveryPending()).toBe(true);
  });

  it('já em /auth?mode=update-password não reescreve a URL mas marca pending', () => {
    const win = fakeWindow('https://app.test/auth?mode=update-password#access_token=abc&type=recovery');

    expect(normalizeRecoveryRedirect(win)).toBe('recovery');
    expect(win.history.replaceState).not.toHaveBeenCalled();
    expect(readPasswordRecoveryPending()).toBe(true);
  });

  it('link expirado (otp_expired) vai para recuperar com motivo link_expired', () => {
    const win = fakeWindow(
      'https://app.test/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
    );

    expect(normalizeRecoveryRedirect(win)).toBe('expired');
    expect(win.history.replaceState).toHaveBeenCalledWith(null, '', '/auth?mode=forgot&reason=link_expired');
    expect(readPasswordRecoveryPending()).toBe(false);
  });

  it('URL normal não faz nada', () => {
    const win = fakeWindow('https://app.test/passageiro');

    expect(normalizeRecoveryRedirect(win)).toBeNull();
    expect(win.history.replaceState).not.toHaveBeenCalled();
  });
});
