import React from 'react';
import NotificationListItem from '../components/NotificationListItem';

const FIXTURE_CREATED_AT = '2026-10-12T08:00:00.000Z';
const ACORDO_ID = 'f5555555-5555-4555-8555-555555555555';

/** Copy exacta: `handle_acordo_notifications` — `20261009230000_notif_b4_txid_cancel_suppress.sql` (#252 / B4). */
const MSG_252_PASSAGEIRO_ULTIMO_CANCELADO = 'O teu acordo de boleia foi cancelado.';

/** @type {Array<{ key: string, label: string, notif: object }>} */
const FIXTURES = [
  {
    key: 'v111-com-nome',
    label: 'v1.11 — motorista (com nome)',
    notif: {
      id: 'n-v111-name',
      mensagem:
        'A reserva de Maria Silva expirou e o acordo foi encerrado. A tua oferta continua publicada.',
      tipo: 'info',
      lida: false,
      created_at: FIXTURE_CREATED_AT,
      metadata: {
        type: 'status',
        card: 'v1.11',
        titulo: 'Acordo encerrado',
        acordo_id: ACORDO_ID,
      },
    },
  },
  {
    key: 'v111-sem-nome',
    label: 'v1.11 — motorista (sem nome)',
    notif: {
      id: 'n-v111-noname',
      mensagem:
        'A reserva do último passageiro expirou e o acordo foi encerrado. A tua oferta continua publicada.',
      tipo: 'info',
      lida: false,
      created_at: FIXTURE_CREATED_AT,
      metadata: {
        type: 'status',
        card: 'v1.11',
        titulo: 'Acordo encerrado',
        acordo_id: ACORDO_ID,
      },
    },
  },
  {
    key: 'v110-com-rota',
    label: 'v1.10 — passageiro removido (com rota)',
    notif: {
      id: 'n-v110-route',
      mensagem:
        'O motorista retirou-te do acordo Talatona → Belas Shopping. O teu lugar foi libertado.',
      tipo: 'info',
      lida: false,
      created_at: FIXTURE_CREATED_AT,
      metadata: {
        type: 'status',
        card: 'v1.10',
        titulo: 'Já não fazes parte deste acordo',
        acordo_id: ACORDO_ID,
      },
    },
  },
  {
    key: '252-ultimo-cancelado',
    label: '#252 — motorista remove último passageiro (passageiro)',
    notif: {
      id: 'n-252-last-removed',
      mensagem: MSG_252_PASSAGEIRO_ULTIMO_CANCELADO,
      tipo: 'error',
      lida: false,
      created_at: FIXTURE_CREATED_AT,
      metadata: {
        type: 'agreement_update',
        acordo_id: ACORDO_ID,
      },
    },
  },
  {
    key: 'v110-flexivel',
    label: 'v1.10 — passageiro removido (oferta flexível)',
    notif: {
      id: 'n-v110-flex',
      mensagem: 'O motorista retirou-te do acordo. O teu lugar foi libertado.',
      tipo: 'info',
      lida: false,
      created_at: FIXTURE_CREATED_AT,
      metadata: {
        type: 'status',
        card: 'v1.10',
        titulo: 'Já não fazes parte deste acordo',
        acordo_id: ACORDO_ID,
      },
    },
  },
];

/**
 * Pré-visualização DEV (#269) — cards v1.11 / v1.10 como na lista do sino (sem CTA).
 *
 * @typedef {Readonly<{}>} DevNotifCards269CaptureProps
 */
export default function DevNotifCards269Capture() {
  return (
    <div
      className="min-h-dvh bg-background-light dark:bg-background-dark"
      data-testid="dev-notif-cards-269-capture"
    >
      <div className="mx-auto max-w-[390px]">
        <header className="px-5 py-4 border-b border-gray-100 dark:border-gray-800/50">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Notificações — #269
          </h1>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Mesma linha que o sheet do sino (sem navegação)
          </p>
        </header>
        <ul className="divide-y divide-gray-100 dark:divide-gray-800/50 bg-white dark:bg-slate-900">
          {FIXTURES.map(({ key, label, notif }) => (
            <React.Fragment key={key}>
              <li
                className="px-5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400"
                aria-hidden="true"
              >
                {label}
              </li>
              <NotificationListItem notif={notif} showKebab={false} />
            </React.Fragment>
          ))}
        </ul>
      </div>
    </div>
  );
}
