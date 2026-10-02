import React from 'react';
import { Banknote } from 'lucide-react';
import {
  aplicarValidacaoNativaValorProposta,
  labelValorProposta,
} from '../utils/propostaValor.js';
import { formatKwanza } from '../utils/formatKwanza.js';

/**
 * Campo editável do valor mensal da proposta (counter-ask).
 *
 * @param {{
 *   modoPreco?: string,
 *   value: string | number,
 *   onChange: (event: React.ChangeEvent<HTMLInputElement>) => void,
 *   disabled?: boolean,
 *   askKz?: number | null,
 * }} props
 */
function PropostaValorInput({ modoPreco, value, onChange, disabled = false, askKz = null }) {
  const label = labelValorProposta(modoPreco);

  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-slate-900 dark:text-white">
      <span className="flex items-center gap-1">
        <Banknote size={15} aria-hidden="true" />
        {label}
      </span>
      <input
        type="number"
        name="valor_mensal_proposta_kz"
        min="1"
        step="1"
        value={value}
        onChange={onChange}
        onInvalid={(e) => aplicarValidacaoNativaValorProposta(e.currentTarget)}
        onInput={(e) => {
          e.currentTarget.setCustomValidity('');
        }}
        required
        disabled={disabled}
        aria-label={label}
        data-testid="proposta-valor-input"
        className="h-11 rounded-lg bg-slate-50 dark:bg-slate-800 px-3 tabular-nums border border-slate-200 dark:border-slate-700"
      />
      {askKz != null ? (
        <span className="text-xs font-normal text-slate-500">
          Preço publicado: {formatKwanza(askKz)} Kz — podes propor outro valor.
        </span>
      ) : null}
    </label>
  );
}

export default PropostaValorInput;
