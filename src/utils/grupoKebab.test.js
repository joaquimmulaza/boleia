import { describe, it, expect } from 'vitest';
import {
  acordoBloqueiaApagarGrupo,
  grupoKebabActions,
  resolveGrupoPapel,
} from './grupoKebab';

describe('kebab do grupo', () => {
  it('dono único sem acordo: Editar e Apagar, sem Sair', () => {
    expect(grupoKebabActions({
      isOwner: true,
      isMember: true,
      memberCount: 1,
      hasActiveAgreement: false,
    })).toEqual({ editar: true, apagar: true, sair: false });
  });

  it('dono com outros: Editar e Sair, sem Apagar', () => {
    expect(grupoKebabActions({
      isOwner: true,
      isMember: true,
      memberCount: 3,
      hasActiveAgreement: false,
    })).toEqual({ editar: true, apagar: false, sair: true });
  });

  it('membro não-dono: só Sair', () => {
    expect(grupoKebabActions({
      isOwner: false,
      isMember: true,
      memberCount: 3,
      hasActiveAgreement: false,
    })).toEqual({ editar: false, apagar: false, sair: true });
  });

  it('dono único com acordo activo: só Editar', () => {
    expect(grupoKebabActions({
      isOwner: true,
      isMember: true,
      memberCount: 1,
      hasActiveAgreement: true,
    })).toEqual({ editar: true, apagar: false, sair: false });
  });

  it('acordo cancelado, expirado ou cancelado justificado não bloqueia Apagar', () => {
    expect(acordoBloqueiaApagarGrupo('cancelado')).toBe(false);
    expect(acordoBloqueiaApagarGrupo('Expirado')).toBe(false);
    expect(acordoBloqueiaApagarGrupo('cancelado_justificado')).toBe(false);
    expect(acordoBloqueiaApagarGrupo('CANCELADO_JUSTIFICADO')).toBe(false);
    expect(acordoBloqueiaApagarGrupo('activo')).toBe(true);
    expect(acordoBloqueiaApagarGrupo('cancelamento_pendente')).toBe(true);
  });

  it('resolve o dono pela procura e o membro pela lista', () => {
    const membros = [
      { passenger_id: 'dono', estado: 'activo', ordem_insercao: 0 },
      { passenger_id: 'colega', estado: 'activo', ordem_insercao: 1 },
    ];
    expect(resolveGrupoPapel({ userId: 'dono', ownerId: 'dono', membros }).isOwner).toBe(true);
    expect(resolveGrupoPapel({ userId: 'colega', ownerId: 'dono', membros })).toMatchObject({
      isOwner: false,
      isMember: true,
      memberCount: 2,
    });
  });

  it('dono que saiu deixa de controlar: já não é membro activo', () => {
    const membros = [
      { passenger_id: 'dono', estado: 'saiu', ordem_insercao: 0 },
      { passenger_id: 'colega', estado: 'activo', ordem_insercao: 1 },
    ];
    expect(resolveGrupoPapel({ userId: 'dono', ownerId: 'dono', membros })).toMatchObject({
      isOwner: false,
      isMember: false,
      memberCount: 1,
    });
    expect(grupoKebabActions({
      ...resolveGrupoPapel({ userId: 'dono', ownerId: 'dono', membros }),
      hasActiveAgreement: false,
    })).toEqual({ editar: false, apagar: false, sair: false });
  });
});
