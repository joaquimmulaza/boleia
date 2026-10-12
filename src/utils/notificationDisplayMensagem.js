import {
  JUSTA_CAUSA_PASSAGEIRO_INVOCADOR_NOTIF_TYPE,
  JUSTA_CAUSA_PASSAGEIRO_INVOCADOR_SQL_PLACEHOLDER,
  parseJustaCausaInvocadorNotifVariant,
  resolvePassageiroJustaCausaInvocadorNotifCopy,
} from './passageiroJustaCausaInvocadorNotifCopy';

/**
 * @param {string | null | undefined} mensagem
 * @returns {boolean}
 */
function isJustaCausaInvocadorPlaceholder(mensagem) {
  const m = (mensagem || '').trim();
  return !m || m === JUSTA_CAUSA_PASSAGEIRO_INVOCADOR_SQL_PLACEHOLDER;
}

/**
 * @param {{ metadata?: object | null, lugarRescisaoEm?: string | null }} params
 * @returns {import('./passageiroJustaCausaInvocadorNotifCopy.js').PassageiroJustaCausaInvocadorNotifCopy | null}
 */
function resolveJustaCausaInvocadorCopyFromNotif(notif) {
  const metadata = notif?.metadata;
  if (metadata?.type !== JUSTA_CAUSA_PASSAGEIRO_INVOCADOR_NOTIF_TYPE) {
    return null;
  }
  const variant = parseJustaCausaInvocadorNotifVariant(metadata);
  if (!variant) return null;
  return resolvePassageiroJustaCausaInvocadorNotifCopy({
    variant,
    lugarRescisaoEm: metadata.lugar_rescisao_em,
  });
}

/**
 * Título apresentado no sino (quando aplicável).
 *
 * @param {{ mensagem?: string, metadata?: object | null, tipo?: string }} notif
 * @returns {string | null}
 */
export function resolveNotificationTitulo(notif) {
  const metadata = notif?.metadata;
  if (metadata?.type === JUSTA_CAUSA_PASSAGEIRO_INVOCADOR_NOTIF_TYPE) {
    const tituloMeta = metadata?.titulo;
    if (typeof tituloMeta === 'string' && tituloMeta.trim()) {
      return tituloMeta.trim();
    }
    const copy = resolveJustaCausaInvocadorCopyFromNotif(notif);
    if (copy) return copy.titulo;
  }

  const titulo = notif?.metadata?.titulo;
  return typeof titulo === 'string' && titulo.trim() ? titulo.trim() : null;
}

/**
 * Mensagem apresentada no sino / push (fallback só para linhas legacy com placeholder).
 *
 * @param {{ mensagem?: string, metadata?: object | null }} notif
 * @returns {string}
 */
export function resolveNotificationMensagem(notif) {
  const metadata = notif?.metadata;

  if (metadata?.type === JUSTA_CAUSA_PASSAGEIRO_INVOCADOR_NOTIF_TYPE) {
    if (!isJustaCausaInvocadorPlaceholder(notif?.mensagem)) {
      return notif.mensagem;
    }
    const copy = resolveJustaCausaInvocadorCopyFromNotif(notif);
    if (copy) return copy.corpo;
  }

  return notif?.mensagem || '';
}

/**
 * Tipo visual (ícone) — pode sobrepor `notif.tipo` da BD.
 *
 * @param {{ metadata?: object | null, tipo?: string }} notif
 * @returns {string | undefined}
 */
export function resolveNotificationTipo(notif) {
  if (notif?.metadata?.type === JUSTA_CAUSA_PASSAGEIRO_INVOCADOR_NOTIF_TYPE) {
    return notif?.tipo || 'info';
  }
  return notif?.tipo;
}
