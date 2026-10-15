import { GEOCODER_SHEET_PORTAL_SELECTOR } from './geocoderDismissChrome.js';

/**
 * Destino do portal da lista de sugestões — mount dedicado fora do painel transformado quando existir.
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
      const portal = modalDialog.querySelector(GEOCODER_SHEET_PORTAL_SELECTOR);
      if (portal instanceof HTMLElement) {
        return portal;
      }
      return modalDialog;
    }
  }
  return document.body;
}
