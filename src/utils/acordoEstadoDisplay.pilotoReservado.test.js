import { describe, it, expect } from 'vitest';
import {
  labelEstadoAcordo,
  variantChipEstadoAcordo,
  labelChipListaEstadoAcordo,
  variantChipListaEstadoAcordo,
  acordoEstadoListaChipProps,
} from './acordoEstadoDisplay';

describe('acordoEstadoDisplay — piloto reservado (chip cabeçalho vs lugares)', () => {
  const cabecalhoActivo = { estado: 'activo' };

  it('só reservado — nunca «Activo»', () => {
    const acordo = {
      ...cabecalhoActivo,
      acordos_passageiros: [
        { passenger_id: 'p1', estado: 'reservado' },
        { passenger_id: 'p2', estado: 'reservado' },
      ],
    };
    expect(labelEstadoAcordo(acordo)).toBe('Reservado');
    expect(labelEstadoAcordo(acordo)).not.toBe('Activo');
    expect(variantChipEstadoAcordo(acordo)).toBe('pendente');
    expect(labelChipListaEstadoAcordo(acordo, 'p1')).toBe('Reservado');
    expect(variantChipListaEstadoAcordo(acordo, 'p1')).toBe('pendente');
  });

  it('misto activo + reservado — «Activo»', () => {
    const acordo = {
      ...cabecalhoActivo,
      acordos_passageiros: [
        { passenger_id: 'p1', estado: 'activo' },
        { passenger_id: 'p2', estado: 'reservado' },
      ],
    };
    expect(labelEstadoAcordo(acordo)).toBe('Activo');
    expect(variantChipEstadoAcordo(acordo)).toBe('activo');
  });

  it('só activo — «Activo»', () => {
    const acordo = {
      ...cabecalhoActivo,
      acordos_passageiros: [
        { passenger_id: 'p1', estado: 'activo' },
        { passenger_id: 'p2', estado: 'activo' },
      ],
    };
    expect(labelEstadoAcordo(acordo)).toBe('Activo');
    expect(variantChipEstadoAcordo(acordo)).toBe('activo');
  });

  it('sem linhas de passageiros mantém «Activo» (legado string)', () => {
    expect(labelEstadoAcordo('activo')).toBe('Activo');
    expect(variantChipEstadoAcordo('activo')).toBe('activo');
  });

  it('ignorarChipPorLugares — RLS só linha reservado mantém chip «Activo» do cabeçalho', () => {
    const acordoRls = {
      estado: 'activo',
      n_passageiros_contrato: 2,
      acordos_passageiros: [{ passenger_id: 'pax-a', estado: 'reservado' }],
    };
    expect(acordoEstadoListaChipProps(acordoRls, 'pax-a').label).toBe('Reservado');
    expect(acordoEstadoListaChipProps(acordoRls, 'pax-a', { ignorarChipPorLugares: true }).label).toBe(
      'Activo',
    );
  });
});
