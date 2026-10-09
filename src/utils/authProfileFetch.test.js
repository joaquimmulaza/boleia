import { describe, expect, it } from 'vitest';
import { isAnonOrAuthPrivilegeError, isLiveAuthSession } from './authProfileFetch.js';

describe('authProfileFetch', () => {
  describe('isLiveAuthSession', () => {
    it('exige access_token e user.id', () => {
      expect(isLiveAuthSession(null)).toBe(false);
      expect(isLiveAuthSession({ user: { id: 'u1' } })).toBe(false);
      expect(isLiveAuthSession({ access_token: 'tok' })).toBe(false);
      expect(isLiveAuthSession({ access_token: 'tok', user: { id: 'u1' } })).toBe(true);
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
