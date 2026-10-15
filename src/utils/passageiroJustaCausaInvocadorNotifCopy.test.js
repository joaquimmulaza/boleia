import { describe, it, expect } from 'vitest';
import {
  JUSTA_CAUSA_PASSAGEIRO_INVOCADOR_NOTIF_TYPE,
  JUSTA_CAUSA_PASSAGEIRO_INVOCADOR_NOTIF_TIPO,
  resolvePassageiroJustaCausaInvocadorNotifCopy,
} from './passageiroJustaCausaInvocadorNotifCopy';
import {
  resolveNotificationMensagem,
  resolveNotificationTitulo,
  resolveNotificationTipo,
} from './notificationDisplayMensagem';

describe('notificação v1.16 — passageiro invocador justa causa', () => {
  /** Instantâneo fixo: 12 de outubro (civil Luanda). */
  const lugarRescisaoEm = '2026-10-12T10:00:00.000Z';
  const dataFormatada = '12 de outubro';

  const metaBase = {
    type: JUSTA_CAUSA_PASSAGEIRO_INVOCADOR_NOTIF_TYPE,
    lugar_rescisao_em: lugarRescisaoEm,
    acordo_id: 'a5555555-5555-4555-8555-555555555555',
  };

  it('A) ficam outros passageiros — título e corpo exactos', () => {
    const copy = resolvePassageiroJustaCausaInvocadorNotifCopy({
      variant: 'parcial',
      lugarRescisaoEm,
    });
    expect(copy.titulo).toBe('Saíste do acordo');
    expect(copy.corpo).toBe(
      `Terminaste o teu lugar por justa causa a ${dataFormatada}. `
      + 'Só contam os dias até essa data. Se já pagaste mais, devolvemos-te a diferença.',
    );
    expect(copy.tipo).toBe(JUSTA_CAUSA_PASSAGEIRO_INVOCADOR_NOTIF_TIPO);
  });

  it('B) era o último passageiro — título e corpo exactos', () => {
    const copy = resolvePassageiroJustaCausaInvocadorNotifCopy({
      variant: 'ultimo',
      lugarRescisaoEm,
    });
    expect(copy.titulo).toBe('Acordo encerrado');
    expect(copy.corpo).toBe(
      `Saíste por justa causa a ${dataFormatada}. Eras o último passageiro, por isso o acordo foi encerrado. `
      + 'Só contam os dias até essa data. Se já pagaste mais, devolvemos-te a diferença.',
    );
    expect(copy.tipo).toBe(JUSTA_CAUSA_PASSAGEIRO_INVOCADOR_NOTIF_TIPO);
  });

  it('sino usa copy gravada na BD (push) quando mensagem não é placeholder', () => {
    const corpoBd =
      `Terminaste o teu lugar por justa causa a ${dataFormatada}. `
      + 'Só contam os dias até essa data. Se já pagaste mais, devolvemos-te a diferença.';
    const notif = {
      mensagem: corpoBd,
      tipo: 'info',
      metadata: {
        ...metaBase,
        variant: 'parcial',
        titulo: 'Saíste do acordo',
      },
    };
    expect(resolveNotificationTitulo(notif)).toBe('Saíste do acordo');
    expect(resolveNotificationMensagem(notif)).toBe(corpoBd);
    expect(resolveNotificationTipo(notif)).toBe('info');
  });

  it('sino faz fallback a v1.16 só para linhas legacy com placeholder', () => {
    const notif = {
      mensagem: '·',
      tipo: 'info',
      metadata: { ...metaBase, variant: 'parcial' },
    };
    expect(resolveNotificationMensagem(notif)).toContain(dataFormatada);
  });
});
