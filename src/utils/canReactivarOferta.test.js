import { describe, it, expect } from 'vitest';
import { canReactivarOferta } from './canReactivarOferta.js';

describe('canReactivarOferta', () => {
  const motoristaInactiva = {
    estado: 'inactiva',
    inactiva_motivo: 'motorista',
    is_test: false,
    hidden_by_admin: false,
  };

  it('permite oferta inactiva despublicada pelo motorista', () => {
    expect(canReactivarOferta(motoristaInactiva)).toBe(true);
  });

  it('bloqueia oferta activa', () => {
    expect(canReactivarOferta({ ...motoristaInactiva, estado: 'disponivel' })).toBe(false);
  });

  it('bloqueia inactiva sem motivo motorista', () => {
    expect(canReactivarOferta({ ...motoristaInactiva, inactiva_motivo: null })).toBe(false);
    expect(canReactivarOferta({ ...motoristaInactiva, inactiva_motivo: 'admin' })).toBe(false);
  });

  it('bloqueia is_test', () => {
    expect(canReactivarOferta({ ...motoristaInactiva, is_test: true })).toBe(false);
  });

  it('bloqueia hidden_by_admin', () => {
    expect(canReactivarOferta({ ...motoristaInactiva, hidden_by_admin: true })).toBe(false);
  });
});
