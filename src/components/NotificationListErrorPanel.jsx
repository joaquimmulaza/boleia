import React from 'react';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import {
  NOTIFICATION_LIST_LOAD_ERROR,
  NOTIFICATION_LIST_RETRY_BUTTON,
} from '../utils/notificationListCopy';

/** Margens laterais alinhadas à lista (`NotificationListItem` usa `px-5`). */
export const NOTIFICATION_LIST_ERROR_BANNER_SHELL_CLASS =
  'box-border w-full min-w-0 px-5 pt-2 pb-1';

/** Largura fluida — proibido `mx-*` / `w-[…]` fixo no Alert da faixa. */
export const NOTIFICATION_LIST_ERROR_BANNER_ALERT_CLASS =
  'box-border w-full min-w-0 max-w-full border-destructive/30 bg-destructive/5 dark:bg-destructive/10';

/**
 * Erro da lista do sino — faixa (com lista visível) ou ecrã inteiro.
 *
 * @param {{
 *   layout: 'banner' | 'full',
 *   retrying?: boolean,
 *   onRetry: () => void,
 * }} props
 */
export default function NotificationListErrorPanel({
  layout,
  retrying = false,
  onRetry,
}) {
  const isBanner = layout === 'banner';

  if (isBanner) {
    return (
      <div
        className={NOTIFICATION_LIST_ERROR_BANNER_SHELL_CLASS}
        data-testid="notification-list-error-banner-shell"
      >
        <Alert
          variant="destructive"
          className={NOTIFICATION_LIST_ERROR_BANNER_ALERT_CLASS}
          data-testid="notification-list-error-banner"
        >
          <AlertDescription className="flex min-w-0 flex-col gap-3">
            <p className="min-w-0 text-sm font-medium text-destructive dark:text-red-300">
              {NOTIFICATION_LIST_LOAD_ERROR}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 w-fit max-w-full shrink-0 gap-2 rounded-full px-4 text-sm font-semibold border-destructive/40"
            disabled={retrying}
            aria-busy={retrying}
            onClick={onRetry}
          >
            {retrying ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {NOTIFICATION_LIST_RETRY_BUTTON}
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center gap-3 h-40 px-6 text-center"
      data-testid="notification-list-error"
    >
      <Alert variant="destructive" className="w-full max-w-sm text-left">
        <AlertDescription className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm font-medium text-destructive dark:text-red-300">
            {NOTIFICATION_LIST_LOAD_ERROR}
          </p>
          <Button
            type="button"
            variant="outline"
            className="h-9 gap-2 rounded-full px-4 text-sm font-semibold"
            disabled={retrying}
            aria-busy={retrying}
            onClick={onRetry}
          >
            {retrying ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {NOTIFICATION_LIST_RETRY_BUTTON}
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
