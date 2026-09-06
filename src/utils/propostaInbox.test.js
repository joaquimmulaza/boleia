import { describe, it, expect } from 'vitest';
import {
  filterPropostasParaInbox,
  filterPropostasEnviadas,
  filterPropostasTerminadasRecebidas,
  filterPropostasTerminadasEnviadas,
  resolvePropostaInbox,
} from './propostaInbox';

describe('filterPropostasParaInbox', () => {
  const userId = 'pax-1';

  it('mantém só abertas criadas por outro (inbox da contraparte)', () => {
    const result = filterPropostasParaInbox(
      [
        { id: 'a', estado: 'aberta', created_by: 'driver-1' },
        { id: 'b', estado: 'aberta', created_by: 'pax-1' },
        { id: 'c', estado: 'rejeitada', created_by: 'driver-1' },
        { id: 'd', estado: 'aberta', created_by: 'driver-2' },
      ],
      userId,
    );

    expect(result.map((p) => p.id)).toEqual(['a', 'd']);
  });

  it('exclui propostas sem created_by distinto do utilizador', () => {
    expect(
      filterPropostasParaInbox(
        [{ id: 'x', estado: 'aberta', created_by: undefined }],
        userId,
      ),
    ).toHaveLength(1);
  });

  it('devolve [] sem userId ou lista inválida', () => {
    expect(filterPropostasParaInbox([{ id: 'a', estado: 'aberta', created_by: 'x' }], '')).toEqual(
      [],
    );
    expect(filterPropostasParaInbox(null, userId)).toEqual([]);
  });
});

describe('filterPropostasEnviadas', () => {
  const userId = 'driver-1';

  it('mantém só abertas criadas pelo próprio (canceláveis)', () => {
    const result = filterPropostasEnviadas(
      [
        { id: 'a', estado: 'aberta', created_by: 'driver-1' },
        { id: 'b', estado: 'aberta', created_by: 'pax-1' },
        { id: 'c', estado: 'cancelada', created_by: 'driver-1' },
        { id: 'd', estado: 'aberta', created_by: 'driver-1' },
      ],
      userId,
    );

    expect(result.map((p) => p.id)).toEqual(['a', 'd']);
  });

  it('devolve [] sem userId ou lista inválida', () => {
    expect(filterPropostasEnviadas([{ id: 'a', estado: 'aberta', created_by: 'x' }], '')).toEqual(
      [],
    );
    expect(filterPropostasEnviadas(undefined, userId)).toEqual([]);
  });
});

describe('filterPropostasTerminadasRecebidas', () => {
  const userId = 'pax-1';

  it('mantém rejeitada/cancelada/aceite criadas por outro', () => {
    const result = filterPropostasTerminadasRecebidas(
      [
        { id: 'a', estado: 'rejeitada', created_by: 'driver-1' },
        { id: 'b', estado: 'cancelada', created_by: 'driver-1' },
        { id: 'c', estado: 'aceite', created_by: 'driver-1' },
        { id: 'd', estado: 'aberta', created_by: 'driver-1' },
        { id: 'e', estado: 'invalidada', created_by: 'driver-1' },
        { id: 'f', estado: 'rejeitada', created_by: 'pax-1' },
      ],
      userId,
    );
    expect(result.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('filterPropostasTerminadasEnviadas', () => {
  const userId = 'pax-1';

  it('mantém rejeitada/cancelada criadas pelo próprio', () => {
    const result = filterPropostasTerminadasEnviadas(
      [
        { id: 'a', estado: 'rejeitada', created_by: 'pax-1' },
        { id: 'b', estado: 'cancelada', created_by: 'pax-1' },
        { id: 'c', estado: 'aberta', created_by: 'pax-1' },
        { id: 'd', estado: 'cancelada', created_by: 'driver-1' },
      ],
      userId,
    );
    expect(result.map((p) => p.id)).toEqual(['a', 'b']);
  });
});

describe('resolvePropostaInbox', () => {
  it('sentido B (criador = motorista) → inbox passageiro', () => {
    expect(
      resolvePropostaInbox({
        createdBy: 'driver-1',
        driverId: 'driver-1',
        ownerId: 'pax-1',
      }),
    ).toBe('passageiro');
  });

  it('sentido A (criador = owner) → inbox motorista', () => {
    expect(
      resolvePropostaInbox({
        createdBy: 'pax-1',
        driverId: 'driver-1',
        ownerId: 'pax-1',
      }),
    ).toBe('motorista');
  });

  it('devolve null se dados incompletos ou criador externo', () => {
    expect(resolvePropostaInbox({})).toBeNull();
    expect(
      resolvePropostaInbox({
        createdBy: 'outro',
        driverId: 'driver-1',
        ownerId: 'pax-1',
      }),
    ).toBeNull();
  });
});
