/**
 * CTA + gate de UI: só procura viva sem acordo activo/pendente.
 *
 * @param {{ estado?: string } | null | undefined} procura
 * @param {{ temAcordoActivo?: boolean }} [opts]
 * @returns {boolean}
 */
export function canEditProcura(procura, opts = {}) {
  const e = String(procura?.estado || '').toLowerCase();
  if (e !== 'activa' && e !== 'em_negociacao') return false;
  if (opts.temAcordoActivo) return false;
  return true;
}
