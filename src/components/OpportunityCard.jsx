import React from 'react';
import RouteIndicator from './RouteIndicator';
import TextFade from './TextFade';
import { resolveOpportunityCard } from '../utils/opportunityCard';

const ctaClass = 'shrink-0 rounded-xl bg-primary px-4 py-3 text-[15px] font-medium text-[#06130b] disabled:cursor-not-allowed disabled:bg-[#e2e8e5] disabled:text-[#06130b] dark:disabled:bg-slate-700';

/**
 * Cartão de descoberta. O corpo abre o detalhe; o CTA é outra acção.
 * Não cria proposta. `nota` / `ctaDisabled` / `preco` são contexto do hub
 * (compatibilidade, preço da oferta seleccionada) — o mesmo cartão.
 * @param {{
 *   kind: 'oferta' | 'procura' | 'grupo',
 *   item: object,
 *   onOpen?: () => void,
 *   onCta?: () => void,
 *   nota?: string,
 *   ctaDisabled?: boolean,
 *   ctaLabel?: string,
 *   preco?: { valor: string, modo?: string | null } | null,
 * }} props
 */
function OpportunityCard({ kind, item, onOpen, onCta, nota, ctaDisabled = false, ctaLabel, preco }) {
  const card = resolveOpportunityCard({ kind, item });
  const precoRodape = preco === undefined ? card.preco : preco;
  const desligado = Boolean(card.ctaDisabled || ctaDisabled);
  const rotulo = ctaLabel || card.cta;
  const corpo = (
    <>
      <p className="text-xs font-medium tracking-wide text-primary">{card.tipo}</p>
      {card.rota ? (
        <div className="flex items-stretch gap-3">
          <RouteIndicator />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <TextFade lines={2} className="text-lg font-semibold leading-6 text-slate-900 dark:text-white">
              {card.rota.origem}
            </TextFade>
            <TextFade lines={2} className="text-lg font-semibold leading-6 text-slate-900 dark:text-white">
              {card.rota.destino}
            </TextFade>
          </div>
        </div>
      ) : null}
      {card.headline ? (
        <p className="text-lg font-semibold leading-6 text-slate-900 dark:text-white">{card.headline}</p>
      ) : null}
      {card.horario.map((linha) => (
        <p key={linha} className="text-[15px] leading-5 text-slate-500">{linha}</p>
      ))}
      <p className={`text-[15px] font-medium leading-5 ${desligado ? 'text-slate-500' : 'text-slate-900 dark:text-white'}`}>
        {card.capacidade}
      </p>
      {nota ? (
        <p className="text-[15px] leading-5 text-slate-500">{nota}</p>
      ) : null}
    </>
  );

  return (
    <article
      className="flex flex-col gap-3 rounded-2xl border border-[#e2e8e5] bg-white p-4 shadow-[0_4px_8px_rgba(23,35,28,0.06)] dark:border-slate-800 dark:bg-slate-900"
      data-testid="opportunity-card"
    >
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="flex flex-col items-start gap-3 text-left"
          data-testid="opportunity-open"
        >
          {corpo}
        </button>
      ) : (
        <div className="flex flex-col items-start gap-3" data-testid="opportunity-open">
          {corpo}
        </div>
      )}

      <div className="h-px w-full bg-[#e2e8e5] dark:bg-slate-800" />

      <div className="flex items-center justify-between gap-3" data-testid="opportunity-footer">
        {precoRodape ? (
          <div className="min-w-0">
            <p className="text-base font-semibold leading-snug text-slate-900 dark:text-white">{precoRodape.valor}</p>
            {precoRodape.modo ? (
              <p className="text-xs text-slate-500">{precoRodape.modo}</p>
            ) : null}
          </div>
        ) : <span className="min-w-0" />}
        {onCta ? (
          <button
            type="button"
            className={ctaClass}
            disabled={desligado}
            onClick={onCta}
          >
            {rotulo}
          </button>
        ) : null}
      </div>
    </article>
  );
}

export default OpportunityCard;
