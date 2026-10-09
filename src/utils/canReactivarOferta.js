/**
 * CTA «Reactivar» — ofertas inactivas despublicadas pelo motorista (não admin).
 * is_test permitido (motorista QA); visibilidade pública continua via RLS Smoke #3a.
 *
 * @param {{
 *   estado?: string,
 *   inactiva_motivo?: string | null,
 * } | null | undefined} oferta
 * @returns {boolean}
 */
export function canReactivarOferta(oferta) {
  if (String(oferta?.estado || '').toLowerCase() !== 'inactiva') return false;
  if (String(oferta?.inactiva_motivo || '').toLowerCase() === 'admin') return false;
  if (String(oferta?.inactiva_motivo || '').toLowerCase() !== 'motorista') return false;
  return true;
}
