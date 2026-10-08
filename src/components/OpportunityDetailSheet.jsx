import React from 'react';
import OverlayShell from './OverlayShell';
import SheetDragHandle from './SheetDragHandle';
import RouteIndicator from './RouteIndicator';
import { resolveOpportunityCard } from '../utils/opportunityCard';

const placeNameClass = 'min-w-0 break-words whitespace-normal text-lg font-semibold leading-6 text-slate-900 dark:text-white';

const ctaClass = 'w-full rounded-xl bg-primary px-4 py-3 text-[15px] font-medium text-[#06130b] disabled:cursor-not-allowed disabled:bg-[#e2e8e5] disabled:text-[#06130b] dark:disabled:bg-slate-700';

/**
 * Detalhe da oportunidade (Figma 97:2 e irmãos). Reusa o modelo do cartão.
 * Não cria proposta.
 * @param {{
 *   kind: 'oferta' | 'procura' | 'grupo',
 *   item: object,
 *   onClose: () => void,
 *   onCta?: () => void,
 *   ctaLabel?: string,
 * }} props
 */
function OpportunityDetailSheet({ kind, item, onClose, onCta, ctaLabel }) {
  const card = resolveOpportunityCard({ kind, item });
  const rotuloCta = ctaLabel || card.cta;

  return (
    <OverlayShell
      variant="bottom"
      overlayClassName="bg-black/45"
      panelClassName="bg-white dark:bg-slate-900 shadow-2xl px-4 pt-2.5"
      testId="opportunity-detail-sheet"
      onDismiss={onClose}
    >
      <div className="flex flex-col gap-4">
        <SheetDragHandle onDismiss={onClose} />

        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{card.tipo}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[15px] font-medium text-slate-900 dark:text-white"
          >
            Fechar
          </button>
        </div>

        {card.rota ? (
          <div className="flex items-stretch gap-3">
            <RouteIndicator />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <p className={placeNameClass} data-testid="opportunity-place-name">{card.rota.origem}</p>
              <p className={placeNameClass} data-testid="opportunity-place-name">{card.rota.destino}</p>
            </div>
          </div>
        ) : null}

        {card.headline ? (
          <p className="text-base font-semibold leading-6 text-slate-900 dark:text-white">{card.headline}</p>
        ) : null}

        {card.horario.map((linha) => (
          <p key={linha} className="text-[15px] leading-5 text-slate-500">{linha}</p>
        ))}

        <p className="text-[15px] font-medium leading-5 text-slate-900 dark:text-white">{card.capacidade}</p>

        <div className="h-px w-full bg-[#e2e8e5] dark:bg-slate-800" />

        {card.preco ? (
          <div>
            <p className="text-xl font-semibold leading-7 text-slate-900 dark:text-white">{card.preco.valor}</p>
            {card.preco.modo ? (
              <p className="text-[13px] leading-[18px] text-slate-500">{card.preco.modo}</p>
            ) : null}
          </div>
        ) : null}

        {onCta ? (
          <button
            type="button"
            className={ctaClass}
            disabled={card.ctaDisabled}
            onClick={onCta}
          >
            {rotuloCta}
          </button>
        ) : null}
      </div>
    </OverlayShell>
  );
}

export default OpportunityDetailSheet;
