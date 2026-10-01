import React from 'react';
import { Button } from '../ui/button';

/**
 * Banner de entrada «Avaliar motorista» no detalhe do acordo (Figma 1:13).
 * @param {{
 *   prompt: { titulo?: string, contraparteNome?: string, badgeLabel?: string, estado: string },
 *   onAvaliar: () => void,
 * }} props
 */
export default function AcordoRatingBanner({ prompt, onAvaliar }) {
  if (!prompt || prompt.estado !== 'pendente') return null;

  return (
    <section
      className="rounded-2xl border border-emerald-200 bg-emerald-50/80 dark:bg-emerald-950/30 dark:border-emerald-900/50 p-4 space-y-3"
      data-testid="acordo-rating-banner"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
          Pendente
        </span>
        <p className="font-bold text-slate-900 dark:text-white">
          {prompt.titulo || 'Avaliar motorista'}
        </p>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300 text-pretty">
        Pagamento do 1.º mês confirmado. Diz-nos como foi a boleia com{' '}
        {prompt.contraparteNome || 'o motorista'}.
      </p>
      <Button
        type="button"
        className="w-full h-11 rounded-xl font-bold"
        onClick={onAvaliar}
        data-testid="acordo-rating-cta"
      >
        Avaliar motorista
      </Button>
      <p className="text-xs text-slate-500">Podes avaliar enquanto a janela estiver aberta.</p>
    </section>
  );
}
