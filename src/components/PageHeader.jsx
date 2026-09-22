import React from 'react';
import { ArrowLeft } from 'lucide-react';

/**
 * Cabeçalho de página reutilizável para ecrãs autenticados.
 * @param {{
 *   title: string;
 *   subtitle?: string;
 *   onBack?: () => void;
 *   actionLabel?: string;
 *   onAction?: () => void;
 * }} props
 */
const PageHeader = ({ title, subtitle, onBack, actionLabel, onAction }) => (
  <header className="flex flex-col gap-1 mb-6">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar"
            className="size-10 shrink-0 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors bg-white shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
          >
            <ArrowLeft size={20} className="text-slate-900 dark:text-slate-100" />
          </button>
        ) : null}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-balance text-slate-900 dark:text-white">{title}</h1>
          {subtitle ? (
            <p className="text-sm text-pretty text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 text-sm font-bold text-primary hover:text-primary/80 transition-colors rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  </header>
);

export default PageHeader;
