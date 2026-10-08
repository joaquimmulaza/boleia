import { describe, it, expect } from 'vitest';
import {
  buildAcordoIdPorOfertaMap,
  buildAcordoOptimistaPosAceite,
  mergeAcordosPassageiro,
} from './acordoPorOferta';

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

  it('inclui acordo em cancelamento_pendente com linha viva', () => {
    const map = buildAcordoIdPorOfertaMap(
      [
        {
          id: 'acordo-pend',
          oferta_id: 'oferta-pend',
          estado: 'cancelamento_pendente',
          acordos_passageiros: [{ passenger_id: passengerId, estado: 'activo' }],
        },
      ],
      passengerId,
    );
    expect(map.get('oferta-pend')).toBe('acordo-pend');
  });

  it('buildAcordoOptimistaPosAceite inclui linha reservado quando RPC não traz passageiros', () => {
    const acordo = buildAcordoOptimistaPosAceite(
      { id: 'ac-1', oferta_id: 'of-1' },
      passengerId,
    );
    expect(acordo).toMatchObject({
      id: 'ac-1',
      oferta_id: 'of-1',
      estado: 'activo',
      acordos_passageiros: [{ passenger_id: passengerId, estado: 'reservado' }],
    });
    expect(buildAcordoIdPorOfertaMap([acordo], passengerId).get('of-1')).toBe('ac-1');
  });

  it('mergeAcordosPassageiro mantém optimista quando fetched stale está vazio', () => {
    const optimista = buildAcordoOptimistaPosAceite(
      { id: 'ac-opt', oferta_id: 'of-1' },
      passengerId,
    );
    const merged = mergeAcordosPassageiro([optimista], []);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('ac-opt');
  });

  it('mergeAcordosPassageiro substitui optimista quando fetched traz o mesmo oferta_id', () => {
    const optimista = buildAcordoOptimistaPosAceite(
      { id: 'ac-opt', oferta_id: 'of-1' },
      passengerId,
    );
    const fetched = [{
      id: 'ac-server',
      oferta_id: 'of-1',
      estado: 'activo',
      acordos_passageiros: [{ passenger_id: passengerId, estado: 'activo' }],
    }];
    const merged = mergeAcordosPassageiro([optimista], fetched);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('ac-server');
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
