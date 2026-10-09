/**
 * CTA «Reactivar» — só ofertas inactivas despublicadas pelo motorista (não admin/is_test).
 *
 * @param {{
 *   estado?: string,
 *   inactiva_motivo?: string | null,
 *   is_test?: boolean,
 *   hidden_by_admin?: boolean,
 * } | null | undefined} oferta
 * @returns {boolean}
 */
export function canReactivarOferta(oferta) {
  if (String(oferta?.estado || '').toLowerCase() !== 'inactiva') return false;
  if (oferta?.is_test) return false;
  if (oferta?.hidden_by_admin) return false;
  if (String(oferta?.inactiva_motivo || '').toLowerCase() !== 'motorista') return false;
  return true;
}
