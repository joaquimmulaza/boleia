import { describe, it, expect } from 'vitest';
import {
  NOTIF_TITULO_V1_7,
  NOTIF_TITULO_V1_8,
  NOTIF_TITULO_V1_12,
  NOTIF_TITULO_V1_14,
  NOTIF_BODY_V1_14_SEM_ROTA,
  notifBodyV114ComRota,
  tituloForNotificationCard,
} from './notificationStatusCardCopy.js';

describe('notificationStatusCardCopy — títulos aprovados', () => {
  it('copy v1.14 com e sem rota', () => {
    expect(NOTIF_BODY_V1_14_SEM_ROTA).toContain('encerrado');
    expect(notifBodyV114ComRota('Talatona', 'Belas Shopping')).toBe(
      'O motorista retirou-te do acordo Talatona → Belas Shopping, que foi encerrado.',
    );
    expect(tituloForNotificationCard('v1.14')).toBe(NOTIF_TITULO_V1_14);
  });

  it('mapeia cards v1.7, v1.8 e v1.12', () => {
    expect(tituloForNotificationCard('v1.7')).toBe(NOTIF_TITULO_V1_7);
    expect(tituloForNotificationCard('v1.8')).toBe(NOTIF_TITULO_V1_8);
    expect(tituloForNotificationCard('v1.12')).toBe(NOTIF_TITULO_V1_12);
    expect(NOTIF_TITULO_V1_7).toBe('Ficou um lugar livre');
    expect(NOTIF_TITULO_V1_8).toBe('Acordo encerrado');
    expect(NOTIF_TITULO_V1_12).toBe('Ficou um lugar livre');
  });
});
