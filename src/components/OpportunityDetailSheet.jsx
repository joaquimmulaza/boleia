import React, { useCallback, useLayoutEffect, useRef } from 'react';
import OverlayShell from './OverlayShell';
import SheetDragHandle from './SheetDragHandle';
import RouteIndicator from './RouteIndicator';
import { resolveOpportunityCard } from '../utils/opportunityCard';
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap';
import { focusReturnableElement } from '../utils/focusTrap';

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
 *   ctaDisabled?: boolean,
 * }} props
 */
function OpportunityDetailSheet({ kind, item, onClose, onCta, ctaLabel, ctaDisabled = false }) {
  const card = resolveOpportunityCard({ kind, item });
  const rotuloCta = ctaLabel || card.cta;
  const disabled = ctaDisabled || card.ctaDisabled;
  const showCta = Boolean(rotuloCta && (onCta || disabled));

  const dialogRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const fecharRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const returnFocusRef = useRef(/** @type {HTMLElement | null} */ (null));

  useLayoutEffect(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      returnFocusRef.current = active;
    }
  }, []);

  useDialogFocusTrap({
    containerRef: dialogRef,
    initialFocusRef: fecharRef,
    active: true,
  });

  const handleClose = useCallback(() => {
    const returnTo = returnFocusRef.current;
    onClose();
    focusReturnableElement(returnTo);
  }, [onClose]);

  return (
    <OverlayShell
      variant="bottom"
      overlayClassName="bg-black/45"
      panelClassName="bg-white dark:bg-slate-900 shadow-2xl px-4 pt-2.5"
      testId="opportunity-detail-sheet"
      onDismiss={handleClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="opportunity-detail-title"
        className="flex flex-col gap-4"
      >
        <SheetDragHandle onDismiss={handleClose} />

        <div className="flex items-center justify-between gap-3">
          <h2 id="opportunity-detail-title" className="text-lg font-semibold text-slate-900 dark:text-white">
            {card.tipo}
          </h2>
          <button
            ref={fecharRef}
            type="button"
            onClick={handleClose}
            data-testid="opportunity-detail-fechar"
            className="rounded-lg px-3 py-1.5 text-[15px] font-medium text-slate-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
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

        {showCta ? (
          <button
            type="button"
            className={ctaClass}
            disabled={disabled}
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
