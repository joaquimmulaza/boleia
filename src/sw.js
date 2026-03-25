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
        badge: data.badge || '/favicon.svg',
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

// A Magia do UX: Clicar na notificação abre a PWA instantaneamente na rota adequada
self.addEventListener('notificationclick', function (event) {
  event.notification.close(); // Fecha a notificação no SO

  const urlToOpen = event.notification.data?.url || '/my-agreements';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se a app já estiver aberta, focá-la e navegar se possível
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
