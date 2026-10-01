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

export const UPDATE_PASSWORD_PATH = '/auth?mode=update-password';
export const LINK_EXPIRED_PATH = '/auth?mode=forgot&reason=link_expired';

/**
 * Corrige o regresso do link de recuperação antes do router montar.
 * O Supabase cai no Site URL (raiz) quando o `redirectTo` não está nas Redirect URLs;
 * o hash é mantido para o cliente Supabase ainda o trocar por sessão.
 * @param {{ location: { pathname: string, search: string, hash: string }, history: { replaceState: Function } }} [win]
 * @returns {'recovery' | 'expired' | null}
 */
export function normalizeRecoveryRedirect(win = window) {
  const { pathname, search, hash } = win.location;
  if (!hash) return null;

  const params = new URLSearchParams(hash.replace(/^#/, ''));

  if (params.get('type') === 'recovery' && params.get('access_token')) {
    markPasswordRecoveryPending();
    const alreadyOnForm =
      pathname === '/auth' && new URLSearchParams(search).get('mode') === 'update-password';
    if (!alreadyOnForm) {
      win.history.replaceState(null, '', `${UPDATE_PASSWORD_PATH}${hash}`);
    }
    return 'recovery';
  }

  if (params.get('error_code') === 'otp_expired') {
    win.history.replaceState(null, '', LINK_EXPIRED_PATH);
    return 'expired';
  }

  return null;
}
