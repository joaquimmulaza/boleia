import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { chipClassEstadoPagamento } from '../utils/paymentStatus';

/**
 * Cartão de estado P0 (Figma S1–S3 / S6a) no detalhe do acordo.
 *
 * @param {{
 *   variant: 'S1' | 'S2' | 'S3' | 'S6a',
 *   corpo: string,
 *   secundaria?: string | null,
 *   mostrarUploadNoCartao?: boolean,
 *   uploadSlot?: React.ReactNode,
 *   chipPagamento?: string | null,
 * }} props
 */
function AcordoPagamentoEstadoCartao({
  variant,
  corpo,
  secundaria = null,
  mostrarUploadNoCartao = false,
  uploadSlot = null,
  chipPagamento = null,
}) {
  const Icon = variant === 'S2' ? AlertTriangle : Info;
  const iconWrapClass =
    variant === 'S2'
      ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200'
      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';

  return (
    <div
      className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
      data-testid="acordo-pagamento-estado-cartao"
      data-variant={variant}
    >
      <div className="flex gap-3 items-start">
        <div
          className={`shrink-0 w-10 h-10 rounded-full inline-flex items-center justify-center ${iconWrapClass}`}
          aria-hidden="true"
        >
          <Icon size={22} />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          {chipPagamento ? (
            <span
              className={`inline-flex text-xs font-semibold px-2 py-1 rounded-full ${chipClassEstadoPagamento('anulado')}`}
              data-testid="cartao-estado-chip-pagamento"
            >
              {chipPagamento}
            </span>
          ) : null}
          <p className="text-sm text-slate-800 dark:text-slate-100 text-pretty">
            {corpo}
          </p>
        </div>
      </div>
      {secundaria ? (
        <p
          className="text-xs text-slate-600 dark:text-slate-300 text-pretty pl-[52px]"
          data-testid="cartao-estado-secundaria"
        >
          {secundaria}
        </p>
      ) : null}
      {mostrarUploadNoCartao && uploadSlot ? (
        <div className="pt-1" data-testid="cartao-estado-upload">
          {uploadSlot}
        </div>
      ) : null}
    </div>
  );
}

export default AcordoPagamentoEstadoCartao;
