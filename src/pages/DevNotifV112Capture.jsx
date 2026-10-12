import React from 'react';
import NotificationListItem from '../components/NotificationListItem';
import { NOTIF_TITULO_V1_12 } from '../utils/notificationStatusCardCopy';

const FIXTURE_CREATED_AT = '2026-10-12T08:00:00.000Z';
const ACORDO_ID = 'f5555555-5555-4555-8555-555555555555';

/** @type {Array<{ key: string, label: string, notif: object }>} */
const FIXTURES = [
  {
    key: 'v112-com-nome',
    label: 'v1.12 — com nome',
    notif: {
      id: 'n-v112-name',
      mensagem: 'A reserva de Maria Silva expirou. O acordo continua.',
      tipo: 'info',
      lida: false,
      created_at: FIXTURE_CREATED_AT,
      metadata: {
        type: 'status',
        card: 'v1.12',
        titulo: NOTIF_TITULO_V1_12,
        acordo_id: ACORDO_ID,
      },
    },
  },
  {
    key: 'v112-sem-nome',
    label: 'v1.12 — sem nome',
    notif: {
      id: 'n-v112-noname',
      mensagem: 'A reserva de um passageiro expirou. O acordo continua.',
      tipo: 'info',
      lida: false,
      created_at: FIXTURE_CREATED_AT,
      metadata: {
        type: 'status',
        card: 'v1.12',
        titulo: NOTIF_TITULO_V1_12,
        acordo_id: ACORDO_ID,
      },
    },
  },
];

/**
 * Captura DEV (390px) — card motorista v1.12 (expiração com lugares vivos).
 *
 * @typedef {Readonly<{}>} DevNotifV112CaptureProps
 */
export default function DevNotifV112Capture() {
  return (
    <div className="min-h-dvh bg-background-light p-4" data-testid="dev-notif-v112-capture-root">
      <div className="mx-auto max-w-[390px] space-y-8">
        <h1 className="text-lg font-bold text-slate-900">Captura — notificação v1.12</h1>

        <section data-testid="dev-notif-v112-light">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Light</p>
          <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {FIXTURES.map((fx) => (
              <NotificationListItem
                key={`light-${fx.key}`}
                notif={fx.notif}
                showKebab={false}
              />
            ))}
          </ul>
        </section>

        <section
          className="dark bg-background-dark p-4 rounded-xl"
          data-testid="dev-notif-v112-dark"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Dark</p>
          <ul className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-sm">
            {FIXTURES.map((fx) => (
              <NotificationListItem
                key={`dark-${fx.key}`}
                notif={fx.notif}
                showKebab={false}
              />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
