const ELIGIBLE_KEY = 'boleia:permissions-eligible';
export const PERMISSIONS_ELIGIBLE_EVENT = 'boleia-permissions-eligible';
export const ONBOARDING_PERMISSIONS_CLOSED_EVENT = 'boleia-onboarding-permissions-closed';

export function notifyOnboardingPermissionsClosed() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(ONBOARDING_PERMISSIONS_CLOSED_EVENT));
}

/**
 * Utilizador já não precisa do modal de permissões (decisão tomada ou onboarding feito).
 * @param {{ onboarding_completed?: boolean } | null | undefined} profile
 * @returns {Promise<boolean>}
 */
export async function shouldSkipOnboardingPermissions(profile) {
  if (profile?.onboarding_completed === true) return true;

  const notifPermission =
    typeof Notification !== 'undefined' ? Notification.permission : 'granted';

  if (notifPermission === 'granted') return true;

  try {
    const geoStatus = await navigator.permissions.query({ name: 'geolocation' });
    if (geoStatus.state === 'granted') return true;
  } catch {
    // permissions API indisponível
  }

  return false;
}

/**
 * Marca que o utilizador fez uma acção relevante (procura, veículo, oferta).
 * Só então o modal de permissões pode aparecer.
 */
export function markPermissionsEligible() {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(ELIGIBLE_KEY, '1');
    window.dispatchEvent(new Event(PERMISSIONS_ELIGIBLE_EVENT));
  } catch {
    // quota / modo privado — ignorar
  }
}

/**
 * @returns {boolean}
 */
export function isPermissionsEligible() {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    return sessionStorage.getItem(ELIGIBLE_KEY) === '1';
  } catch {
    return false;
  }
}
