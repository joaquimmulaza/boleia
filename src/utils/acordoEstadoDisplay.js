/**
 * Labels humanos para estado do cabeçalho do acordo (lista + detalhe).
 * @param {string | null | undefined} estado
 * @returns {string}
 */
export function labelEstadoAcordo(estado) {
  const e = String(estado || '').toLowerCase();
  if (e === 'activo') return 'Activo';
  if (e === 'cancelamento_pendente') return 'Cancelamento pendente';
  if (e === 'cancelado') return 'Cancelado';
  if (e === 'cancelado_justificado') return 'Cancelado por justa causa';
  if (e === 'suspenso') return 'Suspenso';
  if (e === 'expirado') return 'Expirado';
  if (!estado) return '—';
  return estado.charAt(0).toUpperCase() + estado.slice(1).replace(/_/g, ' ');
}

/**
 * Variante visual do chip de estado do acordo.
 * @param {string | null | undefined} estado
 * @returns {'activo' | 'pendente' | 'inactivo'}
 */
export function variantChipEstadoAcordo(estado) {
  const e = String(estado || '').toLowerCase();
  if (e === 'activo') return 'activo';
  if (e === 'cancelamento_pendente') return 'pendente';
  return 'inactivo';
}
