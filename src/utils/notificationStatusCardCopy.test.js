import { describe, it, expect } from 'vitest';
import {
  NOTIF_TITULO_V1_7,
  NOTIF_TITULO_V1_8,
  NOTIF_TITULO_V1_12,
  tituloForNotificationCard,
} from './notificationStatusCardCopy.js';

describe('notificationStatusCardCopy — títulos aprovados', () => {
  it('mapeia cards v1.7, v1.8 e v1.12', () => {
    expect(tituloForNotificationCard('v1.7')).toBe(NOTIF_TITULO_V1_7);
    expect(tituloForNotificationCard('v1.8')).toBe(NOTIF_TITULO_V1_8);
    expect(tituloForNotificationCard('v1.12')).toBe(NOTIF_TITULO_V1_12);
    expect(NOTIF_TITULO_V1_7).toBe('Ficou um lugar livre');
    expect(NOTIF_TITULO_V1_8).toBe('Acordo encerrado');
    expect(NOTIF_TITULO_V1_12).toBe('Ficou um lugar livre');
  });
});
