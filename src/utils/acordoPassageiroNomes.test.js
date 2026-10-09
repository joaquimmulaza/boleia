import { describe, expect, it } from 'vitest';
import { mergeNomesPassageirosAcordo } from './acordoPassageiroNomes';

describe('mergeNomesPassageirosAcordo', () => {
  it('preenche perfis.nome_completo a partir de contactos RPC', () => {
    const acordo = {
      id: 'a1',
      acordos_passageiros: [
        { passenger_id: 'p1', estado: 'activo' },
        { passenger_id: 'p2', estado: 'activo' },
      ],
    };
    const merged = mergeNomesPassageirosAcordo(acordo, {
      contactos: {
        passageiros: [
          { passenger_id: 'p1', nome_completo: 'Ana Costa' },
          { passenger_id: 'p2', nome_completo: 'Bruno Silva' },
        ],
      },
    });
    expect(merged.acordos_passageiros[0].perfis.nome_completo).toBe('Ana Costa');
    expect(merged.acordos_passageiros[1].perfis.nome_completo).toBe('Bruno Silva');
  });

  it('motorista pagamentos complementa nomes em falta', () => {
    const acordo = {
      id: 'a1',
      acordos_passageiros: [{ passenger_id: 'p9', estado: 'activo' }],
    };
    const merged = mergeNomesPassageirosAcordo(acordo, {
      motoristaPagamentos: [{ passenger_id: 'p9', passenger_nome: 'Carla' }],
    });
    expect(merged.acordos_passageiros[0].perfis.nome_completo).toBe('Carla');
  });
});
