import React from 'react';
import { Loader2 } from 'lucide-react';
import SheetDragHandle from './SheetDragHandle';
import AcordoDetalheKebabMenu from './AcordoDetalheKebabMenu';
import { Button } from './ui/button';
import {
  labelEstadoAcordo,
  variantChipEstadoAcordo,
} from '../utils/acordoEstadoDisplay';
import {
  labelChipEstadoPassageiro,
  chipClassEstadoPassageiro,
} from '../utils/acordoPassageiroStatus';

/**
 * @param {'activo' | 'pendente' | 'inactivo'} variant
 * @returns {string}
 */
function chipClassEstadoAcordo(variant) {
  if (variant === 'activo') {
    return 'bg-emerald-100 text-emerald-800';
  }
  if (variant === 'pendente') {
    return 'bg-amber-100 text-amber-900';
  }
  return 'bg-slate-100 text-slate-600';
}

/**
 * Cabeçalho fixo (sticky) do sheet «Detalhe do acordo» — puxador, Fechar, estado e título.
 * @param {{
 *   acordoId: string,
 *   estadoAcordo: string | null | undefined,
 *   minhaReservada?: boolean,
 *   leavePending?: boolean,
 *   isBodyScrolled?: boolean,
 *   fecharRef?: import('react').RefObject<HTMLButtonElement | null>,
 *   onClose: () => void,
 *   podeRegistarFaltas: boolean,
 *   podeEncerrar: boolean,
 *   onRegistarFalta: () => void,
 *   onEncerrar: () => void,
 *   onKebabTriggerRef?: (node: HTMLButtonElement | null) => void,
 * }} props
 */
export default function AcordoDetalheSheetHeader({
  acordoId,
  estadoAcordo,
  minhaReservada = false,
  leavePending = false,
  isBodyScrolled = false,
  fecharRef,
  onClose,
  podeRegistarFaltas,
  podeEncerrar,
  onRegistarFalta,
  onEncerrar,
  onKebabTriggerRef,
}) {
  return (
    <header
      data-testid="acordo-detalhe-sheet-header"
      data-scrolled={isBodyScrolled ? 'true' : 'false'}
      className={`sticky top-0 z-10 bg-white dark:bg-slate-900 px-5 pt-0 pb-3 border-b ${
        isBodyScrolled
          ? 'border-slate-200/90 shadow-[0_4px_12px_-8px_rgba(15,23,42,0.35)] dark:border-slate-700 dark:shadow-[0_4px_12px_-8px_rgba(0,0,0,0.5)]'
          : 'border-slate-100/90 dark:border-slate-800'
      }`}
    >
      <SheetDragHandle />

      <div className="flex items-center justify-between gap-3">
        <Button
          ref={fecharRef}
          type="button"
          variant="ghost"
          className="h-10 px-0 font-bold text-slate-600 dark:text-slate-300"
          data-testid="acordo-detalhe-fechar"
          onClick={onClose}
        >
          Fechar
        </Button>
        <AcordoDetalheKebabMenu
          podeRegistarFaltas={podeRegistarFaltas}
          podeEncerrar={podeEncerrar}
          onRegistarFalta={onRegistarFalta}
          onEncerrar={onEncerrar}
          onTriggerRef={onKebabTriggerRef}
        />
      </div>

      <div className="space-y-2 mt-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full ${chipClassEstadoAcordo(
                variantChipEstadoAcordo(estadoAcordo),
              )}`}
            >
              {labelEstadoAcordo(estadoAcordo)}
            </span>
            {minhaReservada ? (
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${chipClassEstadoPassageiro('reservado')}`}
                data-testid={`acordo-lugar-chip-${acordoId}`}
              >
                {labelChipEstadoPassageiro('reservado')}
              </span>
            ) : null}
            {leavePending ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                <Loader2 size={12} className="animate-spin shrink-0" aria-hidden="true" />
                Saída Pendente (A sincronizar...)
              </span>
            ) : null}
          </div>
        </div>
        <h2 id="acordo-detail-title" className="text-lg font-bold text-balance">
          Detalhe do acordo
        </h2>
      </div>
    </header>
  );
}
