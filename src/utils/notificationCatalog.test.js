import { describe, it, expect } from 'vitest';
import {
  resolveNotificationTitle,
  resolveNotificationPushDestination,
  resolveNotificationListDestination,
  shouldNavigateOnListTap,
  resolveCatalogTitle,
  formatMesReferenciaPt,
  FALLBACK_NOTIFICATION_TITLE,
  NOTIFICATIONS_BELL_OPEN_PATH,
} from './notificationCatalog.js';

/** @typedef {{ metadata?: Record<string, unknown>, mensagem?: string, link?: string }} Notif */

const ACORDO = 'ac722c73-0000-4000-8000-000000000001';

describe('notificationCatalog — títulos v1.18', () => {
  it('fallback global é Boleia Certa (nunca Nova Notificação)', () => {
    expect(FALLBACK_NOTIFICATION_TITLE).toBe('Boleia Certa');
    expect(
      resolveNotificationTitle({ metadata: { type: 'match_available' }, mensagem: 'x' }),
    ).toBe('Boleia Certa');
  });

  it('proposal_received com e sem nome', () => {
    expect(
      resolveNotificationTitle({
        metadata: { type: 'proposal_received', nome: 'Ana' },
        mensagem: 'm',
      }),
    ).toBe('Nova proposta de Ana');
    expect(
      resolveNotificationTitle({
        metadata: { type: 'proposal_received', inbox: 'motorista' },
        mensagem: 'm',
      }),
    ).toBe('Nova proposta');
  });

  it('proposal_cancelled e proposal_invalidated', () => {
    expect(
      resolveNotificationTitle({
        metadata: { type: 'proposal_cancelled' },
        mensagem: 'm',
      }),
    ).toBe('Proposta sem efeito');
    expect(
      resolveNotificationTitle({
        metadata: { type: 'proposal_invalidated' },
        mensagem: 'm',
      }),
    ).toBe('A proposta já não corresponde');
  });

  it('agreement_update — casos aprovados v1.18', () => {
    expect(
      resolveNotificationTitle({
        metadata: { type: 'agreement_update' },
        mensagem: 'Novo acordo activo com 2 passageiro(s).',
      }),
    ).toBe('Novo acordo');
    expect(
      resolveNotificationTitle({
        metadata: { type: 'agreement_update', rescisao_modo: 'aviso_previo' },
        mensagem: 'A outra parte pediu a rescisão do acordo com aviso prévio;',
      }),
    ).toBe('Aviso prévio: o acordo vai terminar');
    expect(
      resolveNotificationTitle({
        metadata: { type: 'agreement_update' },
        mensagem: 'A outra parte rescindiu o acordo por justa causa.',
      }),
    ).toBe('Acordo terminado por justa causa');
    expect(
      resolveNotificationTitle({
        metadata: { type: 'agreement_update', adenda_estado: 'aceite' },
        mensagem: 'm',
      }),
    ).toBe('Proposta de preço aceite');
    expect(
      resolveNotificationTitle({
        metadata: { type: 'agreement_update', adenda_estado: 'rejeitada' },
        mensagem: 'm',
      }),
    ).toBe('Proposta de preço recusada');
    expect(
      resolveNotificationTitle({
        metadata: { type: 'agreement_update', adenda_estado: 'cancelada_iniciador' },
        mensagem: 'm',
      }),
    ).toBe('Proposta de preço anulada');
    expect(
      resolveNotificationTitle({
        metadata: { type: 'agreement_update' },
        mensagem: 'Um acordo foi cancelado.',
      }),
    ).toBe('Acordo cancelado');
    expect(
      resolveNotificationTitle({
        metadata: { type: 'agreement_update', rescisao_modo: 'consensual' },
        mensagem: 'A outra parte pediu encerramento amigável imediato',
      }),
    ).toBe('Pedido de encerramento');
    expect(
      resolveNotificationTitle({
        metadata: { type: 'agreement_update', nome: 'João', rescisao_modo: 'consensual' },
        mensagem: 'pedido',
      }),
    ).toBe('João pediu para encerrar o acordo');
  });

  it('waitlist_promoted e status v1.8', () => {
    expect(
      resolveNotificationTitle({
        metadata: { type: 'waitlist_promoted' },
        mensagem: 'm',
      }),
    ).toBe('Abriu-se um lugar numa oferta');
    expect(
      resolveNotificationTitle({
        metadata: { type: 'status', reason: 'last_passenger_left' },
        mensagem: 'Maria saiu e o acordo foi encerrado.',
      }),
    ).toBe('Acordo encerrado');
  });

  it('payment_update — mês, sem mês, motorista sem nome', () => {
    expect(formatMesReferenciaPt('2026-10-01')).toBe('outubro');
    expect(
      resolveNotificationTitle({
        metadata: { type: 'payment_update', mes_referencia: '2026-10-01' },
        mensagem: 'Pagamento mensal disponível — envia o comprovativo em Acordos.',
      }),
    ).toBe('Pagamento de outubro disponível');
    expect(
      resolveNotificationTitle({
        metadata: { type: 'payment_update' },
        mensagem: 'Pagamento mensal disponível — envia o comprovativo em Acordos.',
      }),
    ).toBe('Pagamento mensal disponível');
    expect(
      resolveNotificationTitle({
        metadata: { type: 'payment_update' },
        mensagem: 'Pagamento de passageiro validado em custódia.',
      }),
    ).toBe('Pagamento validado');
  });

  it('payout_liquidated — com e sem valor', () => {
    expect(
      resolveNotificationTitle({
        metadata: { type: 'payout_liquidated', valor: '15000' },
        mensagem: 'm',
      }),
    ).toBe('Recebeste 15 000 Kz');
    expect(
      resolveNotificationTitle({
        metadata: { type: 'payout_liquidated' },
        mensagem: 'Pagamento liquidado — repasse registado.',
      }),
    ).toBe('Recebeste um pagamento');
  });

  it('reserva_expirada', () => {
    expect(
      resolveNotificationTitle({
        metadata: { type: 'reserva_expirada', acordo_id: ACORDO },
        mensagem: 'm',
      }),
    ).toBe('A tua reserva expirou');
  });

  it('metadata.titulo SQL override (status v1.10)', () => {
    expect(
      resolveNotificationTitle({
        metadata: { type: 'status', titulo: 'Já não fazes parte deste acordo', card: 'v1.10' },
        mensagem: 'corpo',
      }),
    ).toBe('Já não fazes parte deste acordo');
  });

  it('notificação antiga sem type: lista sem título de catálogo', () => {
    expect(resolveCatalogTitle({ mensagem: 'Texto legado qualquer' })).toBeNull();
  });

  it('status v1.12 usa título de card (#275)', () => {
    expect(
      resolveNotificationTitle({
        metadata: { type: 'status', card: 'v1.12', acordo_id: ACORDO },
        mensagem: 'A reserva expirou. O acordo continua.',
      }),
    ).toBe('Ficou um lugar livre');
  });

  it('motorista JC passageiro — v1.18 parcial vs encerrado', () => {
    expect(
      resolveNotificationTitle({
        metadata: {
          type: 'agreement_update',
          rescisao_modo: 'justa_causa',
          acordo_estado: 'activo',
        },
        mensagem: 'Maria rescindiu o lugar por justa causa. Ficou um lugar livre.',
      }),
    ).toBe('Um lugar terminou por justa causa');
    expect(
      resolveNotificationTitle({
        metadata: {
          type: 'agreement_update',
          rescisao_modo: 'justa_causa',
          acordo_estado: 'cancelado',
        },
        mensagem: 'Maria rescindiu por justa causa e o acordo foi encerrado.',
      }),
    ).toBe('Acordo encerrado');
  });

  it('agreement_update — metadata.reason e1–e4 (sem heurística de mensagem)', () => {
    expect(
      resolveNotificationTitle({
        metadata: { type: 'agreement_update', reason: 'e2' },
        mensagem: 'corpo qualquer',
      }),
    ).toBe('Encerramento confirmado');
    expect(
      resolveNotificationTitle({
        metadata: { type: 'agreement_update', reason: 'e3' },
        mensagem: 'corpo qualquer',
      }),
    ).toBe('Aviso prévio: o acordo vai terminar');
    expect(
      resolveNotificationTitle({
        metadata: { type: 'agreement_update', reason: 'e4' },
        mensagem: 'corpo qualquer',
      }),
    ).toBe('Acordo terminado por justa causa');
    expect(
      resolveNotificationTitle({
        metadata: { type: 'agreement_update', reason: 'e1', nome: 'João' },
        mensagem: 'corpo qualquer',
      }),
    ).toBe('João pediu para encerrar o acordo');
  });

  it('justa_causa_passageiro_invocador — título por variant', () => {
    expect(
      resolveNotificationTitle({
        metadata: {
          type: 'justa_causa_passageiro_invocador',
          variant: 'parcial',
        },
        mensagem: '·',
      }),
    ).toBe('Saíste do acordo');
    expect(
      resolveNotificationTitle({
        metadata: {
          type: 'justa_causa_passageiro_invocador',
          variant: 'ultimo',
        },
        mensagem: '·',
      }),
    ).toBe('Acordo encerrado');
  });
});

