import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Utilitário para converter string Base64 em Uint8Array (necessário para a chave VAPID)
function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSupport = async () => {
      // Safely check for Notification to support happy-dom/jsdom testing environments
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      setIsSupported(supported);

      if (supported) {
        setPermission(Notification.permission);
        if (Notification.permission === 'granted') {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          setIsSubscribed(!!subscription);
        }
      }
      setLoading(false);
    };

    checkSupport();
  }, []);

  const subscribe = async (userId) => {
    if (!isSupported) return { error: 'Push notifications not supported on this browser' };

    setLoading(true);
    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        throw new Error('Permission denied for push notifications');
      }

      const registration = await navigator.serviceWorker.ready;

      const applicationServerKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!applicationServerKey) {
        throw new Error('VAPID Public Key not configured');
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(applicationServerKey)
      });

      // Guardar a subscrição na tabela da base de dados Supabase
      const subscriptionJSON = subscription.toJSON();

      const { error } = await supabase
        .from('push_subscriptions')
        .insert({
          user_id: userId,
          subscription: subscriptionJSON
        });

      if (error) {
        // Ignorar o erro de chave duplicada (já estava subscrito)
        if (error.code !== '23505') {
          throw error;
        }
      }

      setIsSubscribed(true);
      setLoading(false);
      return { success: true };
    } catch (err) {
      console.error('Failed to subscribe to push notifications:', err);
      setLoading(false);
      return { error: err.message };
    }
  };

  const unsubscribe = async (userId) => {
    if (!isSupported) return { error: 'Push notifications not supported on this browser' };

    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
         // Apagar na BD primeiro
         const subscriptionJSON = subscription.toJSON();

         if (userId) {
             await supabase
                .from('push_subscriptions')
                .delete()
                .eq('user_id', userId)
                .eq('subscription', JSON.stringify(subscriptionJSON));
         }

         // Anular no browser
         await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      setLoading(false);
      return { success: true };
    } catch (err) {
      console.error('Failed to unsubscribe from push notifications:', err);
      setLoading(false);
      return { error: err.message };
    }
  };

  return {
    isSupported,
    permission,
    isSubscribed,
    loading,
    subscribe,
    unsubscribe
  };
}
