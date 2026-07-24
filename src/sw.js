import { precacheAndRoute } from 'workbox-precaching';

// Precaching injetado pelo VitePWA
precacheAndRoute(self.__WB_MANIFEST || []);

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

      event.waitUntil(self.registration.showNotification(title, options));
    } catch (e) {
      // Falha ao processar JSON, tratar como texto simples se possível
      const text = event.data.text();
      event.waitUntil(
        self.registration.showNotification('Boleia Certa', {
          body: text,
          icon: '/pwa-192x192.png',
        })
      );
    }
  }
});

// Utiliza a mesma estratégia escalável de Roteamento (Dicionário de Deep Linking)
import { resolveNotificationRoute } from './utils/notificationRouter';

self.addEventListener('notificationclick', function (event) {
  event.notification.close(); // Fecha a notificação nativa do SO

  // Usa o strategy map para determinar o URL
  // Aqui temos de reconstruir o objeto dummy que a `resolveNotificationRoute` espera
  const notifData = {
    metadata: event.notification.data?.metadata,
    link: event.notification.data?.url,
    mensagem: event.notification.body
  };

  const urlToOpen = resolveNotificationRoute(notifData);

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
    })
  );
});
