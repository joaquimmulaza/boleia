import { describe, it, expect } from 'vitest';
import { deveChamarGetAcordoContactos } from './acordoContactosGate.js';

describe('deveChamarGetAcordoContactos — P1-b', () => {
  it('passageiro reservado ou activo — sim', () => {
    expect(
      deveChamarGetAcordoContactos({
        tipoPerfil: 'Passageiro',
        acordoEstado: 'activo',
        minhaLinhaEstado: 'reservado',
      }),
    ).toBe(true);
  });

  it('passageiro saiu — não chama RPC', () => {
    expect(
      deveChamarGetAcordoContactos({
        tipoPerfil: 'Passageiro',
        acordoEstado: 'activo',
        minhaLinhaEstado: 'saiu',
      }),
    ).toBe(false);
  });

  it('motorista acordo activo — sim', () => {
    expect(
      deveChamarGetAcordoContactos({
        tipoPerfil: 'Motorista',
        acordoEstado: 'activo',
      }),
    ).toBe(true);
  });

  it('motorista acordo cancelado — não', () => {
    expect(
      deveChamarGetAcordoContactos({
        tipoPerfil: 'Motorista',
        acordoEstado: 'cancelado',
      }),
    ).toBe(false);
  });
});
