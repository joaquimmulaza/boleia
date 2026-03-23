import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useAgreementNotifications(userId) {
  const [notification, setNotification] = useState(null);

  const clearNotification = useCallback(() => {
    setNotification(null);
  }, []);

  useEffect(() => {
    if (!userId) return;

    let timeoutId;

    const handlePayload = (payload) => {
      const estado = payload.new?.estado;
      if (estado === 'Ativo') {
        setNotification({ type: 'success', message: 'A tua boleia foi aceite!' });
      } else if (estado === 'Cancelado') {
        setNotification({ type: 'error', message: 'O teu pedido foi recusado.' });
      }

      if (estado === 'Ativo' || estado === 'Cancelado') {
        // Clear previous timeout if any
        if (timeoutId) clearTimeout(timeoutId);
        // Set timeout to clear notification after 6 seconds
        timeoutId = setTimeout(() => {
          setNotification(null);
        }, 6000);
      }
    };

    const channel = supabase.channel(`custom-filter-channel-${userId}`);

    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'acordos',
        filter: `passenger_id=eq.${userId}`,
      },
      handlePayload
    ).subscribe();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { notification, clearNotification };
}
