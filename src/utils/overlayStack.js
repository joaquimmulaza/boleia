/** @type {Array<{ id: string, onDismiss: () => void }>} */
const stack = [];

/**
 * Regista overlay para Esc só fechar o do topo.
 * @param {string} id
 * @param {() => void} onDismiss
 */
export function pushOverlay(id, onDismiss) {
  stack.push({ id, onDismiss });
}

/**
 * @param {string} id
 */
export function popOverlay(id) {
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    if (stack[i].id === id) {
      stack.splice(i, 1);
      return;
    }
  }
}

/**
 * @returns {{ id: string, onDismiss: () => void } | undefined}
 */
export function getTopOverlay() {
  return stack[stack.length - 1];
}

/** Limpa stack — só para testes. */
export function resetOverlayStackForTests() {
  stack.length = 0;
}
