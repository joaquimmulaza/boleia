/**
 * notificationRouter.js
 * Padrão Strategy/Dicionário para resolver as rotas de destino (deep links) das notificações.
 *
 * Cada tipo de notificação (baseado na coluna metadata.type do DB) tem uma função
 * que recebe o objeto metadata inteiro e retorna a URL correspondente (em string).
 */

export const notificationRouteMap = {
  agreement_update: (metadata) => {
    // metadata.acordo_id deve estar presente
    return metadata?.acordo_id ? `/my-agreements?openAcordoId=${metadata.acordo_id}` : '/my-agreements';
  },
  // Facilmente expansível no futuro:
  // new_message: (metadata) => `/chat/${metadata.chat_id}`,
  // driver_arrived: (metadata) => `/route/${metadata.route_id}/tracking`,
};

/**
 * Resolve a URL de destino com base na notificação.
 *
 * @param {Object} notif - O objeto da notificação (deve conter a propriedade metadata)
 * @param {Object} notif.metadata - O objeto metadata vindo do DB/Push
 * @param {string} [notif.link] - Fallback hardcoded link caso exista (retrocompatibilidade)
 * @param {string} [notif.mensagem] - Mensagem para deduzir fallback (retrocompatibilidade)
 * @returns {string} - A URL resolvida.
 */
export const resolveNotificationRoute = (notif) => {
  // 1. Prioriza o sistema novo via Metadata (Strategy Map)
  if (notif?.metadata && notif.metadata.type) {
    const strategy = notificationRouteMap[notif.metadata.type];
    if (strategy) {
      return strategy(notif.metadata);
    }
  }

  // 2. Fallback: Se a notificação já tem um link direto no payload
  if (notif?.link) {
    return notif.link;
  }

  // 3. Fallback: Deduzir pelo texto (Retrocompatibilidade)
  if (notif?.mensagem) {
    const msg = notif.mensagem.toLowerCase();
    if (msg.includes('motorista')) return '/driver-dashboard';
    if (msg.includes('passageiro')) return '/passenger-dashboard';
    if (msg.includes('rota') || msg.includes('viagem')) return '/my-routes';
  }

  // 4. Fallback default
  return '/my-agreements';
};
