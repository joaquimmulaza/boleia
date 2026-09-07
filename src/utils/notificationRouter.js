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
 *
 * PACOTE ENG #16 — pagamento, adenda, renovação, liquidação → /acordos?openAcordoId&focus
 */

/** Estados de adenda que exigem foco na secção «Alteração de preço». */
const ADENDA_PENDENTE_ESTADOS = new Set([
  'pendente_passageiro',
  'pendente_contraparte',
  'pendente_motorista',
]);

/**
 * Deep link para detalhe de acordo com secção opcional.
 * @param {Record<string, unknown> | null | undefined} metadata
 * @param {string | null | undefined} focus pagamento | adenda | renovacao
 * @returns {string}
 */
export function acordosDeepLink(metadata, focus) {
  const params = new URLSearchParams();
  if (metadata?.acordo_id) {
    params.set('openAcordoId', String(metadata.acordo_id));
  }
  if (focus) {
    params.set('focus', focus);
  }
  const qs = params.toString();
  return qs ? `/acordos?${qs}` : '/acordos';
}

export const notificationRouteMap = {
  agreement_update: (metadata) => {
    const adendaEstado = String(metadata?.adenda_estado || '').toLowerCase();
    if (ADENDA_PENDENTE_ESTADOS.has(adendaEstado)) {
      return acordosDeepLink(metadata, 'adenda');
    }
    return acordosDeepLink(metadata, null);
  },
  adenda_pending: (metadata) => acordosDeepLink(metadata, 'adenda'),
  payment_update: (metadata) => acordosDeepLink(metadata, 'pagamento'),
  renewal_available: (metadata) => acordosDeepLink(metadata, 'renovacao'),
  payout_liquidated: (metadata) => acordosDeepLink(metadata, 'pagamento'),
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
