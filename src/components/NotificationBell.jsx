import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle, Info, AlertCircle, X, BellRing, BellOff, Trash2 } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { resolveNotificationRoute } from '../utils/notificationRouter';
import { useAuth } from '../contexts/AuthContext';

const NotificationIcon = ({ type }) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'warning':
    case 'error':
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    case 'info':
    default:
      return <Info className="w-5 h-5 text-blue-500" />;
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
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll locking for mobile and portal
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleNotificationClick = (notif) => {
    if (!notif.lida) {
      markAsRead(notif.id);
    }
    setIsOpen(false);

    // Utiliza o Strategy Padrão de Roteamento (Escalabilidade de UX)
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
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors focus:outline-none"
        aria-label="Notificações"
        title="Notificações"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-gray-900">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Backdrop & Panel inside React Portal to escape stacking context */}
      {createPortal(
        <>
          <div 
            className={`fixed inset-0 z-overlay bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={() => setIsOpen(false)}
          />

          <div 
            className={`fixed top-0 right-0 h-dvh w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-drawer transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-slate-900 shrink-0">
              <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100 font-[Plus_Jakarta_Sans]">Notificações</h2>
              <div className="flex items-center gap-3">
                {isSupported && permission !== 'denied' && (
                  <button
                    onClick={handlePushToggle}
                    disabled={pushLoading}
                    className={`p-2 rounded-full transition-colors ${
                      isSubscribed
                        ? 'bg-primary/10 text-primary hover:bg-primary/20'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                    }`}
                    title={isSubscribed ? 'Desativar notificações push' : 'Ativar notificações push'}
                  >
                    {isSubscribed ? <BellRing size={16} /> : <BellOff size={16} />}
                  </button>
                )}
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {unreadCount > 0 && (
              <div className="px-5 py-3 bg-gray-50 dark:bg-slate-800/50 flex justify-end shrink-0">
                <button
                  onClick={markAllAsRead}
                  className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors pointer-events-auto"
                >
                  Marcar todas lidas
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto overscroll-none pb-24 sm:pb-28">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-500 dark:text-gray-400">
                  <Bell size={48} className="mb-4 opacity-20" />
                  <p className="text-sm">Sem notificações no momento.</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800/50">
                  {notifications.map((notif) => (
                    <li
                      key={notif.id} className={`flex items-start gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${
                        !notif.lida ? 'bg-primary/5 dark:bg-primary/10' : ''
                      }`}
                      onClick={() => handleNotificationClick(notif)}
                    >
                      <div className="mt-1 shrink-0">
                        <NotificationIcon type={notif.tipo} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!notif.lida ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'} font-[Plus_Jakarta_Sans] leading-relaxed`}>
                          {notif.mensagem}
                        </p>
                        <p className="mt-2 text-xs font-medium text-gray-400 dark:text-gray-500">
                          {formatTimeAgo(notif.created_at)}
                        </p>
                      </div>
                      {!notif.lida && (
                        <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 mt-1.5 shadow-sm" />
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notif.id);
                        }}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0 ml-1"
                        aria-label="Apagar notificação"
                        title="Apagar notificação"
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
