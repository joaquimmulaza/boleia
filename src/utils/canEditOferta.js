/**
 * CTA + gate UI: oferta publicada editável; despublicar bloqueado com acordo activo.
 *
 * @param {{ estado?: string } | null | undefined} oferta
 * @returns {boolean}
 */
export function canEditOferta(oferta) {
  const e = String(oferta?.estado || '').toLowerCase();
  if (e === 'inactiva') return false;
  if (e !== 'disponivel' && e !== 'parcial' && e !== 'cheia') return false;
  return true;
}

/**
 * @param {{ estado?: string } | null | undefined} oferta
 * @param {{ temAcordoActivo?: boolean }} [opts]
 * @returns {boolean}
 */
export function canDespublicarOferta(oferta, opts = {}) {
  if (!canEditOferta(oferta, opts)) return false;
  if (opts.temAcordoActivo) return false;
  return true;
}
