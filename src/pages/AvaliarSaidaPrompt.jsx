import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import PageShell from '../components/PageShell';
import PageHeader from '../components/PageHeader';
import LoadingSkeleton from '../components/LoadingSkeleton';
import FeedbackAlert from '../components/FeedbackAlert';
import { Button } from '../components/ui/button';
import { useAcordoRatingContext } from '../hooks/useAcordoRatingContext';
import { useAuth } from '../contexts/AuthContext';
import { buildSaidaRatingPrompt } from '../utils/ratingGates';
import { leavePassenger } from '../services/AgreementService';
import { getFriendlyErrorMessage } from '../utils/errorHandler';

/**
 * Prompt M2 no fluxo de saída — sem labels M1/M2 na copy (Figma 4:48).
 */
export default function AvaliarSaidaPrompt() {
  const { acordoId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const ctx = useAcordoRatingContext(acordoId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const autoLeaveRef = useRef(false);

  const prompt = useMemo(() => {
    if (!ctx.acordo || !ctx.minhaLinha || !user?.id) return null;
    return buildSaidaRatingPrompt({
      acordoId: ctx.acordo.id,
      acordoPassageiroId: ctx.minhaLinha.id,
      passageiroEstado: ctx.minhaLinha.estado || 'activo',
      pagamentos: ctx.pagamentos.map((p) => ({
        ...p,
        acordo_passageiro_id: p.acordo_passageiro_id || ctx.minhaLinha.id,
      })),
      avaliacoes: ctx.avaliacoes,
      now: new Date(),
      avaliadorId: user.id,
    });
  }, [ctx.acordo, ctx.minhaLinha, ctx.pagamentos, ctx.avaliacoes, user?.id]);

  const sairSemAvaliar = useCallback(async () => {
    if (!ctx.acordo || !user?.id || busy) return;
    setBusy(true);
    setError('');
    try {
      await leavePassenger(ctx.acordo.id, user.id);
      navigate('/acordos', { replace: true, state: { message: 'Saíste do acordo.' } });
    } catch (err) {
      setError(err?.message || getFriendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [ctx.acordo, user?.id, busy, navigate]);

  useEffect(() => {
    if (ctx.loading || autoLeaveRef.current) return;
    if (!ctx.error && ctx.acordo && ctx.minhaLinha && (!prompt || prompt.estado !== 'pendente')) {
      autoLeaveRef.current = true;
      void sairSemAvaliar();
    }
  }, [ctx.loading, ctx.error, ctx.acordo, ctx.minhaLinha, prompt, sairSemAvaliar]);

  if (ctx.loading) {
    return (
      <PageShell>
        <LoadingSkeleton />
      </PageShell>
    );
  }

  if (ctx.error || !ctx.acordo || !ctx.minhaLinha) {
    return (
      <PageShell>
        <PageHeader title="Sair do acordo" onBack={() => navigate('/acordos')} />
        <FeedbackAlert type="error" text={ctx.error || 'Acordo indisponível.'} />
      </PageShell>
    );
  }

  if (!prompt || prompt.estado !== 'pendente') {
    return (
      <PageShell>
        <LoadingSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell className="flex flex-col min-h-[70dvh]">
      <PageHeader title="Sair do acordo" onBack={() => navigate('/acordos')} />
      {error ? <FeedbackAlert type="error" text={error} className="mb-4" /> : null}

      <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
        <div
          className="size-20 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mb-6"
          aria-hidden="true"
        >
          <LogOut size={40} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3 text-balance">
          Vais sair deste acordo
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 text-pretty max-w-sm mb-2">
          Antes de saíres, podes avaliar o período em curso.
        </p>
        <p className="text-xs text-slate-500 text-pretty max-w-sm">
          Esta avaliação é independente da janela após o 1.º mês pago.
        </p>
      </div>

      <div className="space-y-3 pt-6">
        <Button
          type="button"
          className="w-full h-12 rounded-xl font-bold"
          disabled={busy}
          onClick={() => navigate(`/acordos/${acordoId}/avaliar?momento=saida&afterLeave=1`)}
          data-testid="avaliar-antes-sair"
        >
          Avaliar antes de sair
        </Button>
        <button
          type="button"
          className="w-full text-center text-sm font-semibold text-slate-500 py-2"
          disabled={busy}
          onClick={() => void sairSemAvaliar()}
          data-testid="sair-sem-avaliar"
        >
          Sair sem avaliar
        </button>
      </div>
    </PageShell>
  );
}
