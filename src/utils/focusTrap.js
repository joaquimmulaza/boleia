/**
 * Elementos focáveis dentro de um contentor (para armadilha de foco em dialogs).
 * @param {ParentNode} root
 * @returns {HTMLElement[]}
 */
export function getFocusableElements(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return [];

  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  /** @type {HTMLElement[]} */
  const nodes = Array.from(root.querySelectorAll(selector));

  return nodes.filter((el) => {
    if (!(el instanceof HTMLElement)) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    if (el.hasAttribute('disabled')) return false;
    const tabIndex = el.getAttribute('tabindex');
    if (tabIndex === '-1') return false;
    return true;
  });
}

/**
 * @param {KeyboardEvent} event
 * @param {HTMLElement} container
 * @returns {boolean} true se o evento foi tratado (preventDefault)
 */
export function handleFocusTrapTabKey(event, container) {
  if (event.key !== 'Tab') return false;

  const focusables = getFocusableElements(container);
  if (focusables.length === 0) return false;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;

  if (!container.contains(active)) {
    event.preventDefault();
    first.focus();
    return true;
  }

  if (event.shiftKey) {
    if (active === first) {
      event.preventDefault();
      last.focus();
      return true;
    }
  } else if (active === last) {
    event.preventDefault();
    first.focus();
    return true;
  }

  return false;
}
