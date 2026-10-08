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

  it('não devolve snake_case cru', () => {
    expect(labelEstadoAcordo('cancelamento_pendente')).not.toMatch(/_/);
  });
});

describe('variantChipEstadoAcordo', () => {
  it('cancelamento_pendente usa variante pendente', () => {
    expect(variantChipEstadoAcordo('cancelamento_pendente')).toBe('pendente');
  });
});
