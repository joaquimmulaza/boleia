/** @typedef {'sem_lugares_vivos'} EncerramentoMotivoAcordo */

/**
 * Rescisão que impede label «Encerrado» (consensual só conta após confirmação).
 *
 * @param {string | null | undefined} rescisaoModo
 * @param {string | Date | null | undefined} rescisaoConfirmadaEm
 * @returns {boolean}
 */
export function rescisaoBloqueiaLabelEncerrado(rescisaoModo, rescisaoConfirmadaEm) {
  const modo = String(rescisaoModo || '').trim().toLowerCase();
  if (!modo) return false;
  if (modo === 'consensual' && !rescisaoConfirmadaEm) return false;
  return true;
}

/**
 * Labels humanos para estado do cabeçalho do acordo (lista + detalhe).
 * Distinção Encerrado vs Cancelado vem só de encerramento_motivo (não inferir da UI).
 *
 * @param {string | { estado?: string | null, encerramento_motivo?: EncerramentoMotivoAcordo | null, rescisao_modo?: string | null, rescisao_confirmada_em?: string | null } | null | undefined} estado
 * @param {EncerramentoMotivoAcordo | null | undefined} [encerramentoMotivo]
 * @param {string | null | undefined} [rescisaoModo]
 * @returns {string}
 */
export function labelEstadoAcordo(estado, encerramentoMotivo, rescisaoModo) {
  let e;
  let motivo = encerramentoMotivo;
  let rescisao = rescisaoModo;
  let rescisaoConfirmadaEm;
  if (estado && typeof estado === 'object') {
    motivo = estado.encerramento_motivo ?? motivo;
    rescisao = estado.rescisao_modo ?? rescisao;
    rescisaoConfirmadaEm = estado.rescisao_confirmada_em;
    e = String(estado.estado || '').toLowerCase();
  } else {
    e = String(estado || '').toLowerCase();
  }
  const temRescisao = rescisaoBloqueiaLabelEncerrado(rescisao, rescisaoConfirmadaEm);
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
 * @param {string | { estado?: string | null, encerramento_motivo?: EncerramentoMotivoAcordo | null, rescisao_modo?: string | null, rescisao_confirmada_em?: string | null } | null | undefined} estado
 * @param {EncerramentoMotivoAcordo | null | undefined} [encerramentoMotivo]
 * @param {string | null | undefined} [rescisaoModo]
 * @returns {'activo' | 'pendente' | 'encerrado' | 'inactivo'}
 */
export function variantChipEstadoAcordo(estado, encerramentoMotivo, rescisaoModo) {
  let e;
  let motivo = encerramentoMotivo;
  let rescisao = rescisaoModo;
  let rescisaoConfirmadaEm;
  if (estado && typeof estado === 'object') {
    motivo = estado.encerramento_motivo ?? motivo;
    rescisao = estado.rescisao_modo ?? rescisao;
    rescisaoConfirmadaEm = estado.rescisao_confirmada_em;
    e = String(estado.estado || '').toLowerCase();
  } else {
    e = String(estado || '').toLowerCase();
  }
  const temRescisao = rescisaoBloqueiaLabelEncerrado(rescisao, rescisaoConfirmadaEm);
  if (e === 'activo') return 'activo';
  if (e === 'cancelamento_pendente') return 'pendente';
  if (e === 'cancelado' && motivo === 'sem_lugares_vivos' && !temRescisao) return 'encerrado';
  return 'inactivo';
}

/**
 * Classes Tailwind do chip de estado do acordo.
 * @param {'activo' | 'pendente' | 'encerrado' | 'inactivo'} variant
 * @returns {string}
 */
export function chipClassEstadoAcordoVariant(variant) {
  if (variant === 'activo') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  }
  if (variant === 'pendente') {
    return 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100';
  }
  if (variant === 'encerrado') {
    return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200';
  }
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
}
