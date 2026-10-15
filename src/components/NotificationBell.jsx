import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, BellRing, BellOff } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { usePushNotifications } from '../hooks/usePushNotifications';
import {
  resolveNotificationListDestination,
  shouldNavigateOnListTap,
} from '../utils/notificationCatalog';
import { useAuth } from '../contexts/AuthContext';
import OverlayShell from './OverlayShell';
import SheetDragHandle from './SheetDragHandle';
import NotificationListItem from './NotificationListItem';
import NotificationListSkeleton from './NotificationListSkeleton';
import NotificationListErrorPanel from './NotificationListErrorPanel';
import { Button } from './ui/button';

export default function NotificationBell() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const {
    notifications,
    unreadCount,
    listLoading,
    listError,
    refetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications(userId);
  const refetchOnOpenDoneRef = useRef(false);
  const { isSupported, permission, isSubscribed, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications();
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return new URLSearchParams(window.location.search).get('notificacoes') === '1';
  });
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('notificacoes') !== '1') {
      return;
    }
    params.delete('notificacoes');
    const qs = params.toString();
    navigate(
      { pathname: location.pathname, search: qs ? `?${qs}` : '' },
      { replace: true },
    );
  }, [location.search, location.pathname, navigate]);

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

  useEffect(() => {
    if (!isOpen) {
      refetchOnOpenDoneRef.current = false;
      return;
    }
    if (listError && !refetchOnOpenDoneRef.current) {
      refetchOnOpenDoneRef.current = true;
      void refetchNotifications();
    }
  }, [isOpen, listError, refetchNotifications]);

  const handleNotificationClick = (notif) => {
    if (!notif.lida) {
      markAsRead(notif.id);
    }
    if (!shouldNavigateOnListTap(notif)) {
      return;
    }
    setIsOpen(false);
    const targetUrl = resolveNotificationListDestination(notif);
    if (targetUrl) {
      navigate(targetUrl);
    }
  };

  const hasLoadedList = notifications.length > 0;
  const showFullSkeleton = listLoading && !hasLoadedList;
  const showFullError = Boolean(listError) && !listLoading && !hasLoadedList;
  const showErrorBanner = Boolean(listError) && hasLoadedList;
  const listRefetching = listLoading && hasLoadedList;

  const handleRetry = () => {
    void refetchNotifications();
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
              {showFullSkeleton ? (
                <NotificationListSkeleton rows={3} />
              ) : (
                <>
                  {showErrorBanner ? (
                    <NotificationListErrorPanel
                      layout="banner"
                      retrying={listRefetching}
                      onRetry={handleRetry}
                    />
                  ) : null}
                  {showFullError ? (
                    <NotificationListErrorPanel
                      layout="full"
                      retrying={listLoading}
                      onRetry={handleRetry}
                    />
                  ) : null}
                  {!showFullError && notifications.length === 0 ? (
                    <div
                      className="flex flex-col items-center justify-center h-40 text-gray-500 dark:text-gray-400"
                      data-testid="notification-list-empty"
                    >
                      <Bell size={48} className="mb-4 opacity-20" strokeWidth={1.5} aria-hidden="true" />
                      <p className="text-sm">Sem notificações no momento.</p>
                    </div>
                  ) : null}
                  {hasLoadedList ? (
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
                  ) : null}
                </>
              )}
            </div>
          </div>
        </OverlayShell>
      ) : null}
    </div>
  );
}
