/** Chave sessionStorage para sessão de recuperação de palavra-passe. */
export const PASSWORD_RECOVERY_STORAGE_KEY = 'bc_password_recovery';

/**
 * @returns {boolean}
 */
export function readPasswordRecoveryPending() {
  try {
    return sessionStorage.getItem(PASSWORD_RECOVERY_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markPasswordRecoveryPending() {
  try {
    sessionStorage.setItem(PASSWORD_RECOVERY_STORAGE_KEY, '1');
  } catch {
    // storage indisponível (privado / quota) — estado React ainda cobre a sessão actual
  }
}

export function clearPasswordRecoveryStorage() {
  try {
    sessionStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
  } catch {
    // ignore
  }
}
