/** Alvos do sheet (handle / cabeçalho) que fecham a lista do geocoder sem seleccionar. */
export const GEOCODER_DISMISS_CHROME_ATTR = 'data-geocoder-dismiss-chrome';

export const GEOCODER_DISMISS_CHROME_SELECTOR = `[${GEOCODER_DISMISS_CHROME_ATTR}]`;

/** Painel do bottom sheet onde a lista pode aparecer (sem ultrapassar o topo). */
export const GEOCODER_SHEET_BOUNDARY_ATTR = 'data-geocoder-sheet-boundary';

export const GEOCODER_SHEET_BOUNDARY_SELECTOR = `[${GEOCODER_SHEET_BOUNDARY_ATTR}]`;

/** Zona handle + título — a lista só abre abaixo disto. */
export const GEOCODER_SHEET_HEADER_ATTR = 'data-geocoder-sheet-header';

export const GEOCODER_SHEET_HEADER_SELECTOR = `[${GEOCODER_SHEET_HEADER_ATTR}]`;

/** Lista flutuante do geocoder (portal) — não inicia drag do sheet. */
export const GEOCODER_FLOATING_LIST_ATTR = 'data-geocoder-floating-list';

export const GEOCODER_FLOATING_LIST_SELECTOR = `[${GEOCODER_FLOATING_LIST_ATTR}]`;

/** Mount do portal **fora** do painel transformado, dentro do dialog do sheet. */
export const GEOCODER_SHEET_PORTAL_ATTR = 'data-geocoder-sheet-portal';

export const GEOCODER_SHEET_PORTAL_SELECTOR = `[${GEOCODER_SHEET_PORTAL_ATTR}]`;
