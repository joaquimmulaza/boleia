import { describe, it, expect } from 'vitest';
import { canReactivarOferta } from './canReactivarOferta.js';

describe('canReactivarOferta', () => {
  const motoristaInactiva = {
    estado: 'inactiva',
    inactiva_motivo: 'motorista',
  };

  it('permite oferta inactiva despublicada pelo motorista', () => {
    expect(canReactivarOferta(motoristaInactiva)).toBe(true);
  });

  it('permite is_test (motorista QA)', () => {
    expect(canReactivarOferta({ ...motoristaInactiva, is_test: true })).toBe(true);
  });

  it('bloqueia oferta activa', () => {
    expect(canReactivarOferta({ ...motoristaInactiva, estado: 'disponivel' })).toBe(false);
  });

  it('bloqueia inactiva sem motivo motorista', () => {
    expect(canReactivarOferta({ ...motoristaInactiva, inactiva_motivo: null })).toBe(false);
    expect(canReactivarOferta({ ...motoristaInactiva, inactiva_motivo: 'admin' })).toBe(false);
  });
});
