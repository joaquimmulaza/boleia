import { describe, it, expect } from 'vitest';
import { resolveAcordoListaCabecalhoUi } from './resolveAcordoListaCabecalhoUi.js';

describe('resolveAcordoListaCabecalhoUi', () => {
  it('passageiro RLS — chip Activo + lugar Reservado + Grupo · 2', () => {
    const ui = resolveAcordoListaCabecalhoUi({
      acordo: {
        estado: 'activo',
        n_passageiros_contrato: 2,
        acordos_passageiros: [{ passenger_id: 'pax-a', estado: 'reservado' }],
      },
      viewerUserId: 'pax-a',
      tipoPerfil: 'Passageiro',
    });
    expect(ui.estadoChip.label).toBe('Activo');
    expect(ui.mostrarChipLugar).toBe(true);
    expect(ui.rotuloPessoas).toBe('Grupo · 2 pessoas');
  });

  it('passageiro — acordo estado reservado: só Reservado (sem chip lugar duplicado)', () => {
    const ui = resolveAcordoListaCabecalhoUi({
      acordo: {
        estado: 'reservado',
        n_passageiros_contrato: 1,
        acordos_passageiros: [{ passenger_id: 'pax-a', estado: 'reservado' }],
      },
      viewerUserId: 'pax-a',
      tipoPerfil: 'Passageiro',
    });
    expect(ui.estadoChip.label).toBe('Reservado');
    expect(ui.mostrarChipLugar).toBe(false);
    expect(ui.rotuloPessoas).toBe('Individual');
  });

  it('motorista — só reservado nas linhas: chip Reservado e sem grupo', () => {
    const ui = resolveAcordoListaCabecalhoUi({
      acordo: {
        estado: 'activo',
        n_passageiros_contrato: 2,
        acordos_passageiros: [
          { passenger_id: 'p1', estado: 'reservado' },
          { passenger_id: 'p2', estado: 'reservado' },
        ],
      },
      viewerUserId: 'driver-1',
      tipoPerfil: 'Motorista',
    });
    expect(ui.estadoChip.label).toBe('Reservado');
    expect(ui.rotuloPessoas).toBe(null);
  });
});
