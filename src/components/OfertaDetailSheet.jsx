import React from 'react';
import { Clock, Users, ChevronRight } from 'lucide-react';
import OverlayShell from './OverlayShell';
import SheetDragHandle from './SheetDragHandle';
import { formatKwanza } from '../utils/formatKwanza';

/**
 * Detalhe da oferta — card vivo tap (Figma D2).
 * @param {{
 *   oferta: object,
 *   tituloRota: import('react').ReactNode,
 *   horario: string,
 *   chipLabel: string,
 *   chipClassName: string,
 *   tipoRota: string,
 *   modoLabel: string,
 *   onClose: () => void,
 *   onVerProcuras: () => void,
 *   onVerPropostas: () => void,
 *   canReactivar?: boolean,
 *   onReactivar?: () => void,
 *   reactivarBusy?: boolean,
 * }} props
 */
function OfertaDetailSheet({
  oferta,
  tituloRota,
  horario,
  chipLabel,
  chipClassName,
  tipoRota,
  modoLabel,
  onClose,
  onVerProcuras,
  onVerPropostas,
  canReactivar = false,
  onReactivar = () => {},
  reactivarBusy = false,
}) {
  return (
    <OverlayShell
      variant="bottom"
      overlayClassName="bg-black/45"
      panelClassName="bg-white dark:bg-slate-900 shadow-2xl px-5 pt-2.5"
      testId="oferta-detail-sheet"
      onDismiss={onClose}
    >
      <div className="flex flex-col gap-4">
        <SheetDragHandle onDismiss={onClose} />

        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Detalhe da oferta</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-sm font-semibold"
          >
            Fechar
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${chipClassName}`}>
              {chipLabel}
            </span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {tipoRota}
            </span>
          </div>

          <div className="text-base font-bold text-slate-900 dark:text-white">{tituloRota}</div>

          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="flex items-center gap-1 tabular-nums">
              <Clock size={15} aria-hidden="true" /> {horario}
            </span>
            <span className="flex items-center gap-1">
              <Users size={15} aria-hidden="true" />{' '}
              {oferta.vagas_disponiveis}{' '}
              {oferta.vagas_disponiveis === 1 ? 'lugar disponível' : 'lugares disponíveis'}
            </span>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <strong className="text-primary text-xl tabular-nums">
              {formatKwanza(oferta.valor_mensal_ask_kz)} Kz
            </strong>
            <p className="text-xs text-slate-400">{modoLabel}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          {canReactivar ? (
            <button
              type="button"
              onClick={onReactivar}
              disabled={reactivarBusy}
              className="w-full min-h-11 rounded-xl bg-primary text-white text-sm font-bold flex items-center justify-center gap-1 disabled:opacity-60"
            >
              Reactivar
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onVerProcuras}
                className="w-full min-h-11 text-sm font-bold text-primary flex items-center justify-center gap-1"
              >
                Procuras compatíveis <ChevronRight size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onVerPropostas}
                className="w-full min-h-11 rounded-xl bg-primary/10 text-primary text-sm font-bold flex items-center justify-center gap-1"
              >
                Ver propostas <ChevronRight size={16} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>
    </OverlayShell>
  );
}

export default OfertaDetailSheet;
