import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import AcordoPrecoBadge from './AcordoPrecoBadge';
import { formatKwanza } from '../../utils/formatKwanza.js';
import {
  copyBadgeJanelaAberta,
  copyBadgeJanelaFechada,
  formatEffectiveFromLongPt,
  labelMesActualPt,
} from '../../utils/precoProximoMes.js';
import {
  isAdendaAguardandoResposta,
  isAdendaRecusadaValida,
  labelChipHistoricoAdenda,
} from '../../utils/adendaNegociacao.js';
import { firstDayNextMonthLuanda } from '../../utils/adendaEffectiveFrom.js';

/**
 * Secção «Próximo mês» + histórico compacto (Figma frame 1 / 8).
 * @param {{
 *   acordoId: string,
 *   precoActual: number,
 *   negociacao: object | null,
 *   historico: object[],
 *   janelaAberta: boolean,
 *   mesActualLabel?: string,
 *   podePropor: boolean,
 * }} props
 */
export default function AcordoPrecoProximoMesPanel({
  acordoId,
  precoActual,
  negociacao,
  historico,
  janelaAberta,
  mesActualLabel = labelMesActualPt(),
  podePropor,
}) {
  const navigate = useNavigate();
  const effectiveFrom = negociacao?.effective_from || firstDayNextMonthLuanda();
  const temNegociacao = Boolean(negociacao);
  const aguardando = temNegociacao && isAdendaAguardandoResposta(negociacao?.estado);
  const recusadaValida = isAdendaRecusadaValida(negociacao, janelaAberta);
  const aceiteAgendada = temNegociacao
    && ['aceite', 'aceite_agendada'].includes(String(negociacao?.estado || '').toLowerCase());

  const irProposta = () => navigate(`/acordos/${acordoId}/preco/proposta`);
  const irNovo = () => navigate(`/acordos/${acordoId}/preco/novo`);
  const irHistorico = () => navigate(`/acordos/${acordoId}/preco/historico`);

  return (
    <section className="space-y-3" data-testid="preco-proximo-mes-panel">
      {janelaAberta ? (
        <AcordoPrecoBadge tone="amber">{copyBadgeJanelaAberta(mesActualLabel)}</AcordoPrecoBadge>
      ) : (
        <AcordoPrecoBadge tone="grey">{copyBadgeJanelaFechada()}</AcordoPrecoBadge>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-2.5">
        <p className="text-xs font-semibold text-slate-500">Próximo mês</p>

        {janelaAberta ? (
          <p className="text-sm text-slate-700 dark:text-slate-300 text-pretty">
            O preço de {mesActualLabel} ({formatKwanza(precoActual)} Kz) não muda. Podes propor um
            valor novo só {formatEffectiveFromLongPt(effectiveFrom).replace('A partir de ', 'a partir de ')}.
          </p>
        ) : (
          <>
            <p className="text-[15px] font-semibold text-slate-900 dark:text-white">
              Já não podes propor um novo preço
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300 text-pretty">
              A janela para mudar o preço do próximo mês fechou. {mesActualLabel} mantém{' '}
              {formatKwanza(precoActual)} Kz. Podes renovar ou não renovar com o preço actual.
            </p>
          </>
        )}

        {aceiteAgendada ? (
          <Button
            type="button"
            variant="outline"
            className="w-full min-h-11 rounded-xl border-emerald-200 text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
            onClick={irProposta}
            data-testid="preco-ver-confirmado-cta"
          >
            Ver preço confirmado
          </Button>
        ) : null}

        {!aceiteAgendada && aguardando ? (
          <Button
            type="button"
            variant="outline"
            className="w-full min-h-11 rounded-xl border-amber-200 text-amber-900 bg-amber-50 hover:bg-amber-100"
            onClick={irProposta}
            data-testid="preco-ver-proposta-cta"
          >
            Ver proposta
          </Button>
        ) : null}

        {!aceiteAgendada && recusadaValida ? (
          <Button
            type="button"
            variant="outline"
            className="w-full min-h-11 rounded-xl"
            onClick={irProposta}
            data-testid="preco-proposta-recusada-cta"
          >
            Ver proposta recusada
          </Button>
        ) : null}

        {janelaAberta && podePropor && !temNegociacao ? (
          <Button
            type="button"
            className="w-full min-h-11 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-100"
            onClick={irNovo}
            data-testid="mudar-preco-proximo-mes-cta"
          >
            Mudar o preço no próximo mês
          </Button>
        ) : null}

        {!janelaAberta ? (
          <div
            className="w-full min-h-11 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-semibold text-slate-600 dark:text-slate-300"
            data-testid="preco-propostas-fechadas"
          >
            Propostas fechadas
          </div>
        ) : null}
      </div>

      <div
        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 space-y-2"
        data-testid="preco-historico-resumo"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Histórico de propostas</p>
          <button
            type="button"
            onClick={irHistorico}
            className="text-xs font-medium text-primary"
            data-testid="preco-historico-ver-tudo"
          >
            Ver tudo →
          </button>
        </div>
        {historico.length === 0 ? (
          <p className="text-xs text-slate-500">Ainda não há propostas de preço neste acordo.</p>
        ) : (
          <p className="text-xs text-slate-500">
            Última: {labelChipHistoricoAdenda(historico[0])}
            {historico[0]?.valor_mensal_por_passageiro_kz != null
              ? ` · ${formatKwanza(historico[0].valor_mensal_por_passageiro_kz)} Kz`
              : ''}
          </p>
        )}
      </div>
    </section>
  );
}
