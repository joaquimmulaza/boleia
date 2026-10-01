import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageShell from '../components/PageShell';
import PageHeader from '../components/PageHeader';
import LoadingSkeleton from '../components/LoadingSkeleton';
import FeedbackAlert from '../components/FeedbackAlert';
import { Button } from '../components/ui/button';
import AcordoPrecoBadge from '../components/precoProximoMes/AcordoPrecoBadge';
import AcordoPrecoValorInput from '../components/precoProximoMes/AcordoPrecoValorInput';
import AcordoPrecoPreviewCard from '../components/precoProximoMes/AcordoPrecoPreviewCard';
import { useAcordoPrecoContext } from '../hooks/useAcordoPrecoContext';
import { renegotiateAgreementPricing } from '../services/AgreementService';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import {
  copyBadgeJanelaAberta,
  formatEffectiveFromLongPt,
  labelMesActualPt,
} from '../utils/precoProximoMes.js';
import { firstDayNextMonthLuanda } from '../utils/adendaEffectiveFrom.js';
import { formatMesAdendaPt } from '../utils/adendaStatus.js';

/**
 * Criar proposta de preço para o próximo mês (Figma 9:93).
 */
export default function AcordoPrecoNovo() {
  const { acordoId } = useParams();
  const navigate = useNavigate();
  const ctx = useAcordoPrecoContext(acordoId);
  const [valor, setValor] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  const mesActualLabel = ctx.mesActualLabel || labelMesActualPt();
  const effectiveFrom = ctx.effectiveFrom || firstDayNextMonthLuanda();
  const mesFuturo = formatMesAdendaPt(effectiveFrom).split(' de ')[0] || 'próximo mês';
  const mesFuturoCap = mesFuturo.charAt(0).toUpperCase() + mesFuturo.slice(1);

  const valorNum = Number.parseInt(String(valor), 10);
  const valorValido = Number.isInteger(valorNum) && valorNum >= 1;
  const modoPreco = ctx.acordo?.modo_preco || 'POR_PASSAGEIRO';
  const nContrato = ctx.acordo?.n_passageiros_contrato || 1;

  const valorAsk = useMemo(() => {
    if (!valorValido) return null;
    if (modoPreco === 'TOTAL_ACORDO') return valorNum;
    return valorNum;
  }, [valorValido, valorNum, modoPreco]);

  const handleSubmit = async () => {
    if (!acordoId || !valorValido || busy) return;
    setBusy(true);
    setFeedback('');
    try {
      await renegotiateAgreementPricing(acordoId, {
        modo_preco: modoPreco,
        valor_ask_kz: valorAsk,
        n_passageiros: nContrato,
      });
      navigate(`/acordos/${acordoId}/preco/proposta`, { replace: true });
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
        <PageHeader title="Novo preço" onBack={() => navigate('/acordos')} />
        <FeedbackAlert type="error" text={ctx.error || 'Acordo não encontrado.'} />
      </PageShell>
    );
  }

  if (!ctx.janelaAberta) {
    return (
      <PageShell>
        <PageHeader title="Novo preço" onBack={() => navigate('/acordos')} />
        <FeedbackAlert
          type="error"
          text="A janela para mudar o preço do próximo mês está fechada."
        />
      </PageShell>
    );
  }

  return (
    <PageShell className="flex flex-col min-h-0">
      <PageHeader title="Novo preço" onBack={() => navigate('/acordos')} />

      <div className="flex flex-col gap-4 flex-1">
        <AcordoPrecoBadge tone="amber">{copyBadgeJanelaAberta(mesActualLabel)}</AcordoPrecoBadge>

        <p className="text-sm text-slate-700 dark:text-slate-300 text-pretty">
          Propõe o valor do lugar para {mesFuturoCap}. {mesActualLabel} continua a{' '}
          {ctx.precoActual.toLocaleString('pt-PT')} Kz.
        </p>

        <AcordoPrecoValorInput
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          precoActual={ctx.precoActual}
          disabled={busy}
          error={valor && !valorValido ? 'Indica um valor maior que 0 Kz' : ''}
        />

        <AcordoPrecoPreviewCard
          effectiveFrom={effectiveFrom}
          valorKz={valorValido ? valorNum : null}
          mesActualLabel={mesActualLabel}
          precoActual={ctx.precoActual}
          invalid={Boolean(valor) && !valorValido}
        />

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5">
          <p className="text-[13px] text-slate-700 dark:text-slate-300 text-pretty">
            {ctx.contraparteLabel} vai receber a proposta. Se aceitar, o novo preço começa no{' '}
            {formatEffectiveFromLongPt(effectiveFrom).replace('A partir de ', 'dia ')}. Podes
            retirar a proposta enquanto {ctx.isMotorista ? 'não responder' : 'não responder'}.
          </p>
        </div>

        {feedback ? <FeedbackAlert type="error" text={feedback} className="mb-0" /> : null}

        <div className="mt-auto space-y-2 pt-4">
          <Button
            type="button"
            className="w-full min-h-11 rounded-xl"
            disabled={!valorValido || busy}
            onClick={handleSubmit}
            data-testid="preco-enviar-proposta-cta"
          >
            Enviar proposta
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
