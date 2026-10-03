import React, { useState } from 'react';
import OverlayShell from './OverlayShell';
import SheetDragHandle from './SheetDragHandle';
import RouteIndicator from './RouteIndicator';
import { resolveOpportunityProposal } from '../utils/opportunityProposal';

const placeNameClass = 'min-w-0 break-words whitespace-normal text-lg font-semibold leading-6 text-slate-900 dark:text-white';

const ctaClass = 'w-full rounded-xl bg-primary px-4 py-3 text-[15px] font-medium text-[#06130b]';

/**
 * Proposta a partir de uma oportunidade.
 * Motorista: N é snapshot e a frase fica visível. Passageiro: stepper, sem essa frase.
 * @param {{
 *   papel: 'motorista' | 'passageiro',
 *   alvo?: 'grupo' | 'passageiro',
 *   item: object,
 *   nProposto: number,
 *   valorKz?: number | null,
 *   modoPreco?: string | null,
 *   onClose: () => void,
 *   onSubmit?: (n: number) => void,
 * }} props
 */
function OpportunityProposalSheet({
  papel,
  alvo = 'passageiro',
  item,
  nProposto,
  valorKz,
  modoPreco,
  onClose,
  onSubmit,
}) {
  const [nLocal, setNLocal] = useState(() => nProposto);
  const sheet = resolveOpportunityProposal({
    papel,
    alvo,
    item,
    nProposto: papel === 'passageiro' ? nLocal : nProposto,
    valorKz,
    modoPreco,
  });

  return (
    <OverlayShell
      variant="bottom"
      overlayClassName="bg-black/45"
      panelClassName="bg-white dark:bg-slate-900 shadow-2xl px-4 pt-2.5"
      testId="opportunity-proposal-sheet"
      onDismiss={onClose}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit?.(sheet.n);
        }}
      >
        <SheetDragHandle onDismiss={onClose} />

        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{sheet.titulo}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[15px] font-medium text-slate-900 dark:text-white"
          >
            Fechar
          </button>
        </div>

        {papel === 'motorista' ? (
          <p className="text-[13px] font-medium leading-[18px] text-slate-500">Para</p>
        ) : null}

        {sheet.nome ? (
          <p className={placeNameClass} data-testid="opportunity-place-name">{sheet.nome}</p>
        ) : null}

        {sheet.rota ? (
          <div className="flex items-stretch gap-3">
            <RouteIndicator />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <p className={placeNameClass} data-testid="opportunity-place-name">{sheet.rota.origem}</p>
              <p className={placeNameClass} data-testid="opportunity-place-name">{sheet.rota.destino}</p>
            </div>
          </div>
        ) : null}

        {sheet.headline ? (
          <p className="text-base font-semibold leading-6 text-slate-900 dark:text-white">{sheet.headline}</p>
        ) : null}

        {sheet.mostrarHorario
          ? sheet.horario.map((linha) => (
            <p key={linha} className="text-[15px] leading-5 text-slate-500">{linha}</p>
          ))
          : null}

        {sheet.stepper ? (
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-medium text-slate-900 dark:text-white">Passageiros</p>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                aria-label="Menos passageiros"
                className="flex size-9 items-center justify-center rounded-lg border border-[#e2e8e5] text-lg"
                onClick={() => setNLocal((atual) => Math.max(1, atual - 1))}
              >
                −
              </button>
              <span className="min-w-4 text-center text-base font-semibold">{sheet.n}</span>
              <button
                type="button"
                aria-label="Mais passageiros"
                className="flex size-9 items-center justify-center rounded-lg border border-[#e2e8e5] text-lg"
                onClick={() => setNLocal((atual) => atual + 1)}
              >
                +
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[15px] font-medium text-slate-900 dark:text-white">{sheet.contagem}</p>
        )}

        {sheet.snapshotNote ? (
          <p className="text-xs leading-4 text-slate-500">{sheet.snapshotNote}</p>
        ) : null}

        <div className="h-px w-full bg-[#e2e8e5] dark:bg-slate-800" />

        {sheet.precoUnico ? (
          <div>
            <p className="text-[22px] font-semibold leading-7 text-slate-900 dark:text-white">{sheet.precoUnico.valor}</p>
            <p className="text-[13px] leading-[18px] text-slate-500">{sheet.precoUnico.modo}</p>
          </div>
        ) : null}

        {sheet.precoPorPassageiro ? (
          <div className="flex items-center justify-between gap-3 text-[15px] leading-5">
            <span className="text-slate-500">Preço</span>
            <span className="font-semibold text-slate-900 dark:text-white">{sheet.precoPorPassageiro}</span>
          </div>
        ) : null}

        {sheet.total ? (
          <div className="flex items-center justify-between gap-3 text-[15px] leading-5">
            <span className="text-slate-500">{sheet.total.label}</span>
            <span className="font-semibold text-slate-900 dark:text-white">{sheet.total.valor}</span>
          </div>
        ) : null}

        <button type="submit" className={ctaClass}>
          {sheet.cta}
        </button>
      </form>
    </OverlayShell>
  );
}

export default OpportunityProposalSheet;
