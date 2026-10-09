import { formatDateLuandaPt, lastDayOfRescisaoCycle } from './rescisaoDisplay.js';

/** @typedef {'sem_lugares_vivos'} EncerramentoMotivoAcordo */

/**
 * @typedef {{
 *   estado?: string | null,
 *   encerramento_motivo?: EncerramentoMotivoAcordo | null,
 *   rescisao_modo?: string | null,
 *   rescisao_confirmada_em?: string | null,
 *   rescisao_solicitada_por?: string | null,
 *   rescisao_effective_on?: string | null,
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
      rescisao_effective_on: estado.rescisao_effective_on,
      e: String(estado.estado || '').toLowerCase(),
    };
  }
  return {
    estado,
    encerramento_motivo: encerramentoMotivo,
    rescisao_modo: rescisaoModo,
    rescisao_confirmada_em: undefined,
    rescisao_solicitada_por: undefined,
    rescisao_effective_on: undefined,
    e: String(estado || '').toLowerCase(),
  };
}

/**
 * Mesma regra que leave_passenger ao gravar sem_lugares_vivos:
 * rescisao_modo IS NULL OR (consensual AND rescisao_confirmada_em IS NULL).
 *
 * @param {string | null | undefined} rescisaoModo
 * @param {string | Date | null | undefined} rescisaoConfirmadaEm
 * @returns {boolean}
 */
export function rescisaoPermiteEncerramentoMotivoSemLugares(
  rescisaoModo,
  rescisaoConfirmadaEm,
) {
  const raw = rescisaoModo == null ? '' : String(rescisaoModo).trim();
  if (!raw) return true;
  const modo = raw.toLowerCase();
  if (modo === 'consensual' && !rescisaoConfirmadaEm) return true;
  return false;
}

/**
 * Rescisão que impede label «Encerrado» (inverso de {@link rescisaoPermiteEncerramentoMotivoSemLugares}).
 *
 * @param {string | null | undefined} rescisaoModo
 * @param {string | Date | null | undefined} rescisaoConfirmadaEm
 * @returns {boolean}
 */
export function rescisaoBloqueiaLabelEncerrado(rescisaoModo, rescisaoConfirmadaEm) {
  return !rescisaoPermiteEncerramentoMotivoSemLugares(rescisaoModo, rescisaoConfirmadaEm);
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
/**
 * Chip da lista `/acordos` — distingue requerente vs contraparte em consensual pendente.
 *
 * @param {string | AcordoEstadoChipInput | null | undefined} acordo
 * @param {string | null | undefined} userId
 * @returns {string}
 */
export function labelChipListaEstadoAcordo(acordo, userId) {
  const norm = normalizeAcordoEstadoInput(acordo);

  if (norm.e === 'cancelamento_pendente') {
    const fimCiclo = lastDayOfRescisaoCycle(norm.rescisao_effective_on);
    const fimFormatado = formatDateLuandaPt(fimCiclo)
      || formatDateLuandaPt(norm.rescisao_effective_on);
    if (fimFormatado) return `Termina a ${fimFormatado}`;
  }

  if (isChipEncerramentoPedidoConsensual(norm)) {
    if (userId && String(norm.rescisao_solicitada_por) === String(userId)) {
      return 'Encerramento pedido';
    }
    if (userId && String(norm.rescisao_solicitada_por) !== String(userId)) {
      return 'Falta a tua confirmação';
    }
    return 'Encerramento pedido';
  }

  return labelEstadoAcordo(norm);
}

/**
 * Variante do chip na lista (contraparte consensual → aviso).
 *
 * @param {string | AcordoEstadoChipInput | null | undefined} acordo
 * @param {string | null | undefined} userId
 * @returns {'activo' | 'pendente' | 'encerrado' | 'inactivo' | 'aviso'}
 */
export function variantChipListaEstadoAcordo(acordo, userId) {
  const norm = normalizeAcordoEstadoInput(acordo);
  if (
    isChipEncerramentoPedidoConsensual(norm)
    && userId
    && String(norm.rescisao_solicitada_por) !== String(userId)
  ) {
    return 'aviso';
  }
  return variantChipEstadoAcordo(norm);
}

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
  if (!e) return '—';
  return e.charAt(0).toUpperCase() + e.slice(1).replace(/_/g, ' ');
}

/**
 * Variante visual do chip de estado do acordo.
 * @param {string | AcordoEstadoChipInput | null | undefined} estado
 * @param {EncerramentoMotivoAcordo | null | undefined} [encerramentoMotivo]
 * @param {string | null | undefined} [rescisaoModo]
 * @returns {'activo' | 'pendente' | 'encerrado' | 'inactivo' | 'aviso'}
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
 * @param {'activo' | 'pendente' | 'encerrado' | 'inactivo' | 'aviso'} variant
 * @returns {string}
 */
export function chipClassEstadoAcordoVariant(variant) {
  if (variant === 'activo') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  }
  if (variant === 'aviso') {
    return 'bg-amber-100 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100 ring-1 ring-amber-300/80 dark:ring-amber-700/80';
  }
  if (variant === 'pendente') {
    return 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100';
  }
  if (variant === 'encerrado') {
    return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200';
  }
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
}
