import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageShell from '../components/PageShell';
import PageHeader from '../components/PageHeader';
import LoadingSkeleton from '../components/LoadingSkeleton';
import FeedbackAlert from '../components/FeedbackAlert';
import { Button } from '../components/ui/button';
import AcordoPrecoBadge from '../components/precoProximoMes/AcordoPrecoBadge';
import { useAcordoPrecoContext } from '../hooks/useAcordoPrecoContext';
import { declineAgreementRenewal } from '../services/AgreementService';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import { formatKwanza } from '../utils/formatKwanza.js';
import { labelMesActualPt } from '../utils/precoProximoMes.js';

/**
 * Confirmar não renovação (Figma 11:3) — separado de recusar preço.
 */
export default function AcordoNaoRenovar() {
  const { acordoId } = useParams();
  const navigate = useNavigate();
  const ctx = useAcordoPrecoContext(acordoId);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  const mesActualLabel = ctx.mesActualLabel || labelMesActualPt();

  const handleConfirm = async () => {
    if (!acordoId || busy) return;
    setBusy(true);
    setFeedback('');
    try {
      await declineAgreementRenewal(acordoId);
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
        <PageHeader title="Não renovar" onBack={() => navigate('/acordos')} />
        <FeedbackAlert type="error" text={ctx.error || 'Acordo não encontrado.'} />
      </PageShell>
    );
  }

  return (
    <PageShell className="flex flex-col min-h-0">
      <PageHeader title="Não renovar" onBack={() => navigate('/acordos')} />

      <div className="flex flex-col gap-3.5 flex-1" data-testid="nao-renovar-page">
        <AcordoPrecoBadge tone="grey">Termina no fim deste ciclo</AcordoPrecoBadge>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-2">
          <p className="text-base font-bold text-slate-900 dark:text-white text-balance">
            Não renovar o acordo?
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300 text-pretty">
            O acordo com {ctx.contraparteLabel} ({ctx.rotaLabel}) termina no fim de {mesActualLabel}.
            Até lá, mantém {formatKwanza(ctx.precoActual)} Kz / mês.
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3.5">
          <p className="text-[13px] text-slate-600 dark:text-slate-300 text-pretty">
            Isto é independente de recusares uma proposta de preço. Podes continuar no acordo até ao
            fim do mês actual.
          </p>
        </div>

        {feedback ? <FeedbackAlert type="error" text={feedback} className="mb-0" /> : null}

        <div className="mt-auto space-y-2 pt-4">
          <Button
            type="button"
            variant="outline"
            className="w-full min-h-11 rounded-xl border-red-200 text-red-800 hover:bg-red-50"
            disabled={busy}
            onClick={handleConfirm}
            data-testid="confirmar-nao-renovar-cta"
          >
            Confirmar não renovar
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
