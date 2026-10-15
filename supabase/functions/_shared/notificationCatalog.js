/**
 * Catálogo único: tipo/caso → título → destino (push e lista).
 * JS puro ESM — sem Deno, browser ou React.
 */

import { sanitizeNotificationLink } from './safeNotificationLink.js';

export {
  sanitizeNotificationLink,
  isSafeInternalNotificationPath,
  isSafeNormalizedInternalPath,
  hasUnsafeNotificationLinkChars,
  resolvePushNotificationUrl,
  resolvePushDataUrl,
  INTERNAL_NOTIFICATION_URL_BASE,
  UNSAFE_NOTIFICATION_LINK_CHARS_RE,
} from './safeNotificationLink.js';

/** Fallback de título push/lista (copy v1). */
export const FALLBACK_NOTIFICATION_TITLE = 'Boleia Certa';

/** Query para abrir o sino (tipo desconhecido / destino inválido no push). */
export const NOTIFICATIONS_BELL_OPEN_QUERY = 'notificacoes=1';

export const NOTIFICATIONS_BELL_OPEN_PATH = `/?${NOTIFICATIONS_BELL_OPEN_QUERY}`;

const KNOWN_METADATA_TYPES = new Set([
  'proposal_received',
  'proposal_cancelled',
  'proposal_invalidated',
  'agreement_update',
  'payment_update',
  'renewal_available',
  'reserva_expirada',
  'payout_liquidated',
  'waitlist_promoted',
  'status',
  'adenda_pending',
  'match_available',
]);

const ADENDA_PENDENTE_ESTADOS = new Set([
  'pendente_passageiro',
  'pendente_contraparte',
  'pendente_motorista',
]);

const MESES_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/**
 * @param {unknown} mesRef
 * @returns {string | null}
 */
export function formatMesReferenciaPt(mesRef) {
  if (mesRef == null || String(mesRef).trim() === '') {
    return null;
  }
  const m = String(mesRef).match(/(\d{4})-(\d{2})/);
  if (!m) {
    return null;
  }
  const idx = parseInt(m[2], 10) - 1;
  if (idx < 0 || idx > 11) {
    return null;
  }
  return MESES_PT[idx];
}

/**
 * @param {Record<string, unknown> | null | undefined} metadata
 * @returns {string | null}
 */
function metadataNome(metadata) {
  const keys = ['nome', 'nome_passageiro', 'nome_motorista', 'passageiro_nome', 'motorista_nome'];
  for (const k of keys) {
    const v = metadata?.[k];
    if (typeof v === 'string' && v.trim()) {
      return v.trim();
    }
  }
  return null;
}

/**
 * @param {string | null | undefined} template
 * @param {{ nome?: string | null, mes?: string | null, valor?: string | null }} ctx
 * @returns {string | null}
 */
function applyTitleTemplate(template, ctx) {
  if (!template) {
    return null;
  }
  let out = template;
  if (ctx.nome) {
    out = out.replace(/\{nome\}/g, ctx.nome);
  }
  if (ctx.mes) {
    out = out.replace(/\{mes\}/g, ctx.mes);
  }
  if (ctx.valor) {
    out = out.replace(/\{valor\}/g, ctx.valor);
  }
  if (/\{(nome|mes|valor)\}/.test(out)) {
    return null;
  }
  return out;
}

/**
 * @param {{ metadata?: Record<string, unknown>, mensagem?: string }} notif
 * @returns {boolean}
 */
export function isKnownNotificationType(notif) {
  const type = notif?.metadata?.type;
  return typeof type === 'string' && KNOWN_METADATA_TYPES.has(type);
}

/**
 * @param {Record<string, unknown> | null | undefined} metadata
 * @param {string | null | undefined} focus
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

/**
 * @param {Record<string, unknown> | null | undefined} metadata
 * @returns {string}
 */
export function propostaHubDeepLink(metadata) {
  const inbox = typeof metadata?.inbox === 'string' ? metadata.inbox.trim().toLowerCase() : '';
  const params = new URLSearchParams();
  params.set('focus', 'propostas');
  if (metadata?.proposta_id) {
    params.set('propostaId', String(metadata.proposta_id));
  }
  if (metadata?.oferta_id) {
    params.set('openOfertaId', String(metadata.oferta_id));
  }
  const qs = params.toString();
  const base = inbox === 'passageiro' ? '/passageiro' : '/motorista';
  return qs ? `${base}?${qs}` : base;
}

/**
 * @param {Record<string, unknown> | null | undefined} metadata
 * @returns {string}
 */
export function statusCardDeepLink(metadata) {
  return acordosDeepLink(metadata, null);
}

/**
 * @param {string | undefined} msg
 * @returns {boolean}
 */
