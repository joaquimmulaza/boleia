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
          setNotifications(prev =>
            prev.map(n => n.id === payload.new.id ? payload.new : n)
          );
          // Recalculate unread count
          setUnreadCount(prev => {
             // We can't easily derive from prev without full array,
             // but since we only update 'lida', if it went from false to true:
             if (payload.old && payload.old.lida === false && payload.new.lida === true) {
                 return Math.max(0, prev - 1);
             }
             // For safety, just refetch count or map it out. A full fetch is safer but costly.
             // We'll rely on our manual state updates for now, or just refetch.
             return prev;
          });
          // Better yet, just fetch all to be safe and accurate or handle it manually
          fetchNotifications();
        } else if (payload.eventType === 'DELETE') {
           setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
           fetchNotifications(); // Recalculate count
        }
      }
    ).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchNotifications]);

  return { notifications, unreadCount, markAsRead, markAllAsRead, fetchNotifications, deleteNotification };
}
