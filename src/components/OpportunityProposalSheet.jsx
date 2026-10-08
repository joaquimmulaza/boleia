import React, { useState } from 'react';
import OverlayShell from './OverlayShell';
import SheetDragHandle from './SheetDragHandle';
import RouteIndicator from './RouteIndicator';
import PropostaValorInput from './PropostaValorInput';
import { resolveOpportunityProposal } from '../utils/opportunityProposal';
import { formatKwanza } from '../utils/formatKwanza';
import { parseValorPropostaKz, validarValorPropostaKz } from '../utils/propostaValor';

const placeNameClass = 'min-w-0 break-words whitespace-normal text-lg font-semibold leading-6 text-slate-900 dark:text-white';

const ctaClass = 'w-full rounded-xl bg-primary px-4 py-3 text-[15px] font-medium text-[#06130b]';

/**
 * Proposta a partir de uma oportunidade.
 * Motorista: N é snapshot e a frase fica visível.
 * Passageiro por pessoa: stepper, sem essa frase.
 * Passageiro com total do acordo: um preço, sem stepper.
 * @param {{
 *   papel: 'motorista' | 'passageiro',
 *   alvo?: 'grupo' | 'passageiro',
 *   item: object,
 *   nProposto: number,
 *   valorKz?: number | null,
 *   modoPreco?: string | null,
 *   erro?: string,
 *   valorEditavel?: boolean,
 *   disabled?: boolean,
 *   onClose: () => void,
 *   onSubmit?: (n: number, valorMensalKz?: number) => void,
 * }} props
 */
function OpportunityProposalSheet({
  papel,
  alvo = 'passageiro',
  item,
  nProposto,
  valorKz,
  modoPreco,
  erro = '',
  valorEditavel = false,
  disabled = false,
  onClose,
  onSubmit,
}) {
  const [nLocal, setNLocal] = useState(() => nProposto);
  const [valorLocal, setValorLocal] = useState(() => String(valorKz ?? ''));
  const [erroValor, setErroValor] = useState('');
  const sheet = resolveOpportunityProposal({
    papel,
    alvo,
    item,
    nProposto: papel === 'passageiro' ? nLocal : nProposto,
    valorKz,
    modoPreco,
  });

  const mostrarValorEditavel = valorEditavel && papel === 'passageiro';
  const valorUnitario = parseValorPropostaKz(valorLocal);
  const totalEstimado = sheet.stepper && Number.isFinite(valorUnitario) && valorUnitario > 0
    ? valorUnitario * sheet.n
    : null;

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
          if (mostrarValorEditavel) {
            const valorCheck = validarValorPropostaKz(parseValorPropostaKz(valorLocal));
            if (!valorCheck.ok) {
              setErroValor(valorCheck.erro);
              return;
            }
            setErroValor('');
            onSubmit?.(sheet.n, valorCheck.valor);
            return;
          }
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

        {sheet.nome && sheet.rota ? (
          <div className="flex items-stretch gap-3">
            <RouteIndicator />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <p className={placeNameClass} data-testid="opportunity-place-name">{sheet.nome}</p>
              <p className={placeNameClass} data-testid="opportunity-place-name">{sheet.rota.origem}</p>
              <p className={placeNameClass} data-testid="opportunity-place-name">{sheet.rota.destino}</p>
            </div>
          </div>
        ) : null}

        {sheet.nome && !sheet.rota ? (
          <p className={placeNameClass} data-testid="opportunity-place-name">{sheet.nome}</p>
        ) : null}

        {!sheet.nome && sheet.rota ? (
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
        ) : sheet.contagem ? (
          <p className="text-[15px] font-medium text-slate-900 dark:text-white">{sheet.contagem}</p>
        ) : null}

        {sheet.snapshotNote ? (
          <p className="text-xs leading-4 text-slate-500">{sheet.snapshotNote}</p>
        ) : null}

        <div className="h-px w-full bg-[#e2e8e5] dark:bg-slate-800" />

        {mostrarValorEditavel ? (
          <>
            <PropostaValorInput
              modoPreco={modoPreco}
              value={valorLocal}
              askKz={valorKz}
              disabled={disabled}
              onChange={(event) => {
                setErroValor('');
                setValorLocal(event.target.value);
              }}
            />
            {totalEstimado != null ? (
              <div className="flex items-center justify-between gap-3 text-[15px] leading-5">
                <span className="text-slate-500">Total estimado</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {formatKwanza(totalEstimado)} Kz
                </span>
              </div>
            ) : null}
          </>
        ) : (
          <>
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
          </>
        )}

        {erroValor ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">{erroValor}</p>
        ) : null}

        {erro ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">{erro}</p>
        ) : null}

        <button type="submit" className={ctaClass} disabled={disabled}>
          {sheet.cta}
        </button>
      </form>
    </OverlayShell>
  );
}

export default OpportunityProposalSheet;
