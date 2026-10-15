import React from 'react';
import { Loader2 } from 'lucide-react';
import SheetDragHandle from './SheetDragHandle';
import AcordoDetalheKebabMenu from './AcordoDetalheKebabMenu';
import { Button } from './ui/button';
import {
  labelChipFimLugar,
  chipClassFimLugar,
  mostrarChipFimLugar,
  testIdChipLugarAcordo,
} from '../utils/acordoSeatEndChip.js';
import { resolveAcordoListaCabecalhoUi } from '../utils/resolveAcordoListaCabecalhoUi.js';

/**
 * Cabeçalho fixo (sticky) do sheet «Detalhe do acordo» — puxador, Fechar, estado e título.
 * @param {{
 *   acordoId: string,
 *   estadoAcordo: string | null | undefined,
 *   encerramentoMotivoAcordo?: string | null,
 *   rescisaoModoAcordo?: string | null,
 *   rescisaoConfirmadaEmAcordo?: string | null,
 *   rescisaoSolicitadaPorAcordo?: string | null,
 *   rescisaoEffectiveOnAcordo?: string | null,
 *   driverIdAcordo?: string | null,
 *   acordosPassageiros?: Array<{ passenger_id?: string, estado?: string }>,
 *   nPassageirosContrato?: number | null,
 *   tipoPerfil?: string | null,
 *   viewerUserId?: string | null,
 *   minhaLinha?: { passenger_id?: string, estado?: string, lugar_rescisao_modo?: string | null, lugar_saida_iniciador?: string | null } | null,
 *   minhaChipCtx?: { anulacao_motivo?: string | null, estado?: string | null } | null,
 *   leavePending?: boolean,
 *   isBodyScrolled?: boolean,
 *   fecharRef?: import('react').RefObject<HTMLButtonElement | null>,
 *   onClose: () => void,
 *   podeRegistarFaltas: boolean,
 *   podeEncerrar: boolean,
 *   onRegistarFalta: () => void,
 *   onEncerrar: () => void,
 *   titulo?: string,
 *   onKebabTriggerRef?: (node: HTMLButtonElement | null) => void,
 * }} props
 */
export default function AcordoDetalheSheetHeader({
  acordoId,
  estadoAcordo,
  encerramentoMotivoAcordo,
  rescisaoModoAcordo,
  rescisaoConfirmadaEmAcordo,
  rescisaoSolicitadaPorAcordo,
  rescisaoEffectiveOnAcordo,
  driverIdAcordo,
  acordosPassageiros,
  nPassageirosContrato,
  tipoPerfil,
  viewerUserId,
  minhaLinha = null,
  minhaChipCtx = null,
  leavePending = false,
  isBodyScrolled = false,
  fecharRef,
  onClose,
  podeRegistarFaltas,
  podeEncerrar,
  onRegistarFalta,
  onEncerrar,
  titulo = 'Detalhe do acordo',
  onKebabTriggerRef,
}) {
  const acordoCabecalho = {
    estado: estadoAcordo,
    encerramento_motivo: encerramentoMotivoAcordo,
    rescisao_modo: rescisaoModoAcordo,
    rescisao_confirmada_em: rescisaoConfirmadaEmAcordo,
    rescisao_solicitada_por: rescisaoSolicitadaPorAcordo,
    rescisao_effective_on: rescisaoEffectiveOnAcordo,
    driver_id: driverIdAcordo,
    n_passageiros_contrato: nPassageirosContrato,
    acordos_passageiros: acordosPassageiros,
  };
  const minhaLinhaCabecalho =
    minhaLinha?.estado && viewerUserId
      ? { ...minhaLinha, passenger_id: minhaLinha.passenger_id ?? viewerUserId }
      : null;
  const { estadoChip, mostrarChipLugar } = resolveAcordoListaCabecalhoUi({
    acordo: acordoCabecalho,
    viewerUserId,
    tipoPerfil,
    minhaLinha: minhaLinhaCabecalho,
    minhaChipCtx,
  });
  const chipLugarLabel = minhaLinhaCabecalho
    ? labelChipFimLugar(minhaLinhaCabecalho, minhaChipCtx)
    : null;
  const mostrarChipLugarHeader =
    Boolean(mostrarChipLugar && minhaLinhaCabecalho && mostrarChipFimLugar(chipLugarLabel));

  return (
    <header
      data-testid="acordo-detalhe-sheet-header"
      data-scrolled={isBodyScrolled ? 'true' : 'false'}
      data-geocoder-sheet-header
      className={`shrink-0 bg-white dark:bg-slate-900 px-5 pt-0 pb-3 border-b ${
        isBodyScrolled
          ? 'border-slate-200/90 shadow-[0_4px_12px_-8px_rgba(15,23,42,0.35)] dark:border-slate-700 dark:shadow-[0_4px_12px_-8px_rgba(0,0,0,0.5)]'
          : 'border-slate-100/90 dark:border-slate-800'
      }`}
    >
      <SheetDragHandle />

      <div
        className="flex items-center justify-between gap-3"
        data-geocoder-dismiss-chrome
      >
        <Button
          ref={fecharRef}
          type="button"
          variant="ghost"
          className="relative z-0 h-10 px-0 font-bold text-slate-600 dark:text-slate-300 focus-visible:z-20 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
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

      <div className="mt-1 space-y-2 pt-0.5" data-geocoder-dismiss-chrome>
        <div
          data-testid="acordo-detalhe-titulo-chips"
          className="relative z-10 flex flex-wrap items-center gap-x-2 gap-y-2 min-w-0"
        >
          <h2
            id="acordo-detail-title"
            className="text-lg font-bold text-balance shrink-0 max-w-full"
          >
            {titulo}
          </h2>
          <span
            data-testid="acordo-detalhe-estado-chip"
            role={estadoChip.role}
            aria-label={estadoChip.ariaLabel}
            className={`shrink-0 whitespace-nowrap text-xs font-bold px-2.5 py-1 rounded-full ${estadoChip.className}`}
          >
            {estadoChip.label}
          </span>
          {mostrarChipLugarHeader ? (
            <span
              className={`shrink-0 whitespace-nowrap text-xs font-bold px-2.5 py-1 rounded-full ${chipClassFimLugar(chipLugarLabel)}`}
              data-testid={testIdChipLugarAcordo(acordoId, chipLugarLabel)}
            >
              {chipLugarLabel}
            </span>
          ) : null}
          {leavePending ? (
            <span className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
              <Loader2 size={12} className="animate-spin shrink-0" aria-hidden="true" />
              Saída Pendente (A sincronizar...)
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
