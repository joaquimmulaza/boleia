import { describe, it, expect } from 'vitest';
import {
  labelEstadoAcordo,
  variantChipEstadoAcordo,
  chipClassEstadoAcordoVariant,
} from './acordoEstadoDisplay';

describe('labelEstadoAcordo', () => {
  it('mapeia enums conhecidos para copy humana', () => {
    expect(labelEstadoAcordo('activo')).toBe('Activo');
    expect(labelEstadoAcordo('cancelamento_pendente')).toBe('Cancelamento pendente');
    expect(labelEstadoAcordo('cancelado')).toBe('Cancelado');
    expect(labelEstadoAcordo('cancelado_justificado')).toBe('Cancelado por justa causa');
    expect(labelEstadoAcordo('suspenso')).toBe('Suspenso');
  });

  it('cancelado com encerramento_motivo sem_lugares_vivos mostra Encerrado', () => {
    expect(
      labelEstadoAcordo('cancelado', 'sem_lugares_vivos'),
    ).toBe('Encerrado');
    expect(
      labelEstadoAcordo({ estado: 'cancelado', encerramento_motivo: 'sem_lugares_vivos' }),
    ).toBe('Encerrado');
  });

  it('cancelado real (rescisão confirmada ou justa causa) mantém Cancelado', () => {
    expect(labelEstadoAcordo('cancelado', null)).toBe('Cancelado');
    expect(labelEstadoAcordo('cancelado', undefined)).toBe('Cancelado');
    expect(
      labelEstadoAcordo({
        estado: 'cancelado',
        encerramento_motivo: 'sem_lugares_vivos',
        rescisao_modo: 'consensual',
        rescisao_confirmada_em: '2026-10-01T12:00:00Z',
      }),
    ).toBe('Cancelado');
    expect(
      labelEstadoAcordo({
        estado: 'cancelado',
        encerramento_motivo: 'sem_lugares_vivos',
        rescisao_modo: 'justa_causa',
      }),
    ).toBe('Cancelado');
  });

  it('consensual pendente (sem confirmação) com sem_lugares_vivos mostra Encerrado', () => {
    expect(
      labelEstadoAcordo({
        estado: 'cancelado',
        encerramento_motivo: 'sem_lugares_vivos',
        rescisao_modo: 'consensual',
        rescisao_confirmada_em: null,
      }),
    ).toBe('Encerrado');
    expect(
      variantChipEstadoAcordo({
        estado: 'cancelado',
        encerramento_motivo: 'sem_lugares_vivos',
        rescisao_modo: 'consensual',
      }),
    ).toBe('encerrado');
  });

  it('não devolve snake_case cru', () => {
    expect(labelEstadoAcordo('cancelamento_pendente')).not.toMatch(/_/);
  });
});

describe('variantChipEstadoAcordo', () => {
  it('cancelamento_pendente usa variante pendente', () => {
    expect(variantChipEstadoAcordo('cancelamento_pendente')).toBe('pendente');
  });

  it('encerrado distingue de cancelado inactivo', () => {
    expect(
      variantChipEstadoAcordo({
        estado: 'cancelado',
        encerramento_motivo: 'sem_lugares_vivos',
      }),
    ).toBe('encerrado');
    expect(variantChipEstadoAcordo('cancelado')).toBe('inactivo');
    expect(chipClassEstadoAcordoVariant('encerrado')).not.toBe(
      chipClassEstadoAcordoVariant('inactivo'),
    );
  });
});
