import { describe, it, expect } from 'vitest';
import {
  labelEstadoAcordo,
  variantChipEstadoAcordo,
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

  it('cancelado real (rescisão ou outro) mantém Cancelado', () => {
    expect(labelEstadoAcordo('cancelado', null)).toBe('Cancelado');
    expect(labelEstadoAcordo('cancelado', undefined)).toBe('Cancelado');
    expect(
      labelEstadoAcordo({
        estado: 'cancelado',
        encerramento_motivo: 'sem_lugares_vivos',
        rescisao_modo: 'consensual',
      }),
    ).toBe('Cancelado');
  });

  it('não devolve snake_case cru', () => {
    expect(labelEstadoAcordo('cancelamento_pendente')).not.toMatch(/_/);
  });
});

describe('variantChipEstadoAcordo', () => {
  it('cancelamento_pendente usa variante pendente', () => {
    expect(variantChipEstadoAcordo('cancelamento_pendente')).toBe('pendente');
  });
});
