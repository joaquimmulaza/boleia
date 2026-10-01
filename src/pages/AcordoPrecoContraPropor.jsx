import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageShell from '../components/PageShell';
import PageHeader from '../components/PageHeader';
import LoadingSkeleton from '../components/LoadingSkeleton';
import FeedbackAlert from '../components/FeedbackAlert';
import { Button } from '../components/ui/button';
import AcordoPrecoBadge from '../components/precoProximoMes/AcordoPrecoBadge';
import AcordoPrecoValorInput from '../components/precoProximoMes/AcordoPrecoValorInput';
import AcordoPrecoPreviewCard from '../components/precoProximoMes/AcordoPrecoPreviewCard';
import AcordoPrecoComparacaoCard from '../components/precoProximoMes/AcordoPrecoComparacaoCard';
import { useAcordoPrecoContext } from '../hooks/useAcordoPrecoContext';
import { renegotiateAgreementPricing } from '../services/AgreementService';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import { copyBadgeJanelaAberta, labelMesActualPt } from '../utils/precoProximoMes.js';
import { podeContraPropor } from '../utils/adendaNegociacao.js';

/**
 * Contra-propor valor (Figma 9:164).
 */
export default function AcordoPrecoContraPropor() {
  const { acordoId } = useParams();
  const navigate = useNavigate();
  const ctx = useAcordoPrecoContext(acordoId);
  const [valor, setValor] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  const mesActualLabel = ctx.mesActualLabel || labelMesActualPt();
  const negociacao = ctx.negociacao;
  const userId = ctx.user?.id;
  const valorNum = Number.parseInt(String(valor), 10);
  const valorValido = Number.isInteger(valorNum) && valorNum >= 1;
  const modoPreco = ctx.acordo?.modo_preco || 'POR_PASSAGEIRO';
  const nContrato = ctx.acordo?.n_passageiros_contrato || 1;

  const podeContra = negociacao && userId && podeContraPropor(negociacao, {
    userId,
    isMotorista: ctx.isMotorista,
    isPassageiro: ctx.isPassageiro,
    janelaAberta: ctx.janelaAberta,
  });

  const handleSubmit = async () => {
    if (!acordoId || !valorValido || busy || !podeContra) return;
    setBusy(true);
    setFeedback('');
    try {
      await renegotiateAgreementPricing(acordoId, {
        modo_preco: modoPreco,
        valor_ask_kz: valorNum,
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

  if (ctx.error || !ctx.acordo || !negociacao) {
    return (
      <PageShell>
        <PageHeader title="Contra-propor" onBack={() => navigate('/acordos')} />
        <FeedbackAlert type="error" text={ctx.error || 'Proposta não encontrada.'} />
      </PageShell>
    );
  }

  if (!podeContra) {
    return (
      <PageShell>
        <PageHeader title="Contra-propor" onBack={() => navigate(`/acordos/${acordoId}/preco/proposta`)} />
        <FeedbackAlert type="error" text="Não podes contra-propor neste momento." />
      </PageShell>
    );
  }

  const precoPropostoActual = negociacao.valor_mensal_por_passageiro_kz ?? 0;

  return (
    <PageShell className="flex flex-col min-h-0">
      <PageHeader
        title="Contra-propor"
        onBack={() => navigate(`/acordos/${acordoId}/preco/proposta`)}
      />

      <div className="flex flex-col gap-4 flex-1">
        <AcordoPrecoBadge tone="amber">{copyBadgeJanelaAberta(mesActualLabel)}</AcordoPrecoBadge>

        <p className="text-sm text-slate-700 dark:text-slate-300 text-pretty">
          Propõe um valor alternativo para o próximo mês. A proposta anterior fica substituída.
        </p>

        <AcordoPrecoComparacaoCard
          precoActual={ctx.precoActual}
          precoProposto={precoPropostoActual}
          effectiveFrom={negociacao.effective_from || ctx.effectiveFrom}
          mesActualLabel={mesActualLabel}
        />

        <AcordoPrecoValorInput
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          precoActual={ctx.precoActual}
          disabled={busy}
          error={valor && !valorValido ? 'Indica um valor maior que 0 Kz' : ''}
        />

        <AcordoPrecoPreviewCard
          effectiveFrom={negociacao.effective_from || ctx.effectiveFrom}
          valorKz={valorValido ? valorNum : null}
          mesActualLabel={mesActualLabel}
          precoActual={ctx.precoActual}
          invalid={Boolean(valor) && !valorValido}
        />

        {feedback ? <FeedbackAlert type="error" text={feedback} className="mb-0" /> : null}

        <div className="mt-auto space-y-2 pt-4">
          <Button
            type="button"
            className="w-full min-h-11 rounded-xl"
            disabled={!valorValido || busy}
            onClick={handleSubmit}
            data-testid="preco-enviar-contra-proposta-cta"
          >
            Enviar contra-proposta
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full min-h-11 rounded-xl text-slate-500"
            disabled={busy}
            onClick={() => navigate(`/acordos/${acordoId}/preco/proposta`)}
          >
            Cancelar
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
