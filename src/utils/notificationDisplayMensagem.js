import {
  JUSTA_CAUSA_PASSAGEIRO_INVOCADOR_NOTIF_TYPE,
  parseJustaCausaInvocadorNotifVariant,
  resolvePassageiroJustaCausaInvocadorNotifCopy,
  resolvePassageiroJustaCausaInvocadorNotifMensagem,
} from './passageiroJustaCausaInvocadorNotifCopy';

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
  const copy = resolveJustaCausaInvocadorCopyFromNotif(notif);
  if (copy) return copy.titulo;
  const titulo = notif?.metadata?.titulo;
  return typeof titulo === 'string' && titulo.trim() ? titulo.trim() : null;
}

/**
 * Mensagem apresentada no sino / push (substitui placeholders da BD).
 *
 * @param {{ mensagem?: string, metadata?: object | null }} notif
 * @returns {string}
 */
export function resolveNotificationMensagem(notif) {
  const copy = resolveJustaCausaInvocadorCopyFromNotif(notif);
  if (copy) return copy.corpo;

  const metadata = notif?.metadata;
  const type = metadata?.type;

  if (type === JUSTA_CAUSA_PASSAGEIRO_INVOCADOR_NOTIF_TYPE) {
    const variant = parseJustaCausaInvocadorNotifVariant(metadata);
    if (variant) {
      return resolvePassageiroJustaCausaInvocadorNotifMensagem({
        variant,
        lugarRescisaoEm: metadata.lugar_rescisao_em,
      });
    }
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
  const copy = resolveJustaCausaInvocadorCopyFromNotif(notif);
  if (copy) return copy.tipo;
  return notif?.tipo;
}
