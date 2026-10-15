import { describe, it, expect } from 'vitest';
import { resolvePessoasAcordoUi, labelPessoasNoAcordoContrato } from './resolvePessoasAcordoUi.js';

describe('resolvePessoasAcordoUi — fonte única contrato + vivos', () => {
  it('labelPessoasNoAcordoContrato nunca usa nome de passageiro', () => {
    expect(labelPessoasNoAcordoContrato(1, 'Critiquito Prod Passenger')).toBe('Individual');
    expect(labelPessoasNoAcordoContrato(3)).toBe('Grupo · 3 pessoas');
  });

  it('b4010c7e — motorista encerrado, individual, só linha saiu: Individual + 0 vivos', () => {
    const ui = resolvePessoasAcordoUi(
      {
        n_passageiros_contrato: 1,
        modo_preco: 'POR_PASSAGEIRO',
        valor_mensal_por_passageiro_kz: 22000,
        valor_mensal_total_kz: 22000,
      },
      [
        {
          id: 'ap-crit',
          passenger_id: 'pax-crit',
          estado: 'saiu',
          quota_mensal_kz: 22000,
          perfis: { nome_completo: 'Critiquito Prod Passenger' },
        },
      ],
    );
    expect(ui.nLabel).toBe('Individual');
    expect(ui.nPassageirosVivos).toBe(0);
    expect(ui.nLabel).not.toMatch(/Critiquito/i);
  });
});
