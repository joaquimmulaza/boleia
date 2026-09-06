const ELIGIBLE_KEY = 'boleia:permissions-eligible';
export const PERMISSIONS_ELIGIBLE_EVENT = 'boleia-permissions-eligible';

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
