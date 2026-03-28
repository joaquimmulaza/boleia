import { describe, it, expect } from 'vitest';
import { resolveNotificationRoute, notificationRouteMap } from './notificationRouter';

describe('notificationRouter', () => {
  describe('resolveNotificationRoute', () => {
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
