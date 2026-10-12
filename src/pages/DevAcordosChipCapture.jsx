import React from 'react';
import AcordoPagamentoPanel from '../components/AcordoPagamentoPanel';
import {
  labelChipListaEstadoAcordo,
  variantChipListaEstadoAcordo,
  chipClassEstadoAcordoVariant,
} from '../utils/acordoEstadoDisplay';

/**
 * Pré-visualização DEV (390px) dos chips da lista `/acordos` — light + dark.
 * Registada só com `import.meta.env.DEV` via DevAppRoutes.
 *
 * @typedef {Readonly<{}>} DevAcordosChipCaptureProps
 */
export default function DevAcordosChipCapture() {
  const fixtures = [
    {
      key: 'requerente',
      title: 'Consensual — requerente',
      acordo: {
        estado: 'activo',
        rescisao_modo: 'consensual',
        rescisao_confirmada_em: null,
        rescisao_solicitada_por: 'user-a',
      },
      userId: 'user-a',
    },
    {
      key: 'contraparte',
      title: 'Consensual — contraparte',
      acordo: {
        estado: 'activo',
        rescisao_modo: 'consensual',
        rescisao_confirmada_em: null,
        rescisao_solicitada_por: 'user-a',
      },
      userId: 'user-b',
    },
    {
      key: 'cancelamento',
      title: 'Cancelamento pendente',
      acordo: {
        estado: 'cancelamento_pendente',
        rescisao_effective_on: '2026-11-01',
      },
      userId: 'user-a',
    },
  ];

  return (
    <div
      className="min-h-dvh bg-background-light dark:bg-background-dark p-4"
      data-testid="dev-acordos-chip-capture"
    >
      <div className="mx-auto max-w-[390px] space-y-6">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          Captura — chips lista acordos
        </h1>
        <section
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4"
          data-testid="dev-pagamento-comprovativo-capture"
        >
          <p className="text-xs font-semibold text-slate-500 mb-3">
            Pagamento — comprovativo enviado (#251)
          </p>
          <AcordoPagamentoPanel
            pagamento={{
              id: 'pag-capture',
              valor_kz: 0,
              estado: 'comprovativo_enviado',
              comprovativo_path: 'uid/pag-capture/recibo.pdf',
            }}
            lugarEstado="activo"
            obrigacao={{
              quota: 43000,
              valor_em_divida: 0,
              prazo: '2026-10-12T12:00:00.000Z',
            }}
          />
        </section>

        {fixtures.map(({ key, title, acordo, userId }) => {
          const variant = variantChipListaEstadoAcordo(acordo, userId);
          const label = labelChipListaEstadoAcordo(acordo, userId);
          return (
            <section
              key={key}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-2"
              data-testid={`dev-acordos-chip-${key}`}
            >
              <p className="text-xs font-semibold text-slate-500">{title}</p>
              <span
                className={`inline-flex text-xs font-bold px-2.5 py-1 rounded-full ${chipClassEstadoAcordoVariant(variant)}`}
              >
                {label}
              </span>
            </section>
          );
        })}
      </div>
    </div>
  );
}
