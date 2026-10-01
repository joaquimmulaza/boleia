import React from 'react';
import StarRatingInput from './StarRatingInput';
import { Button } from '../ui/button';

/**
 * Campos partilhados do formulário de avaliação (Figma Pax/Mot).
 * @param {{
 *   estrelas: number,
 *   onEstrelasChange: (n: number) => void,
 *   comentario: string,
 *   onComentarioChange: (v: string) => void,
 *   onSubmit: () => void,
 *   onSkip?: () => void,
 *   busy?: boolean,
 *   submitLabel?: string,
 *   skipLabel?: string,
 *   contraparteLabel?: string,
 *   periodoLabel?: string,
 *   badgeLabel?: string,
 *   iniciais?: string,
 *   rotaLabel?: string,
 *   privacyNote?: string,
 * }} props
 */
export default function AvaliarFormFields({
  estrelas,
  onEstrelasChange,
  comentario,
  onComentarioChange,
  onSubmit,
  onSkip,
  busy = false,
  submitLabel = 'Enviar avaliação',
  skipLabel = 'Agora não',
  contraparteLabel,
  periodoLabel,
  badgeLabel,
  iniciais = '?',
  rotaLabel,
  privacyNote = 'O motorista vê que o avaliaste; o texto do comentário fica só com a plataforma.',
}) {
  const canSubmit = estrelas >= 1 && !busy;

  return (
    <div className="space-y-6">
      {badgeLabel ? (
        <span className="inline-flex text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
          {badgeLabel}
        </span>
      ) : null}

      <div className="rounded-2xl border border-slate-100 bg-white dark:bg-slate-900 dark:border-slate-800 p-4 flex items-center gap-3">
        <div
          className="size-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0"
          aria-hidden="true"
        >
          {iniciais}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-slate-900 dark:text-white truncate">{contraparteLabel}</p>
          {rotaLabel ? (
            <p className="text-sm text-slate-500 truncate">{rotaLabel}</p>
          ) : null}
          {periodoLabel ? (
            <p className="text-sm text-slate-500">{periodoLabel}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 text-center">
        <p className="font-semibold text-slate-900 dark:text-white">Como foi a boleia?</p>
        <StarRatingInput value={estrelas} onChange={onEstrelasChange} disabled={busy} />
      </div>

      <div className="space-y-2">
        <textarea
          value={comentario}
          onChange={(e) => onComentarioChange(e.target.value)}
          placeholder="Comentário opcional (só a plataforma vê)"
          rows={4}
          disabled={busy}
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          data-testid="avaliar-comentario"
        />
        <p className="text-xs text-slate-500 text-pretty">{privacyNote}</p>
      </div>

      <div className="space-y-3 pt-2">
        <Button
          type="button"
          className="w-full h-12 rounded-xl font-bold"
          disabled={!canSubmit}
          onClick={onSubmit}
          data-testid="avaliar-submit"
        >
          {canSubmit ? submitLabel : 'Escolhe uma classificação'}
        </Button>
        {onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            disabled={busy}
            className="w-full text-center text-sm font-semibold text-slate-500 hover:text-slate-700 py-2"
            data-testid="avaliar-skip"
          >
            {skipLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
