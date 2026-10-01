import React from 'react';
import { ChevronRight } from 'lucide-react';
import OverlayShell from './OverlayShell';
import SheetDragHandle from './SheetDragHandle';
import LoadingSkeleton from './LoadingSkeleton';
import {
  buildPropostasSheetSummary,
  chipPropostaSheet,
  formatPropostaSheetPreco,
  labelPropostaSheetRow,
} from '../utils/propostaSheet';

/**
 * @param {string | null | undefined} modo
 */
function labelModo(modo) {
  return modo === 'TOTAL_ACORDO' ? 'Total do acordo' : 'Por passageiro';
}

/**
 * Bottom sheet in-context — lista propostas da oferta (Figma C2 / C2b).
 * @param {{
 *   tituloOferta: string,
 *   horario: string,
 *   reviews: Array<import('../utils/propostaReview').PropostaReview>,
 *   loading?: boolean,
 *   summaryCounts?: { recebidas?: number, enviadas?: number, concluidas?: number },
 *   onClose: () => void,
 *   onVerReview: (review: object) => void,
 * }} props
 */
function ProposalSheet({
  tituloOferta,
  horario,
  reviews,
  loading = false,
  summaryCounts,
  onClose,
  onVerReview,
}) {
  const count = reviews.length;
  const summary = buildPropostasSheetSummary({
    tituloOferta,
    horario,
    count,
    recebidas: summaryCounts?.recebidas,
    enviadas: summaryCounts?.enviadas ?? 0,
    concluidas: summaryCounts?.concluidas ?? 0,
  });

  return (
    <OverlayShell
      variant="bottom"
      overlayClassName="bg-black/45"
      panelClassName="bg-white dark:bg-slate-900 shadow-2xl rounded-t-[20px] px-4 pt-2.5 pb-7"
      testId="proposal-sheet"
      panelTestId="proposal-sheet-panel"
      onDismiss={onClose}
    >
      <div className="flex flex-col gap-4 max-h-[70dvh]">
        <SheetDragHandle onDismiss={onClose} />

        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Propostas</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-sm font-semibold text-slate-900 dark:text-white"
          >
            Fechar
          </button>
        </div>

        <p className="text-xs text-slate-500">{summary}</p>

        {loading ? (
          <LoadingSkeleton />
        ) : count === 0 ? (
          <div className="py-8 text-center space-y-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Ainda não há propostas nesta oferta
            </p>
            <p className="text-xs text-slate-400">Quando alguém propuser, aparece aqui.</p>
          </div>
        ) : (
          <ul className="space-y-3 overflow-y-auto overscroll-contain min-h-0 flex-1">
            {reviews.map((review) => {
              const rowLabel = labelPropostaSheetRow(review);
              const chip = chipPropostaSheet(review.proposta.estado);
              return (
                <li key={review.proposta.id}>
                  <button
                    type="button"
                    data-proposta-id={review.proposta.id}
                    aria-label={`Ver proposta ${rowLabel}`}
                    onClick={() => onVerReview(review)}
                    className="w-full flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-3.5 pr-3 py-3.5 text-left"
                  >
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {rowLabel}
                        </span>
                        {chip ? (
                          <span
                            className={`shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full ${chip.className}`}
                          >
                            {chip.label}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-500">{labelModo(review.proposta.modo_preco)}</span>
                        <span className="font-bold text-primary tabular-nums">
                          {formatPropostaSheetPreco(review)}
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 flex items-center gap-0.5 text-sm font-semibold text-primary">
                      Ver
                      <ChevronRight size={18} className="text-slate-400" aria-hidden="true" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </OverlayShell>
  );
}

export default ProposalSheet;
