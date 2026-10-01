import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageShell from '../components/PageShell';
import PageHeader from '../components/PageHeader';
import LoadingSkeleton from '../components/LoadingSkeleton';
import FeedbackAlert from '../components/FeedbackAlert';
import { Button } from '../components/ui/button';
import AcordoPrecoBadge from '../components/precoProximoMes/AcordoPrecoBadge';
import { useAcordoPrecoContext } from '../hooks/useAcordoPrecoContext';
import { renewAgreementPeriod } from '../services/AgreementService';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import { formatKwanza } from '../utils/formatKwanza.js';
import { labelMesActualPt } from '../utils/precoProximoMes.js';
import { formatMesAdendaPt } from '../utils/adendaStatus.js';
import { firstDayNextMonthLuanda } from '../utils/adendaEffectiveFrom.js';
import {
  isAdendaAguardandoResposta,
  resolveNegociacaoPrecoAtiva,
} from '../utils/adendaNegociacao.js';

/**
 * Confirmar renovação do acordo (Figma 12:26) — separado de mudar preço.
 */
export default function AcordoRenovar() {
  const { acordoId } = useParams();
  const navigate = useNavigate();
  const ctx = useAcordoPrecoContext(acordoId);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  const mesActualLabel = ctx.mesActualLabel || labelMesActualPt();
  const effectiveFrom = ctx.acordo?.renovacao_proximo_mes || firstDayNextMonthLuanda();
  const mesFuturo = formatMesAdendaPt(effectiveFrom).split(' de ')[0] || 'próximo mês';
  const mesFuturoCap = mesFuturo.charAt(0).toUpperCase() + mesFuturo.slice(1);

  const negociacaoAceite = (() => {
    const n = resolveNegociacaoPrecoAtiva(ctx.acordo?.acordos_adendas) || ctx.negociacao;
    if (!n) return null;
    const e = String(n.estado || '').toLowerCase();
    if (e === 'aceite' || e === 'aceite_agendada') return n;
    return null;
  })();

  const precoRenovacao = negociacaoAceite?.valor_mensal_por_passageiro_kz ?? ctx.precoActual;

  const handleConfirm = async () => {
    if (!acordoId || busy) return;
    setBusy(true);
    setFeedback('');
    try {
      await renewAgreementPeriod(acordoId);
      navigate('/acordos', { replace: true });
    } catch (err) {
      setFeedback(err?.message || getFriendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (ctx.loading) {
    return (
      <PageShell>
        <LoadingSkeleton />
      </PageShell>
    );
  }

  if (ctx.error || !ctx.acordo) {
    return (
      <PageShell>
        <PageHeader title="Renovar" onBack={() => navigate('/acordos')} />
        <FeedbackAlert type="error" text={ctx.error || 'Acordo não encontrado.'} />
      </PageShell>
    );
  }

  const negociacaoPendente = ctx.negociacao && isAdendaAguardandoResposta(ctx.negociacao.estado);

  return (
    <PageShell className="flex flex-col min-h-0">
      <PageHeader title="Renovar" onBack={() => navigate('/acordos')} />

      <div className="flex flex-col gap-3.5 flex-1" data-testid="renovar-page">
        <AcordoPrecoBadge tone="green">Confirma a renovação</AcordoPrecoBadge>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-2">
          <p className="text-base font-bold text-slate-900 dark:text-white text-balance">
            Renovar para {mesFuturoCap} a {formatKwanza(precoRenovacao)} Kz?
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300 text-pretty">
            O acordo com {ctx.contraparteLabel} ({ctx.rotaLabel}) continua em {mesFuturoCap} com
            o preço {negociacaoAceite ? 'combinado' : 'actual'} de {formatKwanza(precoRenovacao)} Kz
            / mês.
          </p>
        </div>

        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-3.5 space-y-1">
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">Preço</p>
          <p className="text-[13px] text-slate-700 dark:text-slate-300 text-pretty">
            {negociacaoAceite
              ? `Há uma proposta aceite para ${mesFuturoCap} a ${formatKwanza(precoRenovacao)} Kz.`
              : `Não há proposta de preço nova aceite. ${mesFuturoCap} fica a ${formatKwanza(precoRenovacao)} Kz (preço actual). Podes mudar o preço noutra altura se a janela estiver aberta.`}
            {negociacaoPendente
              ? ' Existe uma proposta pendente — renovar não a substitui.'
              : ''}
          </p>
        </div>

        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-3.5 space-y-1">
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">Este mês</p>
          <p className="text-[13px] text-slate-700 dark:text-slate-300 text-pretty">
            {mesActualLabel} continua normal a {formatKwanza(ctx.precoActual)} Kz. Nada muda neste
            mês.
          </p>
        </div>

        {feedback ? <FeedbackAlert type="error" text={feedback} className="mb-0" /> : null}

        <div className="mt-auto space-y-2 pt-4">
          <Button
            type="button"
            className="w-full min-h-11 rounded-xl"
            disabled={busy}
            onClick={handleConfirm}
            data-testid="confirmar-renovacao-cta"
          >
            Confirmar renovação
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full min-h-11 rounded-xl text-slate-500"
            disabled={busy}
            onClick={() => navigate('/acordos')}
          >
            Cancelar
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
