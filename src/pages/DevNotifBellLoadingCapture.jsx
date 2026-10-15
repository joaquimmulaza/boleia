import React from 'react';
import NotificationListSkeleton from '../components/NotificationListSkeleton';
import { Button } from '../components/ui/button';

/**
 * Pré-visualização DEV — skeleton da lista do sino (390px).
 *
 * @typedef {Readonly<{}>} DevNotifBellLoadingCaptureProps
 */
export default function DevNotifBellLoadingCapture() {
  return (
    <div
      className="min-h-dvh bg-background-light dark:bg-background-dark"
      data-testid="dev-notif-bell-loading-capture"
    >
      <div className="mx-auto max-w-[390px] bg-white dark:bg-slate-900 shadow-2xl rounded-t-[34px] mt-8">
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-gray-300 dark:bg-gray-600" aria-hidden="true" />
        <div className="flex items-center justify-between px-5 pb-2 pt-3 shrink-0">
          <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Notificações
          </h2>
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-full px-4 text-sm font-bold border-input bg-background text-foreground"
          >
            Fechar
          </Button>
        </div>
        <div className="pb-safe">
          <NotificationListSkeleton rows={3} />
        </div>
      </div>
    </div>
  );
}
