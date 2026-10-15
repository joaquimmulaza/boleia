import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { setAppBadgeCount } from '../utils/appBadge';
import { NOTIFICATION_LIST_LOAD_ERROR } from '../utils/notificationListCopy';
import { getNotificationsDevFetchConfig } from '../utils/notificationsDevFetch';

export function useNotifications(userId) {
  const devFetchConfig = getNotificationsDevFetchConfig();
  const [notifications, setNotifications] = useState(() => devFetchConfig?.seed ?? []);
  const [unreadCount, setUnreadCount] = useState(() =>
    (devFetchConfig?.seed ?? []).filter((n) => !n.lida).length,
  );
  const [listLoading, setListLoading] = useState(() => {
    if (devFetchConfig?.seed?.length) {
      return false;
    }
    return Boolean(userId);
  });
  const [listError, setListError] = useState(null);
  const initialFetchSettledRef = useRef(Boolean(devFetchConfig?.seed?.length));
  const notificationsRef = useRef([]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const deleteNotification = useCallback(async (notificationId) => {
    try {
      const { error } = await supabase
        .from("notificacoes")
        .delete()
        .eq("id", notificationId);

      if (error) throw error;

      setNotifications((prev) => {
        const wasUnread = prev.find((n) => n.id === notificationId)?.lida === false;
        if (wasUnread) {
          setUnreadCount((count) => Math.max(0, count - 1));
        }
        return prev.filter((n) => n.id !== notificationId);
      });
    } catch (err) {
      console.error("Erro ao apagar notificação:", err);
    }
  }, []);

  /**
   * @param {{ showLoading?: boolean }} [options]
   */
  const fetchNotifications = useCallback(async (options = {}) => {
    const { showLoading = false } = options;
    if (!userId) return;
    const devCfg = getNotificationsDevFetchConfig();
    const isInitialLoad = !initialFetchSettledRef.current;
    const shouldShowLoading = isInitialLoad || showLoading;
    if (shouldShowLoading) {
      setListLoading(true);
    }
    try {
      if (devCfg?.forceFetchError) {
        throw new Error('DEV: fetch de notificações forçado a falhar');
      }
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
      setUnreadCount((data || []).filter(n => !n.lida).length);
      setListError(null);
    } catch (err) {
      console.error('Erro ao buscar notificações:', err);
      if (shouldShowLoading || notificationsRef.current.length > 0) {
        setListError(NOTIFICATION_LIST_LOAD_ERROR);
      }
    } finally {
      if (shouldShowLoading) {
        setListLoading(false);
      }
      if (isInitialLoad) {
        initialFetchSettledRef.current = true;
      }
    }
  }, [userId]);

  const refetchNotifications = useCallback(() => {
    return fetchNotifications({ showLoading: true });
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, lida: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Erro ao marcar notificação como lida:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('user_id', userId)
        .eq('lida', false);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, lida: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Erro ao marcar todas as notificações como lidas:', err);
    }
  }, [userId]);

  useEffect(() => {
    initialFetchSettledRef.current = false;
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setListLoading(false);
      setListError(null);
      return undefined;
    }
    const devCfgOnMount = getNotificationsDevFetchConfig();
    if (devCfgOnMount?.seed?.length) {
      setNotifications(devCfgOnMount.seed);
      setUnreadCount(devCfgOnMount.seed.filter((n) => !n.lida).length);
      initialFetchSettledRef.current = true;
      setListLoading(false);
      setListError(null);
    } else {
      setListLoading(true);
      setListError(null);
      fetchNotifications();
    }

    if (devCfgOnMount?.forceFetchError) {
      return undefined;
    }

    const channel = supabase.channel(`notificacoes-${userId}`);

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notificacoes',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          setNotifications(prev => [payload.new, ...prev]);
          if (!payload.new.lida) {
            setUnreadCount(prev => prev + 1);
          }
        } else if (payload.eventType === 'UPDATE') {
          setNotifications(prev =>
            prev.map(n => n.id === payload.new.id ? payload.new : n)
          );
          setUnreadCount(prev => {
             if (payload.old && payload.old.lida === false && payload.new.lida === true) {
                 return Math.max(0, prev - 1);
             }
             return prev;
          });
          fetchNotifications();
        } else if (payload.eventType === 'DELETE') {
           setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
           fetchNotifications();
        }
      }
    ).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchNotifications]);

  useEffect(() => {
    if (!userId) return;
    void setAppBadgeCount(unreadCount);
  }, [userId, unreadCount]);

  useEffect(() => {
    if (!userId) return;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [userId, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    listLoading,
    listError,
    refetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
}
