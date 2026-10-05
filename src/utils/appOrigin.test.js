import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getAppOrigin,
  getEmailConfirmRedirectUrl,
  getOAuthRedirectUrl,
  getPasswordRecoveryRedirectUrl,
} from './appOrigin';

describe('appOrigin', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_APP_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('getAppOrigin usa VITE_APP_URL quando definida', () => {
    vi.stubEnv('VITE_APP_URL', 'https://boleia-cyan.vercel.app');
    expect(getAppOrigin()).toBe('https://boleia-cyan.vercel.app');
  });

  it('getAppOrigin remove barra final de VITE_APP_URL', () => {
    vi.stubEnv('VITE_APP_URL', 'https://boleia-cyan.vercel.app/');
    expect(getAppOrigin()).toBe('https://boleia-cyan.vercel.app');
  });

  it('getAppOrigin faz fallback para window.location.origin', () => {
    expect(getAppOrigin()).toBe(window.location.origin);
  });

  it('getPasswordRecoveryRedirectUrl aponta para mode=update-password', () => {
    vi.stubEnv('VITE_APP_URL', 'https://boleia-cyan.vercel.app');
    expect(getPasswordRecoveryRedirectUrl()).toBe(
      'https://boleia-cyan.vercel.app/auth?mode=update-password',
    );
  });

  it('getOAuthRedirectUrl volta à página de auth', () => {
    vi.stubEnv('VITE_APP_URL', 'https://boleia-cyan.vercel.app');
    expect(getOAuthRedirectUrl()).toBe('https://boleia-cyan.vercel.app/auth');
  });

  it('getEmailConfirmRedirectUrl usa a origem do browser, não VITE_APP_URL', () => {
    vi.stubEnv('VITE_APP_URL', 'https://boleia-cyan.vercel.app');
    expect(getEmailConfirmRedirectUrl()).toBe(window.location.origin);
  });
});
