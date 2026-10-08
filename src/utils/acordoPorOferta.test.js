import { describe, it, expect } from 'vitest';
import {
  buildAcordoIdPorOfertaMap,
  buildAcordoOptimistaPosAceite,
  mergeAcordosPassageiro,
  ACORDO_OPTIMISTA_TTL_MS,
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
    const now = 1_700_000_000_000;
    const acordo = buildAcordoOptimistaPosAceite(
      { id: 'ac-1', oferta_id: 'of-1' },
      passengerId,
      now,
    );
    expect(acordo).toMatchObject({
      id: 'ac-1',
      oferta_id: 'of-1',
      estado: 'activo',
      acordos_passageiros: [{ passenger_id: passengerId, estado: 'reservado' }],
      _optimista: true,
      _optimistaDesde: now,
    });
    expect(buildAcordoIdPorOfertaMap([acordo], passengerId).get('of-1')).toBe('ac-1');
  });

  describe('mergeAcordosPassageiro', () => {
    const now = 1_700_000_000_000;

    it('remove entrada não-optimista ausente do fetch', () => {
      const prev = [{
        id: 'ac-old',
        oferta_id: 'of-old',
        estado: 'activo',
        acordos_passageiros: [{ passenger_id: passengerId, estado: 'activo' }],
      }];
      expect(mergeAcordosPassageiro(prev, [], now)).toHaveLength(0);
    });

    it('mantém optimista recente quando fetched stale está vazio', () => {
      const optimista = buildAcordoOptimistaPosAceite(
        { id: 'ac-opt', oferta_id: 'of-1' },
        passengerId,
        now,
      );
      const merged = mergeAcordosPassageiro([optimista], [], now);
      expect(merged).toHaveLength(1);
      expect(merged[0].id).toBe('ac-opt');
    });

    it('remove optimista expirada mesmo com fetch vazio', () => {
      const optimista = buildAcordoOptimistaPosAceite(
        { id: 'ac-opt', oferta_id: 'of-1' },
        passengerId,
        now - ACORDO_OPTIMISTA_TTL_MS - 1,
      );
      expect(mergeAcordosPassageiro([optimista], [], now)).toHaveLength(0);
    });

    it('substitui optimista quando fetched traz a mesma oferta_id', () => {
      const optimista = buildAcordoOptimistaPosAceite(
        { id: 'ac-opt', oferta_id: 'of-1' },
        passengerId,
        now,
      );
      const fetched = [{
        id: 'ac-server',
        oferta_id: 'of-1',
        estado: 'activo',
        acordos_passageiros: [{ passenger_id: passengerId, estado: 'activo' }],
      }];
      const merged = mergeAcordosPassageiro([optimista], fetched, now);
      expect(merged).toHaveLength(1);
      expect(merged[0].id).toBe('ac-server');
      expect(merged[0]._optimista).toBeUndefined();
    });
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
