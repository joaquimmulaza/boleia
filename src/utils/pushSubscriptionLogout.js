import { supabase } from '../lib/supabase';

/** @type {number} */
export const SW_OPERATION_TIMEOUT_MS = 3000;

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} [ms]
 * @returns {Promise<T | null>}
 */
function withTimeout(promise, ms = SW_OPERATION_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve(null), ms);
    }),
  ]);
}

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
    const registration = await withTimeout(navigator.serviceWorker.getRegistration());
    if (!registration) {
      return { success: true };
    }

    const subscription = await withTimeout(registration.pushManager.getSubscription());
    if (!subscription) {
      return { success: true };
    }

    const subscriptionJSON = subscription.toJSON();
    const endpoint = subscriptionJSON?.endpoint;

    let deleteErrorMessage = null;

    if (endpoint) {
      try {
        const { error: deleteError } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('subscription->>endpoint', endpoint)
          .select('id');

        if (deleteError) {
          deleteErrorMessage = deleteError.message;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        deleteErrorMessage = message;
      }
    }

    try {
      await subscription.unsubscribe();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[pushSubscriptionLogout] Falha ao unsubscribe local:', message);
      if (!deleteErrorMessage) {
        return { error: message };
      }
    }

    if (deleteErrorMessage) {
      return { error: deleteErrorMessage };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[pushSubscriptionLogout] Falha ao limpar subscrição:', message);
    return { error: message };
  }
}
