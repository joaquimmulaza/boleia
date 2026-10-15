import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import PageShell from '../components/PageShell';
import PageHeader from '../components/PageHeader';
import LoadingSkeleton from '../components/LoadingSkeleton';
import FeedbackAlert from '../components/FeedbackAlert';
import { useAcordoRatingContext, iniciaisNome } from '../hooks/useAcordoRatingContext';
import { useAuth } from '../contexts/AuthContext';
import {
  buildMotoristaRatingPrompts,
  countMotoristaRatingProgress,
  formatMesRatingCurto,
} from '../utils/ratingGates';

/**
 * Motorista — lista de passageiros para avaliar (Figma 1:5).
 */
export default function AvaliarPassageirosLista() {
  const { acordoId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const ctx = useAcordoRatingContext(acordoId);

  let prompts = [];
  if (ctx.acordo && user?.id) {
    const linhas = (ctx.acordo.acordos_passageiros || []).map((p, idx) => ({
      ...p,
      lugarLabel: `Lugar ${String.fromCharCode(65 + idx)}`,
    }));
    prompts = buildMotoristaRatingPrompts({
      acordoId: ctx.acordo.id,
      passageiros: linhas,
      pagamentos: ctx.pagamentos,
      avaliacoes: ctx.avaliacoes,
      now: new Date(),
      driverId: user.id,
    }).map((p, idx) => ({
      ...p,
      lugarLabel: linhas[idx]?.lugarLabel || '',
      rotaLabel: ctx.rotaLabel,
    }));
  }

  const progress = countMotoristaRatingProgress(prompts);
  const mesLabel = ctx.pagamentos.find((p) => p.mes_referencia)?.mes_referencia;
  const periodoHeader = mesLabel ? formatMesRatingCurto(mesLabel) : '';

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
        <PageHeader title="Avaliar passageiros" onBack={() => navigate('/acordos')} />
        <FeedbackAlert type="error" text={ctx.error || 'Acordo indisponível.'} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader title="Avaliar passageiros" onBack={() => navigate('/acordos')} />
      <div className="space-y-4">
        {periodoHeader ? (
          <p className="text-sm text-slate-500">
            Pagamento do 1.º mês confirmado · {periodoHeader}
          </p>
        ) : null}
        <p className="text-sm text-slate-700 dark:text-slate-200 text-pretty">
          Escolhe um passageiro para avaliar. Avaliaste {progress.feitos} de {progress.total}.
        </p>

        <ul className="space-y-3" data-testid="avaliar-passageiros-lista">
          {prompts.map((p) => {
            const pendente = p.estado === 'pendente';
            return (
              <li key={p.acordoPassageiroId}>
                <button
                  type="button"
                  disabled={!pendente}
                  onClick={() => {
                    if (!pendente) return;
                    navigate(
                      `/acordos/${ctx.acordo.id}/avaliar-passageiro/${p.passengerId}`,
                    );
                  }}
                  className="w-full flex items-center gap-3 rounded-2xl border border-slate-100 bg-white dark:bg-slate-900 dark:border-slate-800 p-4 text-left disabled:opacity-80"
                  data-testid={`avaliar-pax-row-${p.passengerId}`}
                >
                  <div className="size-11 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                    {iniciaisNome(p.contraparteNome)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 dark:text-white">{p.contraparteNome}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {p.lugarLabel} · {p.rotaLabel}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${
                      pendente
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {pendente ? 'Pendente' : 'Avaliado'}
                  </span>
                  {pendente ? (
                    <ChevronRight size={18} className="text-slate-400 shrink-0" aria-hidden="true" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>

        <p className="text-xs text-slate-500 text-pretty pt-2">
          Só a plataforma vê o comentário escrito. O passageiro vê apenas que o avaliaste.
        </p>
      </div>
    </PageShell>
  );
}
