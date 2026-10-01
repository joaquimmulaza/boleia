import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageShell from '../components/PageShell';
import PageHeader from '../components/PageHeader';
import LoadingSkeleton from '../components/LoadingSkeleton';
import FeedbackAlert from '../components/FeedbackAlert';
import ConfirmationModal from '../components/ConfirmationModal';
import { Button } from '../components/ui/button';
import AcordoPrecoBadge from '../components/precoProximoMes/AcordoPrecoBadge';
import AcordoPrecoProponenteCard from '../components/precoProximoMes/AcordoPrecoProponenteCard';
import AcordoPrecoComparacaoCard from '../components/precoProximoMes/AcordoPrecoComparacaoCard';
import { useAcordoPrecoContext } from '../hooks/useAcordoPrecoContext';
import {
  acceptAgreementAdenda,
  cancelAgreementAdenda,
  rejectAgreementAdenda,
} from '../services/AgreementService';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import {
  formatEffectiveFromLongPt,
  labelMesActualPt,
} from '../utils/precoProximoMes.js';
import {
  isAdendaAguardandoResposta,
  isAdendaRecusadaValida,
  isContraparteAdenda,
  podeContraPropor,
  podeRetirarProposta,
  podeVoltarAAceitar,
  souProponenteAdenda,
} from '../utils/adendaNegociacao.js';
import { formatMesAdendaPt } from '../utils/adendaStatus.js';
import { formatKwanza } from '../utils/formatKwanza.js';

/**
 * Ver/responder proposta de preço (Figma 12:2, 9:125, 9:197, 9:221, 9:245).
 */
