/** Títulos aprovados — cards de estado motorista (NOTIFICACOES_COPY v1.7–v1.12). */

export const NOTIF_TITULO_V1_7 = 'Ficou um lugar livre';

export const NOTIF_TITULO_V1_8 = 'Acordo encerrado';

export const NOTIF_TITULO_V1_12 = 'Ficou um lugar livre';

export const NOTIF_TITULO_V1_14 = 'Acordo encerrado';

export const NOTIF_BODY_V1_14_SEM_ROTA =
  'O motorista retirou-te do acordo, que foi encerrado.';

/**
 * @param {string} origem
 * @param {string} destino
 * @returns {string}
 */
export function notifBodyV114ComRota(origem, destino) {
  return `O motorista retirou-te do acordo ${origem} → ${destino}, que foi encerrado.`;
}

/** @param {'v1.7' | 'v1.8' | 'v1.12' | 'v1.14'} card */
export function tituloForNotificationCard(card) {
  switch (card) {
    case 'v1.7':
      return NOTIF_TITULO_V1_7;
    case 'v1.8':
      return NOTIF_TITULO_V1_8;
    case 'v1.14':
      return NOTIF_TITULO_V1_14;
    case 'v1.12':
      return NOTIF_TITULO_V1_12;
    default:
      return null;
  }
}
