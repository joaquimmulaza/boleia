import React from 'react';
import AcordoPagamentoPanel from '../components/AcordoPagamentoPanel';
import AcordoDetalheSheetHeader from '../components/AcordoDetalheSheetHeader';
import { Button } from '../components/ui/button';
import { acordoEstadoListaChipProps } from '../utils/acordoEstadoDisplay';

/**
 * Pré-visualização DEV (390px) — chips lista/modal + kebab + #251.
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

  const acordoDriverPediu = {
    ...acordoPaxPediu,
    rescisao_solicitada_por: 'driver-1',
  };

  const modalFixtures = [
    {
      key: 'modal-a',
      title: '(A) Modal — outro pax, pax pediu',
      acordo: acordoPaxPediu,
      viewerUserId: 'pax-2',
    },
    {
      key: 'modal-b',
      title: '(B) Modal — pax activo, motorista pediu',
      acordo: acordoDriverPediu,
      viewerUserId: 'pax-1',
    },
    {
      key: 'modal-c',
      title: '(C) Modal — motorista, pax pediu',
      acordo: acordoPaxPediu,
      viewerUserId: 'driver-1',
    },
  ];

  const noop = () => {};

  return (
    <div
      className="min-h-dvh bg-background-light dark:bg-background-dark p-4"
      data-testid="dev-acordos-chip-capture"
    >
      <div className="mx-auto max-w-[390px] space-y-6" data-testid="dev-modal-capture">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          Captura #263 — modal + lista
        </h1>

        {modalFixtures.map(({ key, title, acordo, viewerUserId }) => (
          <section
            key={key}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden"
            data-testid={`dev-acordos-${key}`}
          >
            <p className="text-xs font-semibold text-slate-500 px-4 pt-3">{title}</p>
            <AcordoDetalheSheetHeader
              acordoId="dev-acordo"
              estadoAcordo={acordo.estado}
              rescisaoModoAcordo={acordo.rescisao_modo}
              rescisaoConfirmadaEmAcordo={acordo.rescisao_confirmada_em}
              rescisaoSolicitadaPorAcordo={acordo.rescisao_solicitada_por}
              driverIdAcordo={acordo.driver_id}
              acordosPassageiros={acordo.acordos_passageiros}
              viewerUserId={viewerUserId}
              onClose={noop}
              podeRegistarFaltas={false}
              podeEncerrar={false}
              onRegistarFalta={noop}
              onEncerrar={noop}
            />
          </section>
        ))}

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
            </button>
            <Button type="button" variant="ghost" className="w-full">
              Voltar
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-500">Lista — chips (referência)</p>
          {[
            { userId: 'driver-1', acordo: acordoPaxPediu },
            { userId: 'pax-2', acordo: acordoPaxPediu },
          ].map(({ userId, acordo }) => {
            const chip = acordoEstadoListaChipProps(acordo, userId);
            return (
              <span
                key={userId}
                role={chip.role}
                className={`inline-flex text-xs font-bold px-2.5 py-1 rounded-full ${chip.className}`}
              >
                {chip.label}
              </span>
            );
          })}
        </section>
      </div>
    </div>
  );
}
