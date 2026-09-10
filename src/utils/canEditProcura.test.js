import { describe, it, expect } from 'vitest';
import { canEditProcura } from './canEditProcura.js';

describe('canEditProcura', () => {
  it('permite activa e em_negociacao sem acordo', () => {
    expect(canEditProcura({ estado: 'activa' })).toBe(true);
    expect(canEditProcura({ estado: 'em_negociacao' })).toBe(true);
  });

  it('bloqueia fechada, cancelada ou acordo activo', () => {
    expect(canEditProcura({ estado: 'fechada' })).toBe(false);
    expect(canEditProcura({ estado: 'cancelada' })).toBe(false);
    expect(canEditProcura({ estado: 'activa' }, { temAcordoActivo: true })).toBe(false);
  });
});
