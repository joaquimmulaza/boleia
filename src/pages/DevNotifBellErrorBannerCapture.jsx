import React from 'react';
import NotificationListItem from '../components/NotificationListItem';
import NotificationListErrorPanel from '../components/NotificationListErrorPanel';
import { Button } from '../components/ui/button';

const FIXTURE_CREATED_AT = '2026-10-12T08:00:00.000Z';

/**
 * DEV — faixa de erro com lista visível (390px).
 *
 * @typedef {Readonly<{}>} DevNotifBellErrorBannerCaptureProps
 */
export default function DevNotifBellErrorBannerCapture() {
  return (
    <div
      className="min-h-dvh bg-background-light dark:bg-background-dark"
      data-testid="dev-notif-bell-error-banner-capture"
    >
      <div className="mx-auto max-w-[390px] bg-white dark:bg-slate-900 shadow-2xl rounded-t-[34px] mt-8">
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-gray-300 dark:bg-gray-600" aria-hidden="true" />
        <div className="flex items-center justify-between px-5 pb-2 pt-3 shrink-0">
          <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Notificações
          </h2>
          <Button type="button" variant="outline" className="h-9 rounded-full px-4 text-sm font-bold">
            Fechar
          </Button>
        </div>
        <NotificationListErrorPanel layout="banner" retrying={false} onRetry={() => {}} />
        <ul className="divide-y divide-gray-100 dark:divide-gray-800/50 pb-safe">
          <NotificationListItem
            notif={{
              id: 'cap-n1',
              mensagem: 'Nova proposta recebida',
              tipo: 'info',
              lida: false,
              created_at: FIXTURE_CREATED_AT,
              metadata: { type: 'proposal_received', nome: 'Ana' },
            }}
            showKebab={false}
          />
          <NotificationListItem
            notif={{
              id: 'cap-n2',
              mensagem: 'Proposta aceite',
              tipo: 'success',
              lida: true,
              created_at: FIXTURE_CREATED_AT,
            }}
            showKebab={false}
          />
        </ul>
      </div>
    </div>
  );
}
