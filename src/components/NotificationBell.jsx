import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle, Info, AlertCircle, BellRing, BellOff } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { resolveNotificationRoute } from '../utils/notificationRouter';
import { useAuth } from '../contexts/AuthContext';
import OverlayShell from './OverlayShell';
import SheetDragHandle from './SheetDragHandle';
import NotificationRowKebab from './NotificationRowKebab';
import { Button } from './ui/button';

/**
 * @param {{ type?: string }} props
 */
const NotificationIcon = ({ type }) => {
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
};

const formatTimeAgo = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'agora mesmo';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} d`;
};

export default function NotificationBell() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications(userId);
  const { isSupported, permission, isSubscribed, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return undefined;

    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = 'unset';
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const handleNotificationClick = (notif) => {
    if (!notif.lida) {
      markAsRead(notif.id);
    }
    setIsOpen(false);

    const targetUrl = resolveNotificationRoute(notif);
    navigate(targetUrl);
  };

  const handlePushToggle = async () => {
    if (!userId) return;
    if (isSubscribed) {
      await unsubscribe(userId);
    } else {
      await subscribe(userId);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(true)}
        className="relative p-2 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
        aria-label="Notificações"
        title="Notificações"
      >
        <Bell size={20} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-gray-900">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen ? (
        <OverlayShell
          variant="bottom"
          onDismiss={() => setIsOpen(false)}
          overlayClassName="bg-black/50 backdrop-blur-sm"
          panelTestId="notification-panel"
          panelClassName="bg-white dark:bg-slate-900 shadow-2xl flex flex-col"
          testId="notification-backdrop"
        >
          <SheetDragHandle onDismiss={() => setIsOpen(false)} />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-sheet-title"
            className="flex max-h-[85dvh] flex-col"
          >
            <div className="flex items-center justify-between px-5 pb-2 pt-1 shrink-0">
              <h2 id="notification-sheet-title" className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                Notificações
              </h2>
              <div className="flex items-center gap-2">
                {isSupported && permission !== 'denied' ? (
                  <button
                    onClick={handlePushToggle}
                    disabled={pushLoading}
                    className={`p-2 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
                      isSubscribed
                        ? 'bg-primary/10 text-primary hover:bg-primary/20'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                    }`}
                    aria-label={isSubscribed ? 'Desativar notificações push' : 'Ativar notificações push'}
                    title={isSubscribed ? 'Desativar notificações push' : 'Ativar notificações push'}
                  >
                    {isSubscribed ? <BellRing size={16} strokeWidth={2} /> : <BellOff size={16} strokeWidth={2} />}
                  </button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-full px-4 text-sm font-bold text-slate-700 dark:text-slate-200"
                  onClick={() => setIsOpen(false)}
                >
                  Fechar
                </Button>
              </div>
            </div>

            {unreadCount > 0 ? (
              <div className="px-5 py-2 flex justify-start shrink-0">
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-sm font-semibold text-primary rounded-md hover:text-primary/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
                >
                  Marcar todas lidas
                </button>
              </div>
            ) : null}

            <div className="flex-1 overflow-y-auto overscroll-none pb-safe min-h-0">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-500 dark:text-gray-400">
                  <Bell size={48} className="mb-4 opacity-20" strokeWidth={1.5} aria-hidden="true" />
                  <p className="text-sm">Sem notificações no momento.</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800/50">
                  {notifications.map((notif) => (
                    <li
                      key={notif.id}
                      role="button"
                      aria-label={notif.mensagem}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleNotificationClick(notif);
                        }
                      }}
                      className={`flex items-start gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                        !notif.lida ? 'bg-primary/5 dark:bg-primary/10' : ''
                      }`}
                      onClick={() => handleNotificationClick(notif)}
                    >
                      <div className="mt-0.5 shrink-0">
                        <NotificationIcon type={notif.tipo} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-relaxed ${!notif.lida ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>
                          {notif.mensagem}
                        </p>
                        <p className="mt-1.5 text-xs font-medium text-gray-400 dark:text-gray-500">
                          {formatTimeAgo(notif.created_at)}
                        </p>
                      </div>
                      {!notif.lida ? (
                        <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2 shadow-sm" aria-hidden="true" />
                      ) : (
                        <div className="w-2 shrink-0" aria-hidden="true" />
                      )}
                      <NotificationRowKebab onDelete={() => deleteNotification(notif.id)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </OverlayShell>
      ) : null}
    </div>
  );
}
