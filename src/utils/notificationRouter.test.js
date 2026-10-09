import { describe, it, expect } from 'vitest';
import {
  resolveNotificationRoute,
  notificationRouteMap,
  acordosDeepLink,
  propostaHubDeepLink,
} from './notificationRouter';

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

    it('agreement_update consensual abre detalhe com focus rescisao', () => {
      expect(
        notificationRouteMap.agreement_update({
          acordo_id: 'a-1',
          rescisao_modo: 'consensual',
          rescisao_vigencia: 'imediato',
        }),
      ).toBe('/acordos?openAcordoId=a-1&focus=rescisao');
    });
  });

  describe('propostaHubDeepLink (ENG#33)', () => {
    it('sentido B inclui focus e ids na query', () => {
      expect(
        propostaHubDeepLink({
          inbox: 'passageiro',
          oferta_id: 'of-1',
          proposta_id: 'prop-1',
        }),
      ).toBe('/passageiro?focus=propostas&propostaId=prop-1&openOfertaId=of-1');
    });

    it('sentido A abre /motorista com openOfertaId', () => {
      expect(
        propostaHubDeepLink({
          inbox: 'motorista',
          oferta_id: 'of-2',
          proposta_id: 'prop-2',
        }),
      ).toBe('/motorista?focus=propostas&propostaId=prop-2&openOfertaId=of-2');
    });

    it('sem inbox (legado) usa /motorista', () => {
      expect(propostaHubDeepLink({ oferta_id: 'of-1' })).toBe(
        '/motorista?focus=propostas&openOfertaId=of-1',
      );
    });
  });

  describe('proposal_received (contraparte)', () => {
    it('sentido B (inbox passageiro) abre hub com query', () => {
      expect(
        notificationRouteMap.proposal_received({
          inbox: 'passageiro',
          oferta_id: 'of-1',
          proposta_id: 'prop-1',
        }),
      ).toBe('/passageiro?focus=propostas&propostaId=prop-1&openOfertaId=of-1');
    });

    it('sentido A (inbox motorista) abre hub com query', () => {
      expect(
        notificationRouteMap.proposal_received({
          inbox: 'motorista',
          oferta_id: 'of-1',
          proposta_id: 'prop-1',
        }),
      ).toBe('/motorista?focus=propostas&propostaId=prop-1&openOfertaId=of-1');
    });

    it('proposal_invalidated e proposal_cancelled usam o mesmo inbox', () => {
      expect(
        notificationRouteMap.proposal_invalidated({ inbox: 'motorista', oferta_id: 'o1' }),
      ).toBe('/motorista?focus=propostas&openOfertaId=o1');
      expect(
        notificationRouteMap.proposal_cancelled({ inbox: 'passageiro', proposta_id: 'p1' }),
      ).toBe('/passageiro?focus=propostas&propostaId=p1');
    });

    it('normaliza inbox com maiúsculas / espaços', () => {
      expect(
        notificationRouteMap.proposal_received({ inbox: ' Passageiro ', proposta_id: 'p1' }),
      ).toBe('/passageiro?focus=propostas&propostaId=p1');
      expect(
        notificationRouteMap.proposal_received({ inbox: 'MOTORISTA', proposta_id: 'p2' }),
      ).toBe('/motorista?focus=propostas&propostaId=p2');
    });
  });

  describe('resolveNotificationRoute', () => {
    it('proposal_received com inbox passageiro resolve hub com propostaId', () => {
      const route = resolveNotificationRoute({
        metadata: {
          type: 'proposal_received',
          inbox: 'passageiro',
          proposta_id: 'prop-1',
        },
      });
      expect(route).toBe('/passageiro?focus=propostas&propostaId=prop-1');
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

    it('sem metadata.type: link interno válido passa', () => {
      const link = '/acordos?openAcordoId=x&focus=rescisao';
      expect(resolveNotificationRoute({ link, mensagem: 'Teste' })).toBe(link);
    });

    it('sem metadata.type: rejeita open redirect e cai no fallback seguro', () => {
      const attacks = [
        'https://evil.com',
        '//evil.com',
        '/\\evil.com',
        'javascript:alert(1)',
      ];
      for (const link of attacks) {
        expect(resolveNotificationRoute({ link, mensagem: 'Bem-vindo!' })).toBe('/acordos');
      }
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