function isMotoristaPaymentMessage(msg) {
  if (!msg) {
    return false;
  }
  const m = msg.toLowerCase();
  return m.includes('pagamento de passageiro')
    || m.includes('pagamento liquidado')
    || m.includes('repasse registado');
}

/**
 * @param {string | undefined} msg
 * @returns {string | null}
 */
function agreementUpdateFocus(msg, metadata) {
  const adendaEstado = String(metadata?.adenda_estado || '').toLowerCase();
  if (ADENDA_PENDENTE_ESTADOS.has(adendaEstado)) {
    return 'preco-proximo-mes';
  }
  if (String(metadata?.rescisao_modo || '').toLowerCase() === 'consensual') {
    return 'rescisao';
  }
  if (msg && /acordo formado|lugar está reservado|lugar esta reservado/i.test(msg)) {
    return 'pagamento';
  }
  return null;
}

/**
 * @param {{ metadata?: Record<string, unknown>, mensagem?: string }} notif
 * @returns {string | null}
 */
function resolveAgreementUpdateTitle(notif) {
  const metadata = notif.metadata || {};
  const msg = notif.mensagem || '';
  const nome = metadataNome(metadata);
  const ctx = { nome, mes: formatMesReferenciaPt(metadata.mes_referencia), valor: null };

  const adendaEstado = String(metadata.adenda_estado || '').toLowerCase();
  if (ADENDA_PENDENTE_ESTADOS.has(adendaEstado)) {
    return 'Nova proposta de preço';
  }
  if (adendaEstado === 'aceite' || adendaEstado === 'aceite_agendada') {
    return 'Proposta de preço aceite';
  }
  if (adendaEstado === 'rejeitada') {
    return 'Proposta de preço recusada';
  }
  if (adendaEstado === 'cancelada_iniciador') {
    return 'Proposta de preço anulada';
  }

  const rescisaoModo = String(metadata.rescisao_modo || '').toLowerCase();
  if (rescisaoModo === 'consensual') {
    if (/confirmado|mantém-se activo até/i.test(msg)) {
      return 'Encerramento confirmado';
    }
    return applyTitleTemplate('{nome} pediu para encerrar o acordo', ctx) || 'Pedido de encerramento';
  }
  if (rescisaoModo === 'aviso_previo' || /aviso prévio|aviso previo/i.test(msg)) {
    return 'Aviso prévio: o acordo vai terminar';
  }
  if (/rescindiu o acordo por justa causa/i.test(msg)) {
    return 'Acordo terminado por justa causa';
  }
  if (/recusou o pedido de encerramento|recusou a proposta de preço/i.test(msg)) {
    return 'Pedido de encerramento recusado';
  }
  if (/Encerramento amigável confirmado|Encerramento confirmado/i.test(msg)) {
    return 'Encerramento confirmado';
  }
  if (/Novo acordo activo|Novo acordo ativo/i.test(msg)) {
    return 'Novo acordo';
  }
  if (/Acordo formado|lugar está reservado|lugar esta reservado/i.test(msg)) {
    return 'Acordo formado: lugar reservado';
  }
  if (/saiu do acordo\. Ficou um lugar livre|Um passageiro saiu do acordo/i.test(msg)) {
    return applyTitleTemplate('{nome} saiu do acordo', ctx) || 'Um passageiro saiu do acordo';
  }
  if (/Reserva de .+ expirou/i.test(msg)) {
    return applyTitleTemplate('Reserva de {nome} expirou', ctx) || 'Uma reserva expirou';
  }
  if (/não foi renovado|aviso prévio.*chegou ao fim|Acordo terminado/i.test(msg)) {
    return 'Acordo terminado';
  }
  if (/cancelado|foi cancelado|encerrado/i.test(msg)) {
    return 'Acordo cancelado';
  }
  return null;
}

/**
 * @param {{ metadata?: Record<string, unknown>, mensagem?: string }} notif
 * @returns {string | null}
 */
function resolvePaymentUpdateTitle(notif) {
  const metadata = notif.metadata || {};
  const msg = notif.mensagem || '';
  const nome = metadataNome(metadata);
  const mes = formatMesReferenciaPt(metadata.mes_referencia);
  const ctx = { nome, mes, valor: null };

  if (/Comprovativo rejeitado/i.test(msg)) {
    return 'Comprovativo rejeitado';
  }
  if (/Pagamento mensal disponível|Pagamento mensal disponivel/i.test(msg)) {
    if (mes) {
      return `Pagamento de ${mes} disponível`;
    }
    return 'Pagamento mensal disponível';
  }
  if (/Pagamento validado|em custódia|em custodia/i.test(msg)) {
    if (isMotoristaPaymentMessage(msg)) {
      return applyTitleTemplate('Pagamento de {nome} validado', ctx) || 'Pagamento validado';
    }
    return 'Pagamento validado';
  }
  return null;
}

