import React from 'react';
import { ChevronRight } from 'lucide-react';
import PageShell from '../components/PageShell';
import PageHeader from '../components/PageHeader';
import { Badge } from '../components/ui/badge';
import { iniciaisNome } from '../hooks/useAcordoRatingContext';
import {
  labelMotoristaRatingListaBadge,
  motoristaRatingListaBadgeUi,
} from '../utils/ratingGates';

/** @type {Array<{ passengerId: string, contraparteNome: string, estado: 'feito' | 'expirado', lugarLabel: string }>} */
const FIXTURE_ROWS = [
  {
    passengerId: 'p-feito',
    contraparteNome: 'Maria Avaliada',
    estado: 'feito',
    lugarLabel: 'Lugar A',
  },
  {
    passengerId: 'p-exp',
    contraparteNome: 'João Expirado',
    estado: 'expirado',
    lugarLabel: 'Lugar B',
  },
];

/**
 * Pré-visualização DEV (390px) — lista motorista com expirado + avaliado.
 * Rota: `/__dev/avaliar-passageiros-lista`.
 */
export default function DevAvaliarPassageirosListaCapture() {
  return (
    <PageShell>
      <div data-testid="dev-avaliar-passageiros-lista-capture">
        <PageHeader title="Avaliar passageiros" onBack={() => {}} />
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Pagamento do 1.º mês confirmado · set 2026</p>
          <p className="text-sm text-slate-700 dark:text-slate-200 text-pretty">
            Escolhe um passageiro para avaliar. Avaliaste 1 de 2.
          </p>
          <ul className="space-y-3" data-testid="avaliar-passageiros-lista">
            {FIXTURE_ROWS.map((p) => {
              const pendente = p.estado === 'pendente';
              const badgeUi = motoristaRatingListaBadgeUi(p.estado);
              return (
                <li key={p.passengerId}>
                  <button
                    type="button"
                    disabled={!pendente}
                    className="w-full flex items-center gap-3 rounded-2xl border border-slate-100 bg-white dark:bg-slate-900 dark:border-slate-800 p-4 text-left disabled:opacity-80"
                    data-testid={`avaliar-pax-row-${p.passengerId}`}
                  >
                    <div className="size-11 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                      {iniciaisNome(p.contraparteNome)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 dark:text-white">{p.contraparteNome}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {p.lugarLabel} · Talatona → Mutual
                      </p>
                    </div>
                    <Badge variant={badgeUi.variant} className={badgeUi.className}>
                      {labelMotoristaRatingListaBadge(p.estado)}
                    </Badge>
                    {pendente ? (
                      <ChevronRight size={18} className="text-slate-400 shrink-0" aria-hidden="true" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </PageShell>
  );
}
