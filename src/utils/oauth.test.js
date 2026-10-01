import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  OAUTH_PENDING_KEY,
  OAUTH_PROVIDER_KEY,
  OAUTH_PROVIDERS,
  canUnlinkIdentity,
  decideAccountLink,
  getProviderLabel,
  isProviderLinked,
  mapOAuthError,
  needsProfileSetup,
  parseOAuthCallback,
  startOAuthSignIn,
} from './oauth';

describe('oauth', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('lista Google, Apple, Facebook e LinkedIn OIDC por esta ordem', () => {
    expect(OAUTH_PROVIDERS.map((item) => item.id)).toEqual([
      'google',
      'apple',
      'facebook',
      'linkedin_oidc',
    ]);
  });

  it('needsProfileSetup só quando perfil_completo é false', () => {
    expect(needsProfileSetup(null)).toBe(false);
    expect(needsProfileSetup({})).toBe(false);
    expect(needsProfileSetup({ perfil_completo: true })).toBe(false);
    expect(needsProfileSetup({ perfil_completo: false })).toBe(true);
  });

  it('decideAccountLink não associa email não verificado', () => {
    expect(decideAccountLink({
      existingUserWithEmail: true,
      emailVerified: false,
    })).toBe('do_not_link');
  });

  it('decideAccountLink associa email verificado de conta existente', () => {
    expect(decideAccountLink({
      existingUserWithEmail: true,
      emailVerified: true,
    })).toBe('link_existing');
  });

  it('decideAccountLink cria utilizador novo sem conta prévia', () => {
    expect(decideAccountLink({ emailVerified: true })).toBe('create_user');
  });

  it('decideAccountLink rejeita identidade de provider já ligada', () => {
    expect(decideAccountLink({
      identityAlreadyLinked: true,
      emailVerified: true,
      existingUserWithEmail: true,
    })).toBe('reject_duplicate_identity');
  });

  it('canUnlinkIdentity protege a última identidade e ignora email/password', () => {
    const onlyGoogle = [{ provider: 'google' }];
    expect(canUnlinkIdentity(onlyGoogle, onlyGoogle[0])).toBe(false);

    const both = [{ provider: 'email' }, { provider: 'google' }];
    expect(canUnlinkIdentity(both, both[0])).toBe(false);
    expect(canUnlinkIdentity(both, both[1])).toBe(true);
  });

  it('isProviderLinked reconhece o provider', () => {
    expect(isProviderLinked([{ provider: 'apple' }], 'apple')).toBe(true);
    expect(isProviderLinked([{ provider: 'apple' }], 'google')).toBe(false);
  });

  it('parseOAuthCallback lê error e descrição', () => {
    const params = new URLSearchParams('error=access_denied&error_description=user%20cancelled');
    expect(parseOAuthCallback(params)).toEqual({
      error: 'access_denied',
      description: 'user cancelled',
    });
    expect(parseOAuthCallback(new URLSearchParams('code=abc'))).toBeNull();
  });

  it('mapOAuthError cobre cancelamento, state, redirect, duplicado e erro genérico', () => {
    expect(mapOAuthError({ error: 'access_denied', providerLabel: 'Google' }))
      .toBe('Cancelaste o início de sessão com Google.');
    expect(mapOAuthError({ error: 'bad_oauth_state' }))
      .toBe('A sessão de início de sessão expirou. Tenta novamente.');
    expect(mapOAuthError({ errorCode: 'invalid_request' }))
      .toBe('Não foi possível concluir o redireccionamento. Tenta novamente.');
    expect(mapOAuthError({ error: 'identity_already_exists' }))
      .toBe('Este método já está associado a outra conta.');
    expect(mapOAuthError({ error: 'server_error', providerLabel: 'Apple' }))
      .toBe('Não foi possível iniciar sessão com Apple. Tenta novamente.');
    expect(mapOAuthError({ errorCode: 'token=secret-value' })).not.toMatch(/secret-value/);
  });

  it('getProviderLabel cai no genérico', () => {
    expect(getProviderLabel('facebook')).toBe('Facebook');
    expect(getProviderLabel('desconhecido')).toBe('o fornecedor');
  });

  it('startOAuthSignIn pede o provider e, no registo, envia o papel', async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({ data: { url: 'https://idp.example' }, error: null });
    const client = { auth: { signInWithOAuth } };

    await startOAuthSignIn(client, 'google', {
      tipoPerfil: 'Motorista',
      redirectTo: 'https://boleia-cyan.vercel.app/auth',
    });

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'https://boleia-cyan.vercel.app/auth',
        skipBrowserRedirect: false,
        data: { tipo_perfil: 'Motorista' },
      },
    });
    expect(sessionStorage.getItem(OAUTH_PENDING_KEY)).toBe('1');
    expect(sessionStorage.getItem(OAUTH_PROVIDER_KEY)).toBe('google');
  });

  it('startOAuthSignIn no login não envia tipo_perfil', async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({ data: {}, error: null });
    await startOAuthSignIn({ auth: { signInWithOAuth } }, 'linkedin_oidc', {
      redirectTo: 'http://localhost:5173/auth',
    });
    expect(signInWithOAuth.mock.calls[0][0].options.data).toBeUndefined();
    expect(signInWithOAuth.mock.calls[0][0].provider).toBe('linkedin_oidc');
  });

  it('startOAuthSignIn limpa o pending quando o provider falha logo', async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({ data: null, error: { message: 'provider disabled' } });
    const result = await startOAuthSignIn({ auth: { signInWithOAuth } }, 'facebook', {
      redirectTo: 'http://localhost:5173/auth',
    });
    expect(result.error).toBeTruthy();
    expect(sessionStorage.getItem(OAUTH_PENDING_KEY)).toBeNull();
  });
});
