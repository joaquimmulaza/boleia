import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing, BellOff } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { resolveNotificationRoute } from '../utils/notificationRouter';
import { useAuth } from '../contexts/AuthContext';
import OverlayShell from './OverlayShell';
import SheetDragHandle from './SheetDragHandle';
import NotificationListItem from './NotificationListItem';
import { Button } from './ui/button';

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
                  className="h-9 rounded-full px-4 text-sm font-bold border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
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
                    <NotificationListItem
                      key={notif.id}
                      notif={notif}
                      onActivate={() => handleNotificationClick(notif)}
                      onDelete={() => deleteNotification(notif.id)}
                    />
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
