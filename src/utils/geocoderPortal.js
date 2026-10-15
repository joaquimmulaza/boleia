/**
 * Destino do portal da lista de sugestões — dentro do dialog modal quando existir.
 * @param {Element | null | undefined} anchorEl
 * @returns {HTMLElement}
 */
export function resolveGeocoderPortalContainer(anchorEl) {
  if (typeof document === 'undefined') {
    throw new Error('resolveGeocoderPortalContainer requer document');
  }
  if (anchorEl instanceof Element) {
    const modalDialog = anchorEl.closest('[role="dialog"][aria-modal="true"]');
    if (modalDialog instanceof HTMLElement) {
      return modalDialog;
    }
  }
  return document.body;
}
