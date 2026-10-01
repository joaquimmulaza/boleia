import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageShell from '../components/PageShell';
import PageHeader from '../components/PageHeader';
import LoadingSkeleton from '../components/LoadingSkeleton';
import FeedbackAlert from '../components/FeedbackAlert';
import AvaliarFormFields from '../components/rating/AvaliarFormFields';
import { useAcordoRatingContext, iniciaisNome } from '../hooks/useAcordoRatingContext';
import { useAuth } from '../contexts/AuthContext';
import {
  buildMotoristaRatingPrompts,
  RATING_MOMENTO,
} from '../utils/ratingGates';
import { submitAvaliacao } from '../services/RatingService';
import { getFriendlyErrorMessage } from '../utils/errorHandler';

/**
 * Motorista avalia um passageiro (Figma 1:7).
 */
export default function AvaliarPassageiro() {
  const { acordoId, passageiroId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const ctx = useAcordoRatingContext(acordoId);
  const [estrelas, setEstrelas] = useState(0);
  const [comentario, setComentario] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  const linha = useMemo(
    () => (ctx.acordo?.acordos_passageiros || []).find((p) => p.passenger_id === passageiroId),
    [ctx.acordo, passageiroId],
  );

  const prompt = useMemo(() => {
    if (!ctx.acordo || !linha || !user?.id) return null;
    const rows = buildMotoristaRatingPrompts({
      acordoId: ctx.acordo.id,
      passageiros: [linha],
      pagamentos: ctx.pagamentos,
      avaliacoes: ctx.avaliacoes,
      now: new Date(),
      driverId: user.id,
    });
    return rows[0] || null;
  }, [ctx, linha, user?.id]);

  const nome = linha?.perfis?.nome_completo || prompt?.contraparteNome || 'Passageiro';
  const mesLabel = prompt?.periodoLabel || '';

  const handleSubmit = async () => {
    if (!ctx.acordo || !linha || estrelas < 1) return;
    setBusy(true);
    setFeedback('');
    try {
      await submitAvaliacao({
        acordoId: ctx.acordo.id,
        acordoPassageiroId: linha.id,
        momento: RATING_MOMENTO.PRIMEIRO_PERIODO,
        estrelas,
        comentario: comentario.trim() || null,
      });
      await ctx.reload();
      navigate(`/acordos/${ctx.acordo.id}/avaliar-passageiros`, { replace: true });
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
    navigate(`/acordos/${ctx.acordo.id}/avaliar-passageiros`, { replace: true });
  };

  if (ctx.loading) {
    return (
      <PageShell>
        <LoadingSkeleton />
      </PageShell>
    );
  }

  if (ctx.error || !ctx.acordo || !linha) {
    return (
      <PageShell>
        <PageHeader title="Avaliar" onBack={() => navigate(-1)} />
        <FeedbackAlert type="error" text={ctx.error || 'Passageiro não encontrado.'} />
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
      <PageHeader title="Avaliar" onBack={() => navigate(-1)} />
      {feedback ? <FeedbackAlert type="error" text={feedback} className="mb-4" /> : null}
      <AvaliarFormFields
        estrelas={estrelas}
        onEstrelasChange={setEstrelas}
        comentario={comentario}
        onComentarioChange={setComentario}
        onSubmit={handleSubmit}
        onSkip={handleSkip}
        busy={busy}
        contraparteLabel={nome}
        rotaLabel={ctx.rotaLabel}
        periodoLabel={mesLabel}
        badgeLabel="1.º mês pago"
        iniciais={iniciaisNome(nome)}
        privacyNote="O passageiro vê que o avaliaste; o texto do comentário fica só com a plataforma."
      />
    </PageShell>
  );
}
