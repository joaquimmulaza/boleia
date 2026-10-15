import { describe, it, expect } from 'vitest';
import { partitionAcordosLista } from './acordoListGrouping.js';

describe('partitionAcordosLista — P1-e', () => {
  const acordoMulti = {
    id: 'acordo-multi',
    estado: 'activo',
    acordos_passageiros: [
      { passenger_id: 'pax-a', estado: 'saiu' },
      { passenger_id: 'pax-b', estado: 'activo' },
    ],
  };

  it('passageiro A (saiu) vê Encerrados; B (activo) vê Activos', () => {
    const lista = [acordoMulti];
    const a = partitionAcordosLista(lista, {
      tipoPerfil: 'Passageiro',
      viewerUserId: 'pax-a',
    });
    expect(a.activos).toHaveLength(0);
    expect(a.encerrados).toHaveLength(1);

    const b = partitionAcordosLista(lista, {
      tipoPerfil: 'Passageiro',
      viewerUserId: 'pax-b',
    });
    expect(b.activos).toHaveLength(1);
    expect(b.encerrados).toHaveLength(0);
  });

  it('motorista agrupa pelo estado do acordo', () => {
    const r = partitionAcordosLista([acordoMulti], {
      tipoPerfil: 'Motorista',
      viewerUserId: 'driver-1',
    });
    expect(r.activos).toHaveLength(1);
    expect(r.encerrados).toHaveLength(0);
  });
});
