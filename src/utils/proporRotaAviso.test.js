import { describe, it, expect } from 'vitest';
import { buildAvisoProporRota } from './proporRotaAviso';

describe('aviso ao propor rota diferente', () => {
  it('nomeia a oferta e a procura', () => {
    expect(buildAvisoProporRota(
      { origin_name: 'Viana', destination_name: 'Cacuaco' },
      { origin_name: 'Talatona', origin_lat: -8.9, destination_name: 'Centro', destination_lat: -8.8 },
    )).toBe(
      'Esta oferta vai de Viana a Cacuaco e a tua procura é Talatona → Centro. Queres propor na mesma?',
    );
  });

  it('diz que a oferta não tem rota fixa quando faltam os nomes', () => {
    expect(buildAvisoProporRota(
      { flexibilidade_rota: true },
      { origin_name: 'Talatona', origin_lat: -8.9, destination_name: 'Centro', destination_lat: -8.8 },
    )).toBe(
      'Esta oferta não tem origem e destino fixos e a tua procura é Talatona → Centro. Queres propor na mesma?',
    );
  });
});