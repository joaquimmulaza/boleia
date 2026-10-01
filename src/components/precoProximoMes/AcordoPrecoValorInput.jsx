import React from 'react';
import { formatKwanza } from '../../utils/formatKwanza.js';

/**
 * Campo grande de valor mensal (Figma «Novo valor mensal»).
 * @param {{
 *   value: string,
 *   onChange: (event: React.ChangeEvent<HTMLInputElement>) => void,
 *   precoActual: number,
 *   disabled?: boolean,
 *   error?: string,
 * }} props
 */
export default function AcordoPrecoValorInput({
  value,
  onChange,
  precoActual,
  disabled = false,
  error = '',
}) {
  const hasError = Boolean(error);

  return (
    <div
      className={`rounded-xl border bg-white dark:bg-slate-900 p-4 space-y-2.5 ${
        hasError
          ? 'border-red-300 dark:border-red-800'
          : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      <p className="text-xs font-semibold text-slate-500">Novo valor mensal</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          value={value}
          onChange={onChange}
          disabled={disabled}
          aria-label="Novo valor mensal em Kz"
          data-testid="preco-novo-valor-input"
          className={`w-full bg-transparent text-[32px] font-bold leading-none tabular-nums outline-none ${
            hasError ? 'text-red-700 dark:text-red-300' : 'text-slate-900 dark:text-white'
          }`}
        />
        <span className="text-base font-medium text-slate-500 shrink-0">Kz / mês</span>
      </div>
      <p className="text-xs text-slate-500">
        Atual: {formatKwanza(precoActual)} Kz / mês
      </p>
      {hasError ? (
        <p className="text-xs font-medium text-red-700 dark:text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
