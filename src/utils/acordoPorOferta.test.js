import { describe, it, expect, vi } from 'vitest';
import {
  buildAcordoIdPorOfertaMap,
  buildAcordoOptimistaPosAceite,
  mergeAcordosPassageiro,
  isAcordoVivoParaPassageiro,
  isOptimistaExpirada,
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

  it('expirado + activo na mesma oferta_id aponta para o vivo em qualquer ordem', () => {
    const vivo = {
      id: 'ac-vivo',
      oferta_id: 'of-1',
      estado: 'activo',
      acordos_passageiros: [{ passenger_id: passengerId, estado: 'reservado' }],
    };
    const morto = {
      id: 'ac-morto',
      oferta_id: 'of-1',
      estado: 'activo',
      acordos_passageiros: [{ passenger_id: passengerId, estado: 'expirado' }],
    };

    expect(buildAcordoIdPorOfertaMap([morto, vivo], passengerId).get('of-1')).toBe('ac-vivo');
    expect(buildAcordoIdPorOfertaMap([vivo, morto], passengerId).get('of-1')).toBe('ac-vivo');
    expect(isAcordoVivoParaPassageiro(morto, passengerId)).toBe(false);
    expect(isAcordoVivoParaPassageiro(vivo, passengerId)).toBe(true);
  });

  it('ignora optimista expirada no mapa CTA (TTL)', () => {
    vi.useFakeTimers();
    const now = 1_700_000_000_000;
    vi.setSystemTime(now);

    const optimista = buildAcordoOptimistaPosAceite(
      { id: 'ac-opt', oferta_id: 'of-1' },
      passengerId,
      now,
    );
    expect(buildAcordoIdPorOfertaMap([optimista], passengerId, now).get('of-1')).toBe('ac-opt');

    const expiredNow = now + ACORDO_OPTIMISTA_TTL_MS;
    vi.setSystemTime(expiredNow);
    expect(isOptimistaExpirada(optimista, expiredNow)).toBe(true);
    expect(buildAcordoIdPorOfertaMap([optimista], passengerId, expiredNow).size).toBe(0);

    vi.useRealTimers();
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
    expect(buildAcordoIdPorOfertaMap([acordo], passengerId, now).get('of-1')).toBe('ac-1');
  });

  it('buildAcordoOptimistaPosAceite não sintetiza linha quando dono não está em memberIds', () => {
    const now = 1_700_000_000_000;
    expect(
      buildAcordoOptimistaPosAceite(
        { id: 'ac-grp', oferta_id: 'of-grp' },
        'owner-1',
        now,
        ['membro-a', 'membro-b'],
      ),
    ).toBeNull();
  });

  it('buildAcordoOptimistaPosAceite usa linhas RPC quando dono não seleccionado mas tem linha', () => {
    const now = 1_700_000_000_000;
    const acordo = buildAcordoOptimistaPosAceite(
      {
        id: 'ac-grp',
        oferta_id: 'of-grp',
        acordos_passageiros: [{ passenger_id: 'owner-1', estado: 'activo' }],
      },
      'owner-1',
      now,
      ['membro-a'],
    );
    expect(acordo?.acordos_passageiros).toEqual([
      { passenger_id: 'owner-1', estado: 'activo' },
    ]);
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
      expect(mergeAcordosPassageiro(prev, [], passengerId, now)).toHaveLength(0);
    });

    it('devolve fetch inalterado (inclui acordos mortos)', () => {
      const mortoA = {
        id: 'ac-morto-a',
        oferta_id: 'of-1',
        estado: 'activo',
        acordos_passageiros: [{ passenger_id: passengerId, estado: 'expirado' }],
      };
      const mortoB = {
        id: 'ac-morto-b',
        oferta_id: 'of-2',
        estado: 'cancelado',
        acordos_passageiros: [{ passenger_id: passengerId, estado: 'activo' }],
      };
      const fetched = [mortoA, mortoB];
      expect(mergeAcordosPassageiro([], fetched, passengerId, now)).toEqual(fetched);
    });

    it('mantém optimista recente quando fetched stale está vazio', () => {
      const optimista = buildAcordoOptimistaPosAceite(
        { id: 'ac-opt', oferta_id: 'of-1' },
        passengerId,
        now,
      );
      const merged = mergeAcordosPassageiro([optimista], [], passengerId, now);
      expect(merged).toHaveLength(1);
      expect(merged[0].id).toBe('ac-opt');
    });

    it('P1: descarta optimista quando fetch traz o mesmo acordo terminado (sem Ver acordo)', () => {
      const optimista = buildAcordoOptimistaPosAceite(
        { id: 'ac-opt', oferta_id: 'of-1' },
        passengerId,
        now,
      );
      const morto = {
        id: 'ac-opt',
        oferta_id: 'of-1',
        estado: 'cancelado',
        acordos_passageiros: [{ passenger_id: passengerId, estado: 'saiu' }],
      };
      const merged = mergeAcordosPassageiro([optimista], [morto], passengerId, now);
      expect(merged).toHaveLength(1);
      expect(merged[0].id).toBe('ac-opt');
      expect(buildAcordoIdPorOfertaMap(merged, passengerId, now).size).toBe(0);
    });

    it('mantém optimista quando fetch traz acordo morto na mesma oferta mas id diferente (re-join)', () => {
      const optimista = buildAcordoOptimistaPosAceite(
        { id: 'ac-novo', oferta_id: 'of-1' },
        passengerId,
        now,
      );
      const mortoAntigo = {
        id: 'ac-antigo',
        oferta_id: 'of-1',
        estado: 'cancelado',
        acordos_passageiros: [{ passenger_id: passengerId, estado: 'saiu' }],
      };
      const merged = mergeAcordosPassageiro([optimista], [mortoAntigo], passengerId, now);
      expect(merged).toHaveLength(2);
      expect(merged.some((a) => a.id === 'ac-novo' && a._optimista)).toBe(true);
      expect(buildAcordoIdPorOfertaMap(merged, passengerId, now).get('of-1')).toBe('ac-novo');
    });

    it('optimista não sobrevive quando fetch traz acordo vivo na mesma oferta', () => {
      const optimista = buildAcordoOptimistaPosAceite(
        { id: 'ac-opt', oferta_id: 'of-1' },
        passengerId,
        now,
      );
      const vivo = {
        id: 'ac-server',
        oferta_id: 'of-1',
        estado: 'activo',
        acordos_passageiros: [{ passenger_id: passengerId, estado: 'activo' }],
      };
      const merged = mergeAcordosPassageiro([optimista], [vivo], passengerId, now);
      expect(merged).toHaveLength(1);
      expect(merged[0].id).toBe('ac-server');
      expect(merged[0]._optimista).toBeUndefined();
    });

    it('remove optimista expirada mesmo com fetch vazio', () => {
      const optimista = buildAcordoOptimistaPosAceite(
        { id: 'ac-opt', oferta_id: 'of-1' },
        passengerId,
        now - ACORDO_OPTIMISTA_TTL_MS - 1,
      );
      expect(mergeAcordosPassageiro([optimista], [], passengerId, now)).toHaveLength(0);
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
