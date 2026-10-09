/** @typedef {'sem_lugares_vivos'} EncerramentoMotivoAcordo */

/**
 * Labels humanos para estado do cabeçalho do acordo (lista + detalhe).
 * Distinção Encerrado vs Cancelado vem só de encerramento_motivo (não inferir da UI).
 *
 * @param {string | { estado?: string | null, encerramento_motivo?: EncerramentoMotivoAcordo | null, rescisao_modo?: string | null } | null | undefined} estado
 * @param {EncerramentoMotivoAcordo | null | undefined} [encerramentoMotivo]
 * @param {string | null | undefined} [rescisaoModo]
 * @returns {string}
 */
export function labelEstadoAcordo(estado, encerramentoMotivo, rescisaoModo) {
  let e;
  let motivo = encerramentoMotivo;
  let rescisao = rescisaoModo;
  if (estado && typeof estado === 'object') {
    motivo = estado.encerramento_motivo ?? motivo;
    rescisao = estado.rescisao_modo ?? rescisao;
    e = String(estado.estado || '').toLowerCase();
  } else {
    e = String(estado || '').toLowerCase();
  }
  const temRescisao = Boolean(rescisao && String(rescisao).trim());
  if (e === 'activo') return 'Activo';
  if (e === 'cancelamento_pendente') return 'Cancelamento pendente';
  if (e === 'cancelado' && motivo === 'sem_lugares_vivos' && !temRescisao) return 'Encerrado';
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
