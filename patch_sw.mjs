import fs from 'fs';

const swPath = 'src/sw.js';
let content = fs.readFileSync(swPath, 'utf8');

const replacementClick = `// A Magia do UX: Clicar na notificação abre a PWA instantaneamente na rota adequada
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
});`;

const newClick = `// Utiliza a mesma estratégia escalável de Roteamento (Dicionário de Deep Linking)
import { resolveNotificationRoute } from './utils/notificationRouter';

self.addEventListener('notificationclick', function (event) {
  event.notification.close(); // Fecha a notificação nativa do SO

  // Usa o strategy map para determinar o URL
  // Aqui temos de reconstruir o objeto dummy que a \`resolveNotificationRoute\` espera
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
});`;

content = content.replace(replacementClick, newClick);
fs.writeFileSync(swPath, content);
