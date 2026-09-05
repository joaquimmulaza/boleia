/**
 * notificationRouter.js
 * Padrão Strategy/Dicionário para resolver as rotas de destino (deep links) das notificações.
 *
 * Cada tipo de notificação (baseado na coluna metadata.type do DB) tem uma função
 * que recebe o objeto metadata inteiro e retorna a URL correspondente (em string).
 *
 * Propostas A/B — `proposal_received`:
 * - inbox `passageiro` → sentido B (motorista criou) → hub /passageiro
 * - inbox `motorista` → sentido A (passageiro/grupo criou) → hub /motorista
 * - sem inbox (legado) → /motorista
 */

export const notificationRouteMap = {
  agreement_update: (metadata) => {
    return metadata?.acordo_id ? `/acordos?openAcordoId=${metadata.acordo_id}` : '/acordos';
  },
  /**
   * Deep link da contraparte (não do criador).
   * metadata.inbox: 'passageiro' (sentido B) | 'motorista' (sentido A).
   * Legado sem inbox → /motorista (era o único hub de propostas).
   */
  proposal_received: (metadata) => {
    const inbox = typeof metadata?.inbox === 'string' ? metadata.inbox.trim().toLowerCase() : '';
    if (inbox === 'passageiro') return '/passageiro';
    if (inbox === 'motorista') return '/motorista';
    return '/motorista';
  },
  waitlist_promoted: () => '/passageiro',
  match_available: () => '/passageiro',
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
  // Ignoramos '/dashboard' e '/' para não dar override na dedução por texto,
  // dado que a Edge Function os injeta como fallbacks hardcoded.
  if (notif?.link && notif.link !== '/dashboard' && notif.link !== '/') {
    return notif.link;
  }

  // 3. Fallback: Deduzir pelo texto (Retrocompatibilidade)
  if (notif?.mensagem) {
    const msg = notif.mensagem.toLowerCase();
    if (msg.includes('motorista')) return '/motorista';
    if (msg.includes('passageiro')) return '/passageiro';
    if (msg.includes('rota') || msg.includes('viagem')) return '/';
  }

  // 4. Fallback default
  return '/acordos';
};
