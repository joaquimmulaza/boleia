import { describe, it, expect } from 'vitest';
import {
  JUSTA_CAUSA_PASSAGEIRO_INVOCADOR_NOTIF_TYPE,
  resolvePassageiroJustaCausaInvocadorNotifMensagem,
} from './passageiroJustaCausaInvocadorNotifCopy';
import { resolveNotificationMensagem } from './notificationDisplayMensagem';

describe('notificação in-app — passageiro invocador justa causa', () => {
  const acordoId = 'a5555555-5555-4555-8555-555555555555';
  const lugarRescisaoEm = '2026-10-12T10:00:00.000Z';

  it('tipo metadata estável para SQL e sino', () => {
    expect(JUSTA_CAUSA_PASSAGEIRO_INVOCADOR_NOTIF_TYPE).toBe(
      'justa_causa_passageiro_invocador',
    );
  });

  it('variante parcial — copy pós-acção (interim; TODO Copywriter)', () => {
    const msg = resolvePassageiroJustaCausaInvocadorNotifMensagem({
      variant: 'parcial',
      lugarRescisaoEm,
    });
    expect(msg).toContain('justa causa');
    expect(msg).toContain('Os outros passageiros continuam no acordo');
    expect(msg).not.toContain('TODO');
    expect(msg).not.toContain('Recebes a parte do mês');
  });

  it('variante ultimo — acordo encerrado', () => {
    const msg = resolvePassageiroJustaCausaInvocadorNotifMensagem({
      variant: 'ultimo',
      lugarRescisaoEm,
    });
    expect(msg).toContain('último passageiro');
    expect(msg).toContain('justa causa');
  });

  it('variante reservado — lugar reservado', () => {
    const msg = resolvePassageiroJustaCausaInvocadorNotifMensagem({
      variant: 'reservado',
      lugarRescisaoEm,
    });
    expect(msg).toContain('lugar reservado');
    expect(msg).toContain('justa causa');
  });

  it('resolveNotificationMensagem substitui placeholder SQL no sino', () => {
    const sqlPlaceholder = '·';
    const resolved = resolveNotificationMensagem({
      mensagem: sqlPlaceholder,
      metadata: {
        type: JUSTA_CAUSA_PASSAGEIRO_INVOCADOR_NOTIF_TYPE,
        variant: 'parcial',
        lugar_rescisao_em: lugarRescisaoEm,
        acordo_id: acordoId,
      },
    });
    expect(resolved).not.toBe(sqlPlaceholder);
    expect(resolved).toContain('justa causa');
  });
});
