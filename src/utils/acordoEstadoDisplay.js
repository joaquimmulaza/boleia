/** @typedef {'sem_lugares_vivos'} EncerramentoMotivoAcordo */

/**
 * @typedef {{
 *   estado?: string | null,
 *   encerramento_motivo?: EncerramentoMotivoAcordo | null,
 *   rescisao_modo?: string | null,
 *   rescisao_confirmada_em?: string | null,
 *   rescisao_solicitada_por?: string | null,
 * }} AcordoEstadoChipInput
 */

/**
 * @param {string | AcordoEstadoChipInput | null | undefined} estado
 * @param {EncerramentoMotivoAcordo | null | undefined} [encerramentoMotivo]
 * @param {string | null | undefined} [rescisaoModo]
 * @returns {AcordoEstadoChipInput & { e: string }}
 */
function normalizeAcordoEstadoInput(estado, encerramentoMotivo, rescisaoModo) {
  if (estado && typeof estado === 'object') {
    return {
      estado: estado.estado,
      encerramento_motivo: estado.encerramento_motivo ?? encerramentoMotivo,
      rescisao_modo: estado.rescisao_modo ?? rescisaoModo,
      rescisao_confirmada_em: estado.rescisao_confirmada_em,
      rescisao_solicitada_por: estado.rescisao_solicitada_por,
      e: String(estado.estado || '').toLowerCase(),
    };
  }
  return {
    estado,
    encerramento_motivo: encerramentoMotivo,
    rescisao_modo: rescisaoModo,
    rescisao_confirmada_em: undefined,
    rescisao_solicitada_por: undefined,
    e: String(estado || '').toLowerCase(),
  };
}

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
 * Acordo fechado por saída do último passageiro (cd4a92aa inclui consensual pendente).
 *
 * @param {AcordoEstadoChipInput & { e?: string }} input
 * @returns {boolean}
 */
export function isAcordoEncerradoSemLugaresVivos(input) {
  const e = input.e ?? String(input.estado || '').toLowerCase();
  const motivo = input.encerramento_motivo;
  if (e !== 'cancelado' || motivo !== 'sem_lugares_vivos') return false;
  return !rescisaoBloqueiaLabelEncerrado(input.rescisao_modo, input.rescisao_confirmada_em);
}

/**
 * Pedido consensual aberto (chip «Encerramento pedido») — não aplica a encerrado sem lugares.
 *
 * @param {AcordoEstadoChipInput & { e?: string }} input
 * @returns {boolean}
 */
export function isChipEncerramentoPedidoConsensual(input) {
  if (isAcordoEncerradoSemLugaresVivos(input)) return false;
  const e = input.e ?? String(input.estado || '').toLowerCase();
  if (e !== 'activo' && e !== 'cancelamento_pendente') return false;
  if (String(input.rescisao_modo || '').toLowerCase() !== 'consensual') return false;
  if (input.rescisao_confirmada_em) return false;
  return Boolean(input.rescisao_solicitada_por);
}

/**
 * Labels humanos para estado do cabeçalho do acordo (lista + detalhe).
 * Distinção Encerrado vs Cancelado vem só de encerramento_motivo (não inferir da UI).
 *
 * @param {string | AcordoEstadoChipInput | null | undefined} estado
 * @param {EncerramentoMotivoAcordo | null | undefined} [encerramentoMotivo]
 * @param {string | null | undefined} [rescisaoModo]
 * @returns {string}
 */
export function labelEstadoAcordo(estado, encerramentoMotivo, rescisaoModo) {
  const norm = normalizeAcordoEstadoInput(estado, encerramentoMotivo, rescisaoModo);
  const { e } = norm;

  if (isAcordoEncerradoSemLugaresVivos(norm)) return 'Encerrado';
  if (isChipEncerramentoPedidoConsensual(norm)) return 'Encerramento pedido';
  if (e === 'activo') return 'Activo';
  if (e === 'cancelamento_pendente') return 'Cancelamento pendente';
  if (e === 'cancelado') return 'Cancelado';
  if (e === 'cancelado_justificado') return 'Cancelado por justa causa';
  if (e === 'suspenso') return 'Suspenso';
  if (e === 'expirado') return 'Expirado';
  if (!estado) return '—';
  const raw = typeof estado === 'object' ? String(estado.estado || '') : String(estado || '');
  return raw.charAt(0).toUpperCase() + raw.slice(1).replace(/_/g, ' ');
}

/**
 * Variante visual do chip de estado do acordo.
 * @param {string | AcordoEstadoChipInput | null | undefined} estado
 * @param {EncerramentoMotivoAcordo | null | undefined} [encerramentoMotivo]
 * @param {string | null | undefined} [rescisaoModo]
 * @returns {'activo' | 'pendente' | 'encerrado' | 'inactivo'}
 */
export function variantChipEstadoAcordo(estado, encerramentoMotivo, rescisaoModo) {
  const norm = normalizeAcordoEstadoInput(estado, encerramentoMotivo, rescisaoModo);
  const { e } = norm;

  if (isAcordoEncerradoSemLugaresVivos(norm)) return 'encerrado';
  if (e === 'activo' && !isChipEncerramentoPedidoConsensual(norm)) return 'activo';
  if (e === 'activo' || e === 'cancelamento_pendente') return 'pendente';
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
