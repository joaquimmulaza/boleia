import React from 'react';
import { Button } from '../components/ui/button';
import {
  labelChipListaEstadoAcordo,
  variantChipListaEstadoAcordo,
  chipClassEstadoAcordoVariant,
} from '../utils/acordoEstadoDisplay';

/**
 * Pré-visualização DEV (390px) — chips lista + picker kebab (consensual pendente).
 *
 * @typedef {Readonly<{}>} DevAcordosChipCaptureProps
 */
export default function DevAcordosChipCapture() {
  const acordoPaxPediu = {
    estado: 'activo',
    driver_id: 'driver-1',
    rescisao_modo: 'consensual',
    rescisao_confirmada_em: null,
    rescisao_solicitada_por: 'pax-1',
    acordos_passageiros: [
      { passenger_id: 'pax-1', estado: 'activo' },
      { passenger_id: 'pax-2', estado: 'activo' },
    ],
  };

  const chipFixtures = [
    {
      key: 'motorista-confirma',
      title: 'Motorista — Falta a tua confirmação',
      acordo: acordoPaxPediu,
      userId: 'driver-1',
    },
    {
      key: 'pax-informativo',
      title: 'Outro passageiro — Encerramento pedido (só informativo)',
      acordo: acordoPaxPediu,
      userId: 'pax-2',
    },
    {
      key: 'requerente',
      title: 'Passageiro requerente — Encerramento pedido',
      acordo: acordoPaxPediu,
      userId: 'pax-1',
    },
  ];

  return (
    <div
      className="min-h-dvh bg-background-light dark:bg-background-dark p-4"
      data-testid="dev-acordos-chip-capture"
    >
      <div className="mx-auto max-w-[390px] space-y-6">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          Captura #263 — chips + kebab
        </h1>

        {chipFixtures.map(({ key, title, acordo, userId }) => {
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
                role="status"
                className={`inline-flex text-xs font-bold px-2.5 py-1 rounded-full ${chipClassEstadoAcordoVariant(variant)}`}
              >
                {label}
              </span>
            </section>
          );
        })}

        <section
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3"
          data-testid="dev-kebab-picker-consensual-pendente"
        >
          <p className="text-xs font-semibold text-slate-500">
            Kebab → Encerrar acordo (consensual pendente; só justa causa)
          </p>
          <div
            data-testid="terminate-modality-picker"
            className="rounded-[34px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-5 space-y-4"
          >
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Como queres encerrar o acordo?
              </h3>
              <p className="text-sm text-slate-500 text-pretty">
                Escolhe a modalidade de rescisão do acordo completo ou sai só tu mantendo o acordo
                activo para os restantes.
              </p>
            </div>
            <p
              className="text-sm text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2 text-pretty"
              data-testid="terminate-picker-consensual-pendente-aviso"
            >
              Há um pedido de encerramento amigável pendente. Só podes usar justa causa até
              confirmar ou recusar esse pedido.
            </p>
            <button
              type="button"
              className="w-full text-left rounded-xl border border-red-200 dark:border-red-900/50 p-4"
            >
              <p className="font-bold text-red-800 dark:text-red-200">Justa causa imediata</p>
              <p className="text-sm text-slate-500 mt-1 text-pretty">
                Só com motivo válido: avaria do veículo, segurança ou faltas excessivas.
              </p>
            </button>
            <Button type="button" variant="ghost" className="w-full">
              Voltar
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