/**
 * @param {{ metadata?: Record<string, unknown>, mensagem?: string }} notif
 * @returns {string | null}
 */
function resolveStatusTitle(notif) {
  const metadata = notif.metadata || {};
  const card = String(metadata.card || '').toLowerCase();
  const reason = String(metadata.reason || '').toLowerCase();

  if (typeof metadata.titulo === 'string' && metadata.titulo.trim()) {
    return metadata.titulo.trim();
  }
  if (card === 'v1.10') {
    return 'Já não fazes parte deste acordo';
  }
  if (card === 'v1.11') {
    return 'Acordo encerrado';
  }
  if (reason === 'last_passenger_left' || /último passageiro saiu|ultimo passageiro saiu/i.test(notif.mensagem || '')) {
    return 'Acordo encerrado';
  }
  return null;
}

/**
 * @param {{ metadata?: Record<string, unknown>, mensagem?: string, link?: string }} notif
 * @returns {string | null} título ou null → caller usa FALLBACK
 */
export function resolveCatalogTitle(notif) {
  const type = notif?.metadata?.type;
  if (typeof type !== 'string' || !KNOWN_METADATA_TYPES.has(type)) {
    return null;
  }

  const metadata = notif.metadata || {};
  if (typeof metadata.titulo === 'string' && metadata.titulo.trim()) {
    return metadata.titulo.trim();
  }

  const nome = metadataNome(metadata);
  const ctx = { nome, mes: formatMesReferenciaPt(metadata.mes_referencia), valor: null };

  switch (type) {
    case 'proposal_received':
      return applyTitleTemplate('Nova proposta de {nome}', ctx) || 'Nova proposta';
    case 'proposal_cancelled':
      return 'Proposta sem efeito';
    case 'proposal_invalidated':
      return 'A proposta já não corresponde';
    case 'renewal_available':
      return 'Renovação disponível';
    case 'reserva_expirada':
      return 'A tua reserva expirou';
    case 'waitlist_promoted':
      return 'Abriu-se um lugar numa oferta';
    case 'payment_update':
      return resolvePaymentUpdateTitle(notif);
    case 'payout_liquidated': {
      const valor = metadata.valor_repasse_kz ?? metadata.valor ?? metadata.valor_liquido_kz;
      if (valor != null && String(valor).trim() !== '') {
        const valorFmt = String(valor).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        return applyTitleTemplate('Recebeste {valor} Kz', { ...ctx, valor: valorFmt });
      }
      return 'Recebeste um pagamento';
    }
    case 'agreement_update':
      return resolveAgreementUpdateTitle(notif);
    case 'status':
      return resolveStatusTitle(notif);
    case 'adenda_pending':
      return 'Nova proposta de preço';
    case 'match_available':
      return null;
    default:
      return null;
  }
}

/**
 * Destino bruto (antes de sanitize) para tipos conhecidos.
 *
 * @param {{ metadata?: Record<string, unknown>, mensagem?: string }} notif
 * @returns {string | null}
 */
export function resolveCatalogRawDestination(notif) {
  const type = notif?.metadata?.type;
  if (typeof type !== 'string' || !KNOWN_METADATA_TYPES.has(type)) {
    return null;
  }
  const metadata = notif.metadata || {};
  const msg = notif.mensagem || '';

  switch (type) {
    case 'proposal_received':
    case 'proposal_cancelled':
    case 'proposal_invalidated':
      return propostaHubDeepLink(metadata);
    case 'waitlist_promoted':
    case 'match_available':
      return '/passageiro';
    case 'reserva_expirada':
      return acordosDeepLink(metadata, null);
    case 'renewal_available':
      return acordosDeepLink(metadata, 'renovacao');
    case 'payout_liquidated':
      return acordosDeepLink(metadata, 'motorista-pagamentos');
    case 'payment_update':
      if (isMotoristaPaymentMessage(msg)) {
        return acordosDeepLink(metadata, 'motorista-pagamentos');
      }
      return acordosDeepLink(metadata, 'pagamento');
    case 'agreement_update':
      return acordosDeepLink(metadata, agreementUpdateFocus(msg, metadata));
    case 'status':
      return statusCardDeepLink(metadata);
    case 'adenda_pending':
      return acordosDeepLink(metadata, 'preco-proximo-mes');
    default:
      return null;
  }
}

/**
 * @param {{ metadata?: Record<string, unknown>, mensagem?: string, link?: string }} notif
 * @returns {string}
 */
function resolveLegacyDestination(notif) {
  if (notif?.link && notif.link !== '/dashboard' && notif.link !== '/') {
    const fromLink = sanitizeNotificationLink(notif.link, '');
    if (fromLink) {
      return fromLink;
    }
  }
  if (notif?.mensagem) {
    const lower = notif.mensagem.toLowerCase();
    if (lower.includes('motorista')) {
      return '/motorista';
    }
    if (lower.includes('passageiro')) {
      return '/passageiro';
    }
    if (lower.includes('rota') || lower.includes('viagem')) {
      return '/';
    }
  }
  return '/acordos';
}

