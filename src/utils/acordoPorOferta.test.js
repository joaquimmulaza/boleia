import { describe, it, expect } from 'vitest';
import { buildAcordoIdPorOfertaMap } from './acordoPorOferta';

describe('buildAcordoIdPorOfertaMap', () => {
  const passengerId = 'pax-1';

  it('mapeia oferta_id → acordo_id quando linha activa ou reservada', () => {
    const map = buildAcordoIdPorOfertaMap(
      [
        {
          id: 'acordo-a',
          oferta_id: 'oferta-1',
          estado: 'activo',
          acordos_passageiros: [{ passenger_id: passengerId, estado: 'activo' }],
        },
        {
          id: 'acordo-b',
          oferta_id: 'oferta-2',
          estado: 'activo',
          acordos_passageiros: [{ passenger_id: passengerId, estado: 'reservado' }],
        },
      ],
      passengerId,
    );
    expect(map.get('oferta-1')).toBe('acordo-a');
    expect(map.get('oferta-2')).toBe('acordo-b');
  });

  it('ignora acordos cancelados ou linha saiu/expirada', () => {
    const map = buildAcordoIdPorOfertaMap(
      [
        {
          id: 'acordo-x',
          oferta_id: 'oferta-x',
          estado: 'cancelado',
          acordos_passageiros: [{ passenger_id: passengerId, estado: 'activo' }],
        },
        {
          id: 'acordo-y',
          oferta_id: 'oferta-y',
          estado: 'activo',
          acordos_passageiros: [{ passenger_id: passengerId, estado: 'saiu' }],
        },
      ],
      passengerId,
    );
    expect(map.size).toBe(0);
  });

  it('compara estados case-insensitive', () => {
    const map = buildAcordoIdPorOfertaMap(
      [
        {
          id: 'acordo-z',
          oferta_id: 'oferta-z',
          estado: 'Activo',
          acordos_passageiros: [{ passenger_id: passengerId, estado: 'Reservado' }],
        },
      ],
      passengerId,
    );
    expect(map.get('oferta-z')).toBe('acordo-z');
  });
});
