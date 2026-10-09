import { describe, expect, it } from 'vitest';
import {
  isAnonOrAuthPrivilegeError,
  isLiveAuthSession,
  isAccessTokenExpiredOrNearExpiry,
  isJwtSessionError,
  shouldRefreshSessionForAuthError,
  profileFetchSessionKey,
} from './authProfileFetch.js';

describe('authProfileFetch', () => {
  describe('isLiveAuthSession', () => {
    it('exige access_token e user.id', () => {
      expect(isLiveAuthSession(null)).toBe(false);
      expect(isLiveAuthSession({ user: { id: 'u1' } })).toBe(false);
      expect(isLiveAuthSession({ access_token: 'tok' })).toBe(false);
      const now = Math.floor(Date.now() / 1000);
      expect(
        isLiveAuthSession({ access_token: 'tok', user: { id: 'u1' }, expires_at: now + 3600 }),
      ).toBe(true);
    });

    it('rejeita token expirado (expires_at)', () => {
      const now = Math.floor(Date.now() / 1000);
      expect(
        isLiveAuthSession({ access_token: 'tok', user: { id: 'u1' }, expires_at: now - 1 }),
      ).toBe(false);
      expect(
        isLiveAuthSession({ access_token: 'tok', user: { id: 'u1' }, expires_at: now }),
      ).toBe(false);
    });
  });

  describe('profileFetchSessionKey', () => {
    it('combina user.id e access_token', () => {
      expect(
        profileFetchSessionKey({ user: { id: 'u1' }, access_token: 'tok-a' }),
      ).toBe('u1:tok-a');
    });
  });

  describe('isAccessTokenExpiredOrNearExpiry', () => {
    it('true quando expires_at está no passado ou dentro do skew', () => {
      const now = Math.floor(Date.now() / 1000);
      expect(isAccessTokenExpiredOrNearExpiry({ access_token: 't', expires_at: now - 1 })).toBe(
        true,
      );
      expect(isAccessTokenExpiredOrNearExpiry({ access_token: 't', expires_at: now + 30 }, 90)).toBe(
        true,
      );
      expect(isAccessTokenExpiredOrNearExpiry({ access_token: 't', expires_at: now + 3600 }, 90)).toBe(
        false,
      );
    });
  });

  describe('isJwtSessionError', () => {
    it('PGRST301 e mensagem jwt expirado; 42501 não conta como JWT', () => {
      expect(isJwtSessionError({ code: 'PGRST301' })).toBe(true);
      expect(isJwtSessionError({ message: 'JWT expired' })).toBe(true);
      expect(isJwtSessionError({ code: '42501', status: 401 })).toBe(false);
    });
  });

  describe('shouldRefreshSessionForAuthError', () => {
    it('42501 com token válido não refresca; expirado sim', () => {
      const now = Math.floor(Date.now() / 1000);
      const fresh = { access_token: 't', user: { id: 'u' }, expires_at: now + 3600 };
      const expired = { access_token: 't', user: { id: 'u' }, expires_at: now - 10 };
      const err42501 = { code: '42501', status: 401 };
      expect(shouldRefreshSessionForAuthError(err42501, fresh)).toBe(false);
      expect(shouldRefreshSessionForAuthError(err42501, expired)).toBe(true);
    });
  });

  describe('isAnonOrAuthPrivilegeError', () => {
    it('reconhece 401/42501 e mensagem perfis', () => {
      expect(isAnonOrAuthPrivilegeError({ status: 401 })).toBe(true);
      expect(isAnonOrAuthPrivilegeError({ code: '42501' })).toBe(true);
      expect(isAnonOrAuthPrivilegeError({ message: 'permission denied for table perfis' })).toBe(
        true,
      );
      expect(isAnonOrAuthPrivilegeError({ code: 'PGRST116' })).toBe(false);
    });
  });
});
