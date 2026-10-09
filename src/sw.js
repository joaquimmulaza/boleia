import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { drainQueue, OFFLINE_SYNC_TAG } from './services/offlineQueue';
import { resolveNotificationRoute } from './utils/notificationRouter';
import { sanitizeNotificationLink } from './utils/safeNotificationLink';
import { networkFirstRuntime } from './utils/swNetworkFirst.js';
import { SW_RUNTIME_CACHE_NAME } from './utils/swRuntimeCache.js';

// Precaching injetado pelo VitePWA
precacheAndRoute(self.__WB_MANIFEST || []);

/**
 * Network-first para GET JSON de listagens PostgREST (acordos / grupos):
 * resposta de rede quando online; RUNTIME_CACHE só como fallback offline.
 */
registerRoute(
  ({ url, request }) => {
    if (request.method !== 'GET') return false;
    if (!url.hostname.includes('supabase')) return false;
    if (!url.pathname.includes('/rest/v1/')) return false;
    const path = url.pathname;
    return path.includes('/acordos') || path.includes('/grupos');
  },
  ({ request }) => networkFirstRuntime(request, SW_RUNTIME_CACHE_NAME),
);

// Permite acionar a atualização imediata quando o utilizador clica em "Atualizar agora"
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'DRAIN_OFFLINE_QUEUE') {
    event.waitUntil(drainQueue());
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === OFFLINE_SYNC_TAG) {
    event.waitUntil(
      drainQueue().then(async (summary) => {
        const clients = await self.clients.matchAll({ type: 'window' });
        for (const client of clients) {
          client.postMessage({
            type: 'OFFLINE_SYNC_COMPLETE',
            summary,
          });
        }
        for (const conflict of summary.conflicts || []) {
          await self.registration.showNotification('Boleia Certa', {
            body:
              'Um pedido offline encontrou conflito ao sincronizar. Abre a app para rever o acordo.',
            icon: '/pwa-192x192.png',
            data: { url: '/acordos' },
          });
          void conflict;
        }
      }),
    );
  }
});

// Lidar com notificações push recebidas
self.addEventListener('push', function (event) {
  if (event.data) {
    try {
      const data = event.data.json();

      const title = data.title || 'Boleia Certa';
      const options = {
        body: data.body || 'Nova notificação recebida.',
        icon: data.icon || '/pwa-192x192.png',
        badge: data.badge || '/pwa-512x512.png',
        data: data.data || { url: '/' },
        vibrate: [100, 50, 100],
      };

      const unreadCount = data.data?.unreadCount;
      const showPromise = self.registration.showNotification(title, options);
      const badgePromise =
        typeof unreadCount === 'number' && 'setAppBadge' in self
          ? unreadCount > 0
            ? self.setAppBadge(unreadCount)
            : self.clearAppBadge?.() ?? self.setAppBadge(0)
          : Promise.resolve();

      event.waitUntil(Promise.all([showPromise, badgePromise]));
    } catch {
      // Falha ao processar JSON, tratar como texto simples se possível
      const text = event.data.text();
      event.waitUntil(
        self.registration.showNotification('Boleia Certa', {
          body: text,
          icon: '/pwa-192x192.png',
        }),
      );
    }
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close(); // Fecha a notificação nativa do SO

  // Usa o strategy map para determinar o URL
  // Aqui temos de reconstruir o objeto dummy que a `resolveNotificationRoute` espera
  const notifData = {
    metadata: event.notification.data?.metadata,
    link: event.notification.data?.url,
    mensagem: event.notification.body,
  };

  const urlToOpen = sanitizeNotificationLink(resolveNotificationRoute(notifData), '/');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se a app já estiver aberta, focá-la e navegar usando client.navigate
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url && 'focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(urlToOpen);
          }
          return;
        }
      }
      // Caso contrário, abre uma nova janela
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    }),
  );
});