export default function AcordoPrecoProposta() {
  const { acordoId } = useParams();
  const navigate = useNavigate();
  const ctx = useAcordoPrecoContext(acordoId);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [confirmRecusar, setConfirmRecusar] = useState(false);
  const [confirmRetirar, setConfirmRetirar] = useState(false);

  const negociacao = ctx.negociacao;
  const mesActualLabel = ctx.mesActualLabel || labelMesActualPt();
  const userId = ctx.user?.id;

  const view = useMemo(() => {
    if (!negociacao || !userId) return 'empty';
    const estado = String(negociacao.estado || '').toLowerCase();
    const ctxAdenda = {
      isMotorista: ctx.isMotorista,
      isPassageiro: ctx.isPassageiro,
      janelaAberta: ctx.janelaAberta,
      userId,
    };

    if (estado === 'aceite' || estado === 'aceite_agendada') return 'confirmado';
    if (isAdendaRecusadaValida(negociacao, ctx.janelaAberta)) {
      if (podeVoltarAAceitar(negociacao, ctxAdenda)) return 'recusada_contraparte';
      if (souProponenteAdenda(negociacao, userId)) return 'recusada_proponente';
      return 'recusada';
    }
    if (isAdendaAguardandoResposta(estado)) {
      if (souProponenteAdenda(negociacao, userId)) return 'enviada';
      if (isContraparteAdenda(negociacao, ctxAdenda)) return 'receber';
    }
    return 'empty';
  }, [negociacao, userId, ctx.isMotorista, ctx.isPassageiro, ctx.janelaAberta]);

  const proponenteNome = useMemo(() => {
    if (!negociacao) return ctx.contraparteLabel;
    if (souProponenteAdenda(negociacao, userId)) {
      return ctx.isMotorista ? 'Tu' : 'Tu';
    }
    return ctx.contraparteLabel;
  }, [negociacao, userId, ctx.contraparteLabel, ctx.isMotorista]);

  const proponentePapel = useMemo(() => {
    if (!negociacao?.created_by || !ctx.acordo) return ctx.isMotorista ? 'Motorista' : 'Passageiro';
    if (negociacao.created_by === ctx.acordo.driver_id) return 'Motorista';
    return 'Passageiro';
  }, [negociacao, ctx.acordo, ctx.isMotorista]);

  const precoProposto = negociacao?.valor_mensal_por_passageiro_kz ?? 0;

  const handleAceitar = async () => {
    if (!negociacao?.id || busy) return;
    setBusy(true);
    setFeedback('');
    try {
      await acceptAgreementAdenda(negociacao.id);
      await ctx.reload();
      setFeedback('');
    } catch (err) {
      setFeedback(err?.message || getFriendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRecusar = async () => {
    if (!negociacao?.id || busy) return;
    setBusy(true);
    setFeedback('');
    try {
      await rejectAgreementAdenda(negociacao.id);
      setConfirmRecusar(false);
      await ctx.reload();
    } catch (err) {
      setFeedback(err?.message || getFriendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRetirar = async () => {
    if (!negociacao?.id || busy) return;
    setBusy(true);
    setFeedback('');
    try {
      await cancelAgreementAdenda(negociacao.id);
      setConfirmRetirar(false);
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
        <PageHeader title="Proposta de preço" onBack={() => navigate('/acordos')} />
        <FeedbackAlert type="error" text={ctx.error || 'Acordo não encontrado.'} />
      </PageShell>
    );
  }

  if (view === 'empty') {
    return (
      <PageShell>
        <PageHeader title="Proposta de preço" onBack={() => navigate('/acordos')} />
        <FeedbackAlert type="error" text="Não há proposta de preço activa neste acordo." />
        <Button type="button" variant="outline" className="w-full mt-4" onClick={() => navigate('/acordos')}>
          Voltar aos acordos
        </Button>
      </PageShell>
    );
  }

  const badge = (() => {
    if (view === 'confirmado') {
      return <AcordoPrecoBadge tone="green">Preço confirmado</AcordoPrecoBadge>;
    }
    if (view === 'enviada') {
      return <AcordoPrecoBadge tone="amber">À espera de resposta</AcordoPrecoBadge>;
    }
    if (view === 'receber') {
      return <AcordoPrecoBadge tone="amber">À espera da tua resposta</AcordoPrecoBadge>;
    }
    if (view.startsWith('recusada')) {
      return <AcordoPrecoBadge tone="red">Proposta recusada</AcordoPrecoBadge>;
    }
    return null;
  })();

  const titulo = view === 'confirmado' ? 'Preço confirmado' : 'Proposta de preço';

  return (
    <PageShell className="flex flex-col min-h-0">
      <PageHeader title={titulo} onBack={() => navigate('/acordos')} />

      <div className="flex flex-col gap-3.5 flex-1" data-testid={`preco-proposta-view-${view}`}>
        {badge}

        {view !== 'confirmado' && view !== 'enviada' ? (
          <AcordoPrecoProponenteCard
            nome={proponenteNome === 'Tu' ? (ctx.isMotorista ? 'Tu' : 'Tu') : proponenteNome}
            papel={proponentePapel}
            subtitulo={
              view.startsWith('recusada') ? 'Proposta recusada' : 'Propôs um novo preço'
            }
          />
        ) : null}

        {view === 'enviada' ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Proposta enviada
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300 text-pretty">
              {ctx.contraparteLabel} ainda não respondeu. Podes retirar a proposta enquanto a
              janela estiver aberta.
            </p>
          </div>
        ) : null}

        <AcordoPrecoComparacaoCard
          precoActual={ctx.precoActual}
          precoProposto={precoProposto}
          effectiveFrom={negociacao?.effective_from || ctx.effectiveFrom}
          mesActualLabel={mesActualLabel}
        />

        {view === 'confirmado' ? (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-1">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-100">
              {formatEffectiveFromLongPt(negociacao?.effective_from)}:{' '}
              {formatKwanza(precoProposto)} Kz
            </p>
            <p className="text-[13px] text-slate-600 dark:text-slate-300">
              {mesActualLabel} mantém {formatKwanza(ctx.precoActual)} Kz. Nada muda neste mês.
            </p>
          </div>
        ) : null}

        {view === 'receber' ? (
          <p className="text-[13px] text-slate-700 dark:text-slate-300 text-pretty">
            Se aceitares, {mesActualLabel} mantém {formatKwanza(ctx.precoActual)} Kz. O novo valor
            só começa a {formatMesAdendaPt(negociacao?.effective_from)}. Recusar a proposta não
            encerra o acordo.
          </p>
        ) : null}

        {view === 'recusada_contraparte' ? (
          <p className="text-[13px] text-slate-700 dark:text-slate-300 text-pretty">
            Recusaste esta proposta. O acordo mantém-se com o preço actual. Podes voltar a aceitar
            enquanto a janela estiver aberta.
          </p>
        ) : null}

        {view === 'recusada_proponente' ? (
          <p className="text-[13px] text-slate-700 dark:text-slate-300 text-pretty">
            {ctx.contraparteLabel} recusou a proposta. O preço de {mesActualLabel} mantém-se.
          </p>
        ) : null}

        {feedback ? <FeedbackAlert type="error" text={feedback} className="mb-0" /> : null}

        <div className="mt-auto space-y-2 pt-4">
          {view === 'receber' ? (
            <>
              <Button
                type="button"
                className="w-full min-h-11 rounded-xl"
                disabled={busy}
                onClick={handleAceitar}
                data-testid="preco-aceitar-cta"
              >
                Aceitar
              </Button>
              {podeContraPropor(negociacao, {
                userId,
                isMotorista: ctx.isMotorista,
                isPassageiro: ctx.isPassageiro,
                janelaAberta: ctx.janelaAberta,
              }) ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full min-h-11 rounded-xl border-emerald-200 text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
                  disabled={busy}
                  onClick={() => navigate(`/acordos/${acordoId}/preco/contra-propor`)}
                  data-testid="preco-contra-propor-cta"
                >
                  Contra-propor
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="w-full min-h-11 rounded-xl border-red-200 text-red-800 hover:bg-red-50"
                disabled={busy}
                onClick={() => setConfirmRecusar(true)}
                data-testid="preco-recusar-cta"
              >
                Recusar
              </Button>
              <p className="text-[11px] text-center text-slate-500">
                Recusar o preço ≠ Não renovar o acordo
              </p>
            </>
          ) : null}

          {view === 'recusada_contraparte' ? (
            <Button
              type="button"
              className="w-full min-h-11 rounded-xl"
              disabled={busy}
              onClick={handleAceitar}
              data-testid="preco-voltar-aceitar-cta"
            >
              Voltar a aceitar
            </Button>
          ) : null}

          {view === 'enviada' && podeRetirarProposta(negociacao, userId) ? (
            <Button
              type="button"
              variant="outline"
              className="w-full min-h-11 rounded-xl"
              disabled={busy}
              onClick={() => setConfirmRetirar(true)}
              data-testid="preco-retirar-cta"
            >
              Retirar proposta
            </Button>
          ) : null}

          {view === 'confirmado' || view.startsWith('recusada') ? (
            <Button
              type="button"
              variant="ghost"
              className="w-full min-h-11 rounded-xl text-slate-500"
              onClick={() => navigate('/acordos')}
            >
              Voltar aos acordos
            </Button>
          ) : null}
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmRecusar}
        busy={busy}
        title="Recusar proposta?"
        message="O acordo mantém-se activo com o preço actual. Podes voltar a aceitar enquanto a janela estiver aberta."
        confirmText="Recusar"
        onConfirm={handleRecusar}
        onCancel={() => {
          if (!busy) setConfirmRecusar(false);
        }}
      />

      <ConfirmationModal
        isOpen={confirmRetirar}
        busy={busy}
        title="Retirar proposta?"
        message="O próximo mês fica com o preço actual. A proposta deixa de estar pendente."
        confirmText="Retirar"
        onConfirm={handleRetirar}
        onCancel={() => {
          if (!busy) setConfirmRetirar(false);
        }}
      />
    </PageShell>
  );
}
