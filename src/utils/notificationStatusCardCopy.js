/** Títulos aprovados — cards de estado motorista (NOTIFICACOES_COPY v1.7–v1.12). */

export const NOTIF_TITULO_V1_7 = 'Ficou um lugar livre';

export const NOTIF_TITULO_V1_8 = 'Acordo encerrado';

export const NOTIF_TITULO_V1_12 = 'Ficou um lugar livre';

/** @param {'v1.7' | 'v1.8' | 'v1.12'} card */
export function tituloForNotificationCard(card) {
  switch (card) {
    case 'v1.7':
      return NOTIF_TITULO_V1_7;
    case 'v1.8':
      return NOTIF_TITULO_V1_8;
    case 'v1.12':
      return NOTIF_TITULO_V1_12;
    default:
      return null;
  }
}
