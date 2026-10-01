import React, { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageShell from '../components/PageShell';
import PageHeader from '../components/PageHeader';
import LoadingSkeleton from '../components/LoadingSkeleton';
import FeedbackAlert from '../components/FeedbackAlert';
import AvaliarFormFields from '../components/rating/AvaliarFormFields';
import { useAcordoRatingContext, iniciaisNome } from '../hooks/useAcordoRatingContext';
import { useAuth } from '../contexts/AuthContext';
import {
  buildPassageiroRatingPrompt,
  buildSaidaRatingPrompt,
  RATING_MOMENTO,
  formatMesRatingCurto,
} from '../utils/ratingGates';
import { submitAvaliacao } from '../services/RatingService';
import { leavePassenger } from '../services/AgreementService';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import { getAcordoContactos } from '../services/PaymentService';

/**
 * Passageiro avalia motorista (Figma 1:3 / 4:2).
 */
export default function AvaliarMotorista() {
  const { acordoId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const momento = searchParams.get('momento') === 'saida'
    ? RATING_MOMENTO.SAIDA
    : RATING_MOMENTO.PRIMEIRO_PERIODO;
  const afterLeave = searchParams.get('afterLeave') === '1';

  const ctx = useAcordoRatingContext(acordoId);
  const [estrelas, setEstrelas] = useState(0);
  const [comentario, setComentario] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [driverNome, setDriverNome] = useState(ctx.driverNome);

  React.useEffect(() => {
    if (!acordoId) return;
    getAcordoContactos(acordoId)
      .then((c) => {
        if (c?.motorista?.nome_completo) setDriverNome(c.motorista.nome_completo);
      })
      .catch(() => {});
  }, [acordoId]);

  const prompt = useMemo(() => {
    if (!ctx.acordo || !ctx.minhaLinha || !user?.id) return null;
    const base = {
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
    };
    if (momento === RATING_MOMENTO.SAIDA) {
      return buildSaidaRatingPrompt(base);
    }
    return buildPassageiroRatingPrompt({ ...base, driverNome });
  }, [ctx, user?.id, momento, driverNome]);

  const mesLabel = useMemo(() => {
    const mes = ctx.pagamentos.find((p) => p.mes_referencia)?.mes_referencia;
    return mes ? formatMesRatingCurto(mes) : '';
  }, [ctx.pagamentos]);

  const handleSubmit = async () => {
    if (!ctx.acordo || !ctx.minhaLinha || estrelas < 1) return;
    setBusy(true);
    setFeedback('');
    try {
      await submitAvaliacao({
        acordoId: ctx.acordo.id,
        acordoPassageiroId: ctx.minhaLinha.id,
        momento,
        estrelas,
        comentario: comentario.trim() || null,
      });
      if (afterLeave && user?.id) {
        await leavePassenger(ctx.acordo.id, user.id);
        navigate('/acordos', { replace: true, state: { message: 'Saíste do acordo.' } });
        return;
      }
      navigate(`/acordos/${ctx.acordo.id}/avaliar/sucesso`, { replace: true });
    } catch (err) {
      const msg = err?.message || getFriendlyErrorMessage(err);
      if (/expirou/i.test(msg)) {
        navigate(`/acordos/${ctx.acordo.id}/avaliar/expirado`, { replace: true });
        return;
      }
      setFeedback(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = () => {
    navigate('/acordos', { replace: true });
  };

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
        <PageHeader title="Avaliar" onBack={() => navigate('/acordos')} />
        <FeedbackAlert type="error" text={ctx.error || 'Acordo indisponível.'} />
      </PageShell>
    );
  }

  if (prompt?.estado === 'expirado') {
    navigate(`/acordos/${ctx.acordo.id}/avaliar/expirado`, { replace: true });
    return null;
  }

  if (!prompt || prompt.estado === 'feito') {
    navigate(`/acordos/${ctx.acordo.id}/avaliar/sucesso`, { replace: true });
    return null;
  }

  return (
    <PageShell>
      <PageHeader title="Avaliar" onBack={() => navigate('/acordos')} />
      {feedback ? <FeedbackAlert type="error" text={feedback} className="mb-4" /> : null}
      <AvaliarFormFields
        estrelas={estrelas}
        onEstrelasChange={setEstrelas}
        comentario={comentario}
        onComentarioChange={setComentario}
        onSubmit={handleSubmit}
        onSkip={handleSkip}
        busy={busy}
        contraparteLabel={driverNome}
        rotaLabel={ctx.rotaLabel}
        periodoLabel={mesLabel}
        badgeLabel={momento === RATING_MOMENTO.PRIMEIRO_PERIODO ? '1.º mês pago' : undefined}
        iniciais={iniciaisNome(driverNome)}
      />
    </PageShell>
  );
}
