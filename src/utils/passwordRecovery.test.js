import { describe, it, expect, beforeEach } from 'vitest';
import {
  PASSWORD_RECOVERY_STORAGE_KEY,
  readPasswordRecoveryPending,
  markPasswordRecoveryPending,
  clearPasswordRecoveryStorage,
} from './passwordRecovery';

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
