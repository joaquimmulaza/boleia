import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle, Info, AlertCircle, X, BellRing, BellOff, Trash2 } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { supabase } from '../lib/supabase';
import { usePushNotifications } from '../hooks/usePushNotifications';

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
  const [userId, setUserId] = useState(null);
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications(userId);
  const { isSupported, permission, isSubscribed, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const handleNotificationClick = (notif) => {
    if (!notif.lida) {
      markAsRead(notif.id);
    }
    setIsOpen(false);

    // Bónus UX: Tentar usar link ou deduzir baseado no tipo/mensagem se não houver
    if (notif.link) {
      navigate(notif.link);
    } else if (notif.mensagem && notif.mensagem.toLowerCase().includes('motorista')) {
      navigate('/driver-dashboard');
    } else if (notif.mensagem && notif.mensagem.toLowerCase().includes('passageiro')) {
      navigate('/passenger-dashboard');
    } else if (notif.mensagem && (notif.mensagem.toLowerCase().includes('rota') || notif.mensagem.toLowerCase().includes('viagem'))) {
      navigate('/my-routes');
    } else {
      navigate('/my-agreements');
    }
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
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-gray-900">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 sm:w-96 origin-top-left rounded-xl bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 overflow-hidden flex flex-col max-h-[80vh]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-[Plus_Jakarta_Sans]">Notificações</h3>
            <div className="flex items-center gap-2">
              {isSupported && permission !== 'denied' && (
                <button
                  onClick={handlePushToggle}
                  disabled={pushLoading}
                  className={`p-1.5 rounded-full transition-colors ${
                    isSubscribed
                      ? 'bg-primary/10 text-primary hover:bg-primary/20'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                  }`}
                  title={isSubscribed ? 'Desativar notificações push' : 'Ativar notificações push'}
                >
                  {isSubscribed ? <BellRing size={14} /> : <BellOff size={14} />}
                </button>
              )}
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Marcar todas lidas
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                Sem notificações no momento.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {notifications.map((notif) => (
                  <li
                    key={notif.id} className={`flex items-start gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${
                      !notif.lida ? 'bg-primary/5 dark:bg-primary/10' : ''
                    }`}
                    onClick={() => handleNotificationClick(notif)}
                  >
                    <div className="mt-0.5 shrink-0">
                      <NotificationIcon type={notif.tipo} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notif.lida ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'} font-[Plus_Jakarta_Sans]`}>
                        {notif.mensagem}
                      </p>
                      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        {formatTimeAgo(notif.created_at)}
                      </p>
                    </div>
                    {!notif.lida && (
                      <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5 shadow-sm" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notif.id);
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0 ml-2"
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
      )}
    </div>
  );
}
