/** Alvos do sheet (handle / cabeçalho) que fecham a lista do geocoder sem seleccionar. */
export const GEOCODER_DISMISS_CHROME_ATTR = 'data-geocoder-dismiss-chrome';

export const GEOCODER_DISMISS_CHROME_SELECTOR = `[${GEOCODER_DISMISS_CHROME_ATTR}]`;

/** Painel do bottom sheet onde a lista pode aparecer (sem ultrapassar o topo). */
export const GEOCODER_SHEET_BOUNDARY_ATTR = 'data-geocoder-sheet-boundary';

export const GEOCODER_SHEET_BOUNDARY_SELECTOR = `[${GEOCODER_SHEET_BOUNDARY_ATTR}]`;

/** Zona handle + título — a lista só abre abaixo disto. */
export const GEOCODER_SHEET_HEADER_ATTR = 'data-geocoder-sheet-header';

export const GEOCODER_SHEET_HEADER_SELECTOR = `[${GEOCODER_SHEET_HEADER_ATTR}]`;
