import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { formatKwanza } from '../utils/formatKwanza';

/**
 * Bloco legível do contrato digital (snapshot congelado).
 *
 * @param {{
 *   snapshot: import('../utils/buildAcordoContratoSnapshot').ContratoSnapshot,
 *   variant?: 'default' | 'compact',
 *   highlightKz?: number | null,
 *   className?: string,
 * }} props
 */
function AcordoContratoSnapshot({
  snapshot,
  variant = 'default',
  highlightKz = null,
  className = '',
}) {
  if (!snapshot?.complete) {
    return (
      <div
        role="alert"
        data-testid="acordo-contrato-incomplete"
        className={`rounded-xl border border-amber-200/90 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-900/50 p-3 text-sm text-amber-950 dark:text-amber-100 text-pretty ${className}`}
      >
        Dados do contrato incompletos — contacta o suporte se o problema persistir.
      </div>
    );
  }

  const destaque =
    highlightKz != null && Number.isInteger(highlightKz) ? highlightKz : snapshot.porPassageiroKz;

  return (
    <div
      data-testid="acordo-contrato-snapshot"
      className={`rounded-xl border border-emerald-200/80 bg-white dark:bg-slate-900 dark:border-emerald-900/40 p-3 space-y-3 ${className}`}
    >
      <div className="flex items-start gap-3">
        <ShieldCheck
          size={20}
          className="text-primary shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1 space-y-0.5">
          {variant === 'default' ? (
            <>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Contrato acordado
              </p>
              <p className="text-xs text-slate-500 text-pretty">
                O valor fica congelado durante este acordo.
              </p>
            </>
          ) : null}
        </div>
        {destaque != null ? (
          <strong
            className="tabular-nums shrink-0 text-lg font-bold text-primary"
            data-testid="contrato-quota-destaque"
          >
            {formatKwanza(destaque)} Kz
          </strong>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Modalidade</dt>
          <dd className="font-semibold text-slate-900 dark:text-white">
            {snapshot.modalidade}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Pessoas no acordo</dt>
          <dd className="font-semibold text-slate-900 dark:text-white">
            {snapshot.nLabel}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Valor combinado</dt>
          <dd className="font-bold tabular-nums text-slate-900 dark:text-white">
            {formatKwanza(snapshot.valorReferenciaKz)} Kz
            <span className="sr-only"> ({snapshot.valorReferenciaLabel})</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Total mensal</dt>
          <dd className="font-bold tabular-nums text-primary">
            {formatKwanza(snapshot.totalMensalKz)} Kz
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-slate-500">Quota por pessoa</dt>
          <dd className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
            {formatKwanza(snapshot.porPassageiroKz)} Kz / pessoa
          </dd>
        </div>
      </dl>

      {snapshot.temResto ? (
        <p className="text-xs text-slate-500 text-pretty">
          Alguns passageiros pagam {formatKwanza(snapshot.porPassageiroKz + 1)} Kz e outros{' '}
          {formatKwanza(snapshot.porPassageiroKz)} Kz para o total fechar exacto.
        </p>
      ) : null}
    </div>
  );
}

export default AcordoContratoSnapshot;