describe('notificationCatalog — destinos push e lista (paridade)', () => {
  const baseProposta = {
    metadata: {
      type: 'proposal_received',
      inbox: 'passageiro',
      proposta_id: 'p1',
      oferta_id: 'o1',
    },
    mensagem: 'm',
  };

  it('proposal_received — push e lista iguais', () => {
    const dest = '/passageiro?focus=propostas&propostaId=p1&openOfertaId=o1';
    expect(resolveNotificationPushDestination(baseProposta)).toBe(dest);
    expect(resolveNotificationListDestination(baseProposta)).toBe(dest);
  });

  it('reserva_expirada abre acordo (push e lista)', () => {
    /** @type {Notif} */
    const notif = {
      metadata: { type: 'reserva_expirada', acordo_id: ACORDO },
      mensagem: 'expirou',
    };
    const dest = `/acordos?openAcordoId=${ACORDO}`;
    expect(resolveNotificationPushDestination(notif)).toBe(dest);
    expect(resolveNotificationListDestination(notif)).toBe(dest);
  });

  it('payment motorista usa focus motorista-pagamentos', () => {
    /** @type {Notif} */
    const notif = {
      metadata: { type: 'payment_update', acordo_id: ACORDO },
      mensagem: 'Pagamento de passageiro validado em custódia.',
    };
    const dest = `/acordos?openAcordoId=${ACORDO}&focus=motorista-pagamentos`;
    expect(resolveNotificationPushDestination(notif)).toBe(dest);
    expect(resolveNotificationListDestination(notif)).toBe(dest);
  });

  it('agreement_update acordo formado passageiro — focus pagamento', () => {
    /** @type {Notif} */
    const notif = {
      metadata: { type: 'agreement_update', acordo_id: ACORDO },
      mensagem: 'Acordo formado: o teu lugar está reservado.',
    };
    const dest = `/acordos?openAcordoId=${ACORDO}&focus=pagamento`;
    expect(resolveNotificationPushDestination(notif)).toBe(dest);
    expect(resolveNotificationListDestination(notif)).toBe(dest);
  });

  it('adenda pendente — focus preco-proximo-mes', () => {
    /** @type {Notif} */
    const notif = {
      metadata: {
        type: 'agreement_update',
        acordo_id: ACORDO,
        adenda_estado: 'pendente_passageiro',
      },
      mensagem: 'Nova proposta de preço',
    };
    const dest = `/acordos?openAcordoId=${ACORDO}&focus=preco-proximo-mes`;
    expect(resolveNotificationPushDestination(notif)).toBe(dest);
    expect(resolveNotificationListDestination(notif)).toBe(dest);
  });

  it('tipo desconhecido — push abre sino; lista não navega', () => {
    /** @type {Notif} */
    const notif = {
      metadata: { type: 'tipo_fantasma' },
      mensagem: 'x',
      link: '/acordos?openAcordoId=evil',
    };
    expect(resolveNotificationPushDestination(notif)).toBe(NOTIFICATIONS_BELL_OPEN_PATH);
    expect(resolveNotificationListDestination(notif)).toBeNull();
    expect(shouldNavigateOnListTap(notif)).toBe(false);
  });

  it('link inválido sem type — lista não navega', () => {
    /** @type {Notif} */
    const notif = { link: 'https://evil.com', mensagem: 'Bem-vindo' };
    expect(resolveNotificationListDestination(notif)).toBeNull();
    expect(shouldNavigateOnListTap(notif)).toBe(false);
  });

  it('sem metadata.type e sem link — lista não navega (QA prod)', () => {
    /** @type {Notif} */
    const notif = {
      link: null,
      tipo: 'info',
      mensagem: 'Aviso QA',
      metadata: { qa: true },
    };
    expect(resolveNotificationListDestination(notif)).toBeNull();
    expect(shouldNavigateOnListTap(notif)).toBe(false);
  });

  it('metadata.type desconhecido (qa_tipo_desconhecido) — lista não navega', () => {
    /** @type {Notif} */
    const notif = {
      metadata: { type: 'qa_tipo_desconhecido', qa: true },
      mensagem: 'Tipo QA',
    };
    expect(resolveNotificationListDestination(notif)).toBeNull();
    expect(shouldNavigateOnListTap(notif)).toBe(false);
  });

  it('reserva_expirada — lista continua para /acordos', () => {
    /** @type {Notif} */
    const notif = {
      metadata: { type: 'reserva_expirada', acordo_id: '00000000-0000-4000-8000-000000000099' },
      mensagem: 'Reserva expirou',
    };
    expect(resolveNotificationListDestination(notif)).toBe(
      '/acordos?openAcordoId=00000000-0000-4000-8000-000000000099',
    );
    expect(shouldNavigateOnListTap(notif)).toBe(true);
  });
});
