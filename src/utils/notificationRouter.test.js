import { describe, it, expect } from 'vitest';
import { resolveNotificationRoute, notificationRouteMap, acordosDeepLink } from './notificationRouter';

describe('notificationRouter', () => {
  describe('acordosDeepLink (ENG #16)', () => {
    it('monta query openAcordoId + focus', () => {
      expect(acordosDeepLink({ acordo_id: 'abc' }, 'pagamento')).toBe(
        '/acordos?openAcordoId=abc&focus=pagamento',
      );
    });

    it('sem acordo_id devolve /acordos com só focus', () => {
      expect(acordosDeepLink({}, 'renovacao')).toBe('/acordos?focus=renovacao');
    });
  });

  describe('payment_update / renewal / payout (ENG #16)', () => {
    it('payment_update resolve secção pagamento', () => {
      expect(
        resolveNotificationRoute({
          metadata: {
            type: 'payment_update',
            acordo_id: '123',
            pagamento_id: 'pag-1',
            estado: 'em_custodia',
          },
        }),
      ).toBe('/acordos?openAcordoId=123&focus=pagamento');
    });

    it('renewal_available resolve secção renovação', () => {
      expect(notificationRouteMap.renewal_available({ acordo_id: 'a-1' })).toBe(
        '/acordos?openAcordoId=a-1&focus=renovacao',
      );
    });

    it('agreement_update com adenda pendente usa focus adenda', () => {
      expect(
        notificationRouteMap.agreement_update({
          acordo_id: 'a-1',
          adenda_estado: 'pendente_contraparte',
        }),
      ).toBe('/acordos?openAcordoId=a-1&focus=adenda');
    });
  });

  describe('proposal_received (contraparte)', () => {
    it('sentido B (inbox passageiro) abre /passageiro', () => {
      expect(
        notificationRouteMap.proposal_received({
          inbox: 'passageiro',
          oferta_id: 'of-1',
          procura_id: 'pr-1',
        }),
      ).toBe('/passageiro');
    });

    it('sentido A (inbox motorista) abre /motorista', () => {
      expect(
        notificationRouteMap.proposal_received({
          inbox: 'motorista',
          oferta_id: 'of-1',
          procura_id: 'pr-1',
        }),
      ).toBe('/motorista');
    });

    it('sem inbox (legado) mantém /motorista', () => {
      expect(
        notificationRouteMap.proposal_received({ oferta_id: 'of-1' }),
      ).toBe('/motorista');
    });

    it('normaliza inbox com maiúsculas / espaços', () => {
      expect(
        notificationRouteMap.proposal_received({ inbox: ' Passageiro ' }),
      ).toBe('/passageiro');
      expect(
        notificationRouteMap.proposal_received({ inbox: 'MOTORISTA' }),
      ).toBe('/motorista');
    });
  });

  describe('resolveNotificationRoute', () => {
    it('proposal_received com inbox passageiro resolve /passageiro', () => {
      const route = resolveNotificationRoute({
        metadata: {
          type: 'proposal_received',
          inbox: 'passageiro',
          proposta_id: 'prop-1',
        },
      });
      expect(route).toBe('/passageiro');
    });

    it('deve usar o strategy de metadata se type estiver presente e validado', () => {
      const notif = {
        metadata: {
          type: 'agreement_update',
          acordo_id: '123'
        }
      };

      const route = resolveNotificationRoute(notif);
      expect(route).toBe('/acordos?openAcordoId=123');
    });

    it('deve cair no fallback do strategy de metadata se faltar parametros esperados pelo strategy', () => {
      const notif = {
        metadata: {
          type: 'agreement_update'
          // missing acordo_id
        }
      };

      const route = resolveNotificationRoute(notif);
      expect(route).toBe('/acordos');
    });

    it('deve usar notif.link como primeiro fallback se strategy falhar (nao achar o tipo)', () => {
      const notif = {
        metadata: {
          type: 'unknown_type',
        },
        link: '/custom-link'
      };

      const route = resolveNotificationRoute(notif);
      expect(route).toBe('/custom-link');
    });

    it('deve ignorar notif.link se for /dashboard ou / e deduzir pela mensagem', () => {
      const notif = {
        link: '/dashboard',
        mensagem: 'O motorista aceitou sua viagem.'
      };

      const route = resolveNotificationRoute(notif);
      expect(route).toBe('/motorista');
    });

    it('deve deduzir a rota baseada na mensagem: motorista', () => {
      const notif = {
        mensagem: 'O motorista aceitou sua viagem.'
      };

      const route = resolveNotificationRoute(notif);
      expect(route).toBe('/motorista');
    });

    it('deve deduzir a rota baseada na mensagem: passageiro', () => {
      const notif = {
        mensagem: 'Novo passageiro.'
      };

      const route = resolveNotificationRoute(notif);
      expect(route).toBe('/passageiro');
    });

    it('deve deduzir a rota baseada na mensagem: rota/viagem', () => {
      const notif1 = { mensagem: 'Sua rota foi atualizada.' };
      const notif2 = { mensagem: 'Sua viagem comecou.' };

      expect(resolveNotificationRoute(notif1)).toBe('/');
      expect(resolveNotificationRoute(notif2)).toBe('/');
    });

    it('deve cair no fallback padrao /my-agreements se nenhuma condicao for atingida', () => {
      const notif = {
        mensagem: 'Bem-vindo ao sistema!'
      };

      const route = resolveNotificationRoute(notif);
      expect(route).toBe('/acordos');
    });
  });
});
