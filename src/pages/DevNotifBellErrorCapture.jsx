import React from 'react';
import NotificationListErrorPanel from '../components/NotificationListErrorPanel';
import { Button } from '../components/ui/button';

/**
 * DEV — erro ecrã inteiro sem lista (390px).
 *
 * @typedef {Readonly<{}>} DevNotifBellErrorCaptureProps
 */
export default function DevNotifBellErrorCapture() {
  return (
    <div
      className="min-h-dvh bg-background-light dark:bg-background-dark"
      data-testid="dev-notif-bell-error-capture"
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
        <NotificationListErrorPanel layout="full" retrying={false} onRetry={() => {}} />
      </div>
    </div>
  );
}
