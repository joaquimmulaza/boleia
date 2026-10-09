import { supabase } from '../lib/supabase';

/**
 * Remove a subscrição push do dispositivo actual na BD e no browser.
 * Deve correr antes de `signOut` para manter RLS com sessão activa.
 * @param {string | null | undefined} userId
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function removeCurrentDevicePushSubscription(userId) {
  if (typeof window === 'undefined' || !('PushManager' in window) || !('serviceWorker' in navigator)) {
    return { success: true };
  }

  if (!userId) {
    return { success: true };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      return { success: true };
    }

    const subscriptionJSON = subscription.toJSON();
    const endpoint = subscriptionJSON?.endpoint;

    if (endpoint) {
      const { error: deleteError } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('subscription->>endpoint', endpoint)
        .select('id');

      if (deleteError) {
        return { error: deleteError.message };
      }
    }

    await subscription.unsubscribe();
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[pushSubscriptionLogout] Falha ao limpar subscrição:', message);
    return { error: message };
  }
}
