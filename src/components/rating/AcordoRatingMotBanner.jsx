import React from 'react';
import { Button } from '../ui/button';
import { countMotoristaRatingProgress } from '../../utils/ratingGates';

/**
 * Banner motorista — CTA para lista de passageiros (Figma entrada mot).
 * @param {{ prompts: object[], onAvaliar: () => void }} props
 */
export default function AcordoRatingMotBanner({ prompts, onAvaliar }) {
  const pendente = (prompts || []).some((p) => p.estado === 'pendente');
  if (!pendente) return null;

  const { feitos, total } = countMotoristaRatingProgress(prompts);

  return (
    <section
      className="rounded-2xl border border-emerald-200 bg-emerald-50/80 dark:bg-emerald-950/30 dark:border-emerald-900/50 p-4 space-y-3"
      data-testid="acordo-rating-mot-banner"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
          Pendente
        </span>
        <p className="font-bold text-slate-900 dark:text-white">Avaliar passageiros</p>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300 text-pretty">
        Pagamento do 1.º mês confirmado. Avaliaste {feitos} de {total} passageiros.
      </p>
      <Button
        type="button"
        className="w-full h-11 rounded-xl font-bold"
        onClick={onAvaliar}
        data-testid="acordo-rating-mot-cta"
      >
        Avaliar
      </Button>
    </section>
  );
}
