import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shouldRedirectRecoveryToAuth, buildRecoveryAuthPath } from './passwordRecoveryRedirect';

describe('passwordRecoveryRedirect', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: {
        pathname: '/',
        hash: '',
        search: '',
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shouldRedirectRecoveryToAuth detecta type=recovery no hash', () => {
    expect(
      shouldRedirectRecoveryToAuth({ pathname: '/', hash: '#access_token=abc&type=recovery' }),
    ).toBe(true);
  });

  it('shouldRedirectRecoveryToAuth ignora quando já está em /auth', () => {
    expect(
      shouldRedirectRecoveryToAuth({ pathname: '/auth', hash: '#type=recovery' }),
    ).toBe(false);
  });

  it('shouldRedirectRecoveryToAuth ignora hash sem recovery', () => {
    expect(
      shouldRedirectRecoveryToAuth({ pathname: '/', hash: '#access_token=abc&type=signup' }),
    ).toBe(false);
  });

  it('buildRecoveryAuthPath preserva hash e query mode', () => {
    expect(buildRecoveryAuthPath({ hash: '#access_token=abc&type=recovery' })).toBe(
      '/auth?mode=update-password#access_token=abc&type=recovery',
    );
  });
});