/**
 * Título para push e lista (paridade obrigatória).
 *
 * @param {{ metadata?: Record<string, unknown>, mensagem?: string }} notif
 * @returns {string}
 */
export function resolveNotificationTitle(notif) {
  const fromCatalog = resolveCatalogTitle(notif);
  if (fromCatalog) {
    return fromCatalog;
  }
  const metaTitulo = notif?.metadata?.titulo;
  if (typeof metaTitulo === 'string' && metaTitulo.trim()) {
    return metaTitulo.trim();
  }
  return FALLBACK_NOTIFICATION_TITLE;
}

/**
 * Destino ao tocar na lista. `null` = só marcar lida (sem navegar).
 *
 * @param {{ metadata?: Record<string, unknown>, mensagem?: string, link?: string }} notif
 * @returns {string | null}
 */
export function resolveNotificationListDestination(notif) {
  const type = notif?.metadata?.type;
  if (typeof type === 'string' && type.trim() && !KNOWN_METADATA_TYPES.has(type)) {
    return null;
  }

  const raw = resolveCatalogRawDestination(notif);
  if (raw) {
    const safe = sanitizeNotificationLink(raw, '');
    return safe || null;
  }

  if (typeof type === 'string' && type.trim()) {
    return null;
  }

  return sanitizeNotificationLink(resolveLegacyDestination(notif), '/acordos');
}

/**
 * Destino no payload push / notificationclick.
 *
 * @param {{ metadata?: Record<string, unknown>, mensagem?: string, link?: string }} notif
 * @returns {string}
 */
export function resolveNotificationPushDestination(notif) {
  const type = notif?.metadata?.type;
  if (typeof type === 'string' && type.trim() && !KNOWN_METADATA_TYPES.has(type)) {
    return sanitizeNotificationLink(NOTIFICATIONS_BELL_OPEN_PATH, '/');
  }

  const raw = resolveCatalogRawDestination(notif);
  if (raw) {
    const safe = sanitizeNotificationLink(raw, '');
    if (safe) {
      return safe;
    }
    return sanitizeNotificationLink(NOTIFICATIONS_BELL_OPEN_PATH, '/');
  }

  if (typeof type === 'string' && type.trim()) {
    return sanitizeNotificationLink(NOTIFICATIONS_BELL_OPEN_PATH, '/');
  }

  const legacy = resolveLegacyDestination(notif);
  const safeLegacy = sanitizeNotificationLink(legacy, '');
  if (safeLegacy) {
    return safeLegacy;
  }
  return sanitizeNotificationLink(NOTIFICATIONS_BELL_OPEN_PATH, '/');
}

/** Mapa de rotas (compatibilidade com notificationRouter). */
export const notificationRouteMap = {
  agreement_update: (metadata) => {
    const adendaEstado = String(metadata?.adenda_estado || '').toLowerCase();
    if (ADENDA_PENDENTE_ESTADOS.has(adendaEstado)) {
      return acordosDeepLink(metadata, 'preco-proximo-mes');
    }
    if (String(metadata?.rescisao_modo || '').toLowerCase() === 'consensual') {
      return acordosDeepLink(metadata, 'rescisao');
    }
    return acordosDeepLink(metadata, null);
  },
  adenda_pending: (metadata) => acordosDeepLink(metadata, 'preco-proximo-mes'),
  payment_update: (metadata) => acordosDeepLink(metadata, 'pagamento'),
  renewal_available: (metadata) => acordosDeepLink(metadata, 'renovacao'),
  payout_liquidated: (metadata) => acordosDeepLink(metadata, 'motorista-pagamentos'),
  proposal_received: (metadata) => propostaHubDeepLink(metadata),
  proposal_invalidated: (metadata) => propostaHubDeepLink(metadata),
  proposal_cancelled: (metadata) => propostaHubDeepLink(metadata),
  waitlist_promoted: () => '/passageiro',
  match_available: () => '/passageiro',
  status: (metadata) => statusCardDeepLink(metadata),
  reserva_expirada: (metadata) => acordosDeepLink(metadata, null),
};

/**
 * @param {{ metadata?: Record<string, unknown>, mensagem?: string, link?: string }} notif
 * @returns {string}
 */
export function resolveNotificationRoute(notif) {
  const dest = resolveNotificationListDestination(notif);
  if (dest) {
    return dest;
  }
  return '/acordos';
}

/**
 * @param {{ metadata?: Record<string, unknown>, mensagem?: string, link?: string }} notif
 * @returns {boolean}
 */
export function shouldNavigateOnListTap(notif) {
  return resolveNotificationListDestination(notif) != null;
}
