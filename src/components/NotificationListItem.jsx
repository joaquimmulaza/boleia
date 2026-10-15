import React from 'react';
import { CheckCircle, Info, AlertCircle } from 'lucide-react';
import NotificationRowKebab from './NotificationRowKebab';
import { resolveCatalogTitle } from '../utils/notificationCatalog';

/**
 * @param {{ type?: string }} props
 */
function NotificationIcon({ type }) {
  switch (type) {
    case 'success':
      return (
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" strokeWidth={2} aria-hidden="true" />
        </span>
      );
    case 'warning':
    case 'error':
      return (
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" strokeWidth={2} aria-hidden="true" />
        </span>
      );
    case 'info':
    default:
      return (
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" strokeWidth={2} aria-hidden="true" />
        </span>
      );
  }
}

/**
 * Título visível na lista (sem fallback «Boleia Certa» para notificações antigas).
 *
 * @param {{ metadata?: { titulo?: string }, mensagem?: string }} notif
 * @returns {string | null}
 */
function resolveListItemTitle(notif) {
  const metaTitulo = notif?.metadata?.titulo;
  if (typeof metaTitulo === 'string' && metaTitulo.trim()) {
    return metaTitulo.trim();
  }
  return resolveCatalogTitle(notif);
}

/**
 * Linha da lista de notificações (sino / sheet).
 *
 * @param {{
 *   notif: { id?: string, mensagem: string, tipo?: string, lida?: boolean, created_at?: string, metadata?: object },
 *   onActivate?: () => void,
 *   onDelete?: () => void,
 *   showKebab?: boolean,
 * }} props
 */
export default function NotificationListItem({
  notif,
  onActivate,
  onDelete,
  showKebab = true,
}) {
  const listTitle = resolveListItemTitle(notif);
  const showTitle = Boolean(listTitle);

  let timeLabel = 'agora mesmo';
  if (notif.created_at) {
    const date = new Date(notif.created_at);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) {
      timeLabel = 'agora mesmo';
    } else {
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) {
        timeLabel = `há ${minutes} min`;
      } else {
        const hours = Math.floor(minutes / 60);
        if (hours < 24) {
          timeLabel = `há ${hours} h`;
        } else {
          const days = Math.floor(hours / 24);
          timeLabel = `há ${days} d`;
        }
      }
    }
  }

  const rowLabel = showTitle ? `${listTitle}. ${notif.mensagem}` : notif.mensagem;

  return (
    <li
      role={onActivate ? 'button' : undefined}
      aria-label={onActivate ? rowLabel : undefined}
      tabIndex={onActivate ? 0 : undefined}
      onKeyDown={
        onActivate
          ? (e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onActivate();
              }
            }
          : undefined
      }
      className={`flex items-start gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors ${
        onActivate ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary focus-visible:ring-offset-0 dark:text-foreground' : ''
      } ${!notif.lida ? 'bg-primary/5 dark:bg-primary/10' : ''}`}
      onClick={onActivate}
    >
      <div className="mt-0.5 shrink-0">
        <NotificationIcon type={notif.tipo} />
      </div>
      <div className="flex-1 min-w-0 max-w-[390px]">
        {showTitle ? (
          <p
            className={`text-sm font-semibold leading-snug line-clamp-2 text-pretty ${
              !notif.lida
                ? 'text-gray-900 dark:text-gray-100'
                : 'text-gray-800 dark:text-gray-200'
            }`}
          >
            {listTitle}
          </p>
        ) : null}
        <p
          className={`text-sm leading-relaxed text-pretty ${
            showTitle
              ? 'mt-1 text-gray-600 dark:text-gray-400'
              : !notif.lida
                ? 'font-semibold text-gray-900 dark:text-gray-100'
                : 'text-gray-600 dark:text-gray-300'
          }`}
        >
          {notif.mensagem}
        </p>
        <p className="mt-1.5 text-xs font-medium text-gray-400 dark:text-gray-500">{timeLabel}</p>
      </div>
      {!notif.lida ? (
        <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2 shadow-sm" aria-hidden="true" />
      ) : (
        <div className="w-2 shrink-0" aria-hidden="true" />
      )}
      {showKebab && onDelete ? (
        <NotificationRowKebab onDelete={onDelete} />
      ) : (
        <div className="w-8 shrink-0" aria-hidden="true" />
      )}
    </li>
  );
}
