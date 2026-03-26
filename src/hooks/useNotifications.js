import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const deleteNotification = useCallback(async (notificationId) => {
    try {
      const { error } = await supabase
        .from("notificacoes")
        .delete()
        .eq("id", notificationId);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setUnreadCount(prev => {
        const wasUnread = notifications.find(n => n.id === notificationId)?.lida === false;
        return wasUnread ? Math.max(0, prev - 1) : prev;
      });
    } catch (err) {
      console.error("Erro ao apagar notificação:", err);
    }
  }, [notifications]);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
      setUnreadCount((data || []).filter(n => !n.lida).length);
    } catch (err) {
      console.error('Erro ao buscar notificações:', err);
    }
  }, [userId]);

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
    if (!userId) return;

    fetchNotifications();

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
          setNotifications(prev => {
            const existing = prev.find(n => n.id === payload.new.id);
            if (existing) {
              // Recalculate unread count manually based on state change in current state vs payload
              if (existing.lida === false && payload.new.lida === true) {
                setUnreadCount(c => Math.max(0, c - 1));
              } else if (existing.lida === true && payload.new.lida === false) {
                setUnreadCount(c => c + 1);
              }
              return prev.map(n => n.id === payload.new.id ? payload.new : n);
            }
            return prev;
          });
        } else if (payload.eventType === 'DELETE') {
          setNotifications(prev => {
            const notificationToDelete = prev.find(n => n.id === payload.old.id);
            if (notificationToDelete && !notificationToDelete.lida) {
              setUnreadCount(c => Math.max(0, c - 1));
            }
            return prev.filter(n => n.id !== payload.old.id);
          });
        }
      }
    ).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchNotifications]);

  return { notifications, unreadCount, markAsRead, markAllAsRead, fetchNotifications, deleteNotification };
}
