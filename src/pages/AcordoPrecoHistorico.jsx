import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageShell from '../components/PageShell';
import PageHeader from '../components/PageHeader';
import LoadingSkeleton from '../components/LoadingSkeleton';
import FeedbackAlert from '../components/FeedbackAlert';
import AcordoPrecoHistoricoLista from '../components/precoProximoMes/AcordoPrecoHistoricoLista';
import { useAcordoPrecoContext } from '../hooks/useAcordoPrecoContext';

/**
 * Histórico auditável de propostas (Figma 11:90).
 */
export default function AcordoPrecoHistorico() {
  const { acordoId } = useParams();
  const navigate = useNavigate();
  const ctx = useAcordoPrecoContext(acordoId);

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
        <PageHeader title="Histórico de propostas" onBack={() => navigate('/acordos')} />
        <FeedbackAlert type="error" text={ctx.error || 'Acordo não encontrado.'} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Histórico de propostas"
        subtitle={ctx.rotaLabel}
        onBack={() => navigate('/acordos')}
      />
      <AcordoPrecoHistoricoLista
        historico={ctx.historico}
        mesActualLabel={ctx.mesActualLabel}
      />
    </PageShell>
  );
}
