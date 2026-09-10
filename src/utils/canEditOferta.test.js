import { describe, it, expect } from 'vitest';
import { canEditOferta, canDespublicarOferta } from './canEditOferta.js';

describe('canEditOferta', () => {
  it('permite editar oferta disponível, parcial ou cheia', () => {
    expect(canEditOferta({ estado: 'disponivel' })).toBe(true);
    expect(canEditOferta({ estado: 'parcial' })).toBe(true);
    expect(canEditOferta({ estado: 'cheia' })).toBe(true);
  });

  it('bloqueia oferta inactiva', () => {
    expect(canEditOferta({ estado: 'inactiva' })).toBe(false);
  });

  it('despublicar bloqueia com acordo activo', () => {
    expect(canDespublicarOferta({ estado: 'disponivel' }, { temAcordoActivo: true })).toBe(false);
    expect(canDespublicarOferta({ estado: 'disponivel' }, { temAcordoActivo: false })).toBe(true);
  });
});
