import {
  JUSTA_CAUSA_PASSAGEIRO_INVOCADOR_NOTIF_TYPE,
  parseJustaCausaInvocadorNotifVariant,
  resolvePassageiroJustaCausaInvocadorNotifMensagem,
} from './passageiroJustaCausaInvocadorNotifCopy';

/**
 * Mensagem apresentada no sino / push (substitui placeholders da BD).
 *
 * @param {{ mensagem?: string, metadata?: object | null }} notif
 * @returns {string}
 */
export function resolveNotificationMensagem(notif) {
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
