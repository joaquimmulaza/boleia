import { describe, it, expect } from 'vitest';
import { formatKwanza } from './formatKwanza';
import {
  CTA_LABEL,
  isLiveOpportunity,
  resolveOpportunityCard,
} from './opportunityCard';

const ofertaFixa = {
  id: 'of-1',
  flexibilidade_rota: false,
  origin_name: 'Viana',
  destination_name: 'Talatona',
  departure_time: '07:15:00',
  dias_semana: [1, 2, 3, 4, 5],
  vagas_disponiveis: 4,
  valor_mensal_ask_kz: 10000,
  modo_preco: 'POR_PASSAGEIRO',
  estado: 'disponivel',
};

describe('opportunityCard — rota e preço', () => {
  it('oferta fixa expõe origem e destino reais para o RouteIndicator', () => {
    const card = resolveOpportunityCard({ kind: 'oferta', item: ofertaFixa });
    expect(card.rota).toEqual({ origem: 'Viana', destino: 'Talatona' });
    expect(card.headline).toBeNull();
    expect(card.tipo).toBe('Oferta fixa');
  });

  it('oferta flexível não inventa rota e usa «Disponível para acordos»', () => {
    const card = resolveOpportunityCard({
      kind: 'oferta',
      item: {
        ...ofertaFixa,
        flexibilidade_rota: true,
        origin_name: null,
        destination_name: null,
        valor_mensal_ask_kz: 8000,
      },
    });
    expect(card.rota).toBeNull();
    expect(card.headline).toBe('Disponível para acordos');
    expect(card.tipo).toBe('Oferta flexível');
    expect(JSON.stringify(card)).not.toMatch(/origem\/destino|A partir de|zona/i);
  });

  it('TOTAL_ACORDO mostra o valor uma vez e não multiplica por N', () => {
    const card = resolveOpportunityCard({
      kind: 'oferta',
      item: {
        ...ofertaFixa,
        flexibilidade_rota: true,
        origin_name: null,
        destination_name: null,
        modo_preco: 'TOTAL_ACORDO',
        valor_mensal_ask_kz: 30000,
        vagas_disponiveis: 4,
        n_proposto: 4,
      },
    });
    expect(card.preco).toEqual({
      valor: `${formatKwanza(30000)} Kz`,
      modo: 'Total do acordo',
    });
    expect(card.preco.valor).not.toContain(formatKwanza(120000));
    expect(card.headline).toBe('Disponível para acordos');
    expect(card.rota).toBeNull();
  });

  it('sem preço na oferta flexível diz «Definido no acordo» e nunca «A partir de»', () => {
    const card = resolveOpportunityCard({
      kind: 'oferta',
      item: {
        ...ofertaFixa,
        flexibilidade_rota: true,
        origin_name: null,
        destination_name: null,
        valor_mensal_ask_kz: null,
      },
    });
    expect(card.preco).toEqual({ valor: 'Definido no acordo', modo: null });
    expect(JSON.stringify(card)).not.toMatch(/A partir de/);
  });

  it('procura e grupo usam «Enviar proposta» e a oferta «Propor acordo»', () => {
    expect(CTA_LABEL.oferta).toBe('Propor acordo');
    expect(CTA_LABEL.procura).toBe('Enviar proposta');
    expect(CTA_LABEL.grupo).toBe('Enviar proposta');
    const procura = resolveOpportunityCard({
      kind: 'procura',
      item: {
        origin_name: 'Viana',
        destination_name: 'Talatona',
        preferred_time: '07:15',
        dias_semana: [1, 2, 3, 4, 5],
        n_candidato: 3,
        estado: 'activa',
      },
    });
    expect(procura.cta).toBe('Enviar proposta');
    expect(procura.preco).toBeNull();
    expect(procura.capacidade).toBe('3 passageiros');
    expect(procura.rota).toEqual({ origem: 'Viana', destino: 'Talatona' });
  });

  it('zero lugares desliga o CTA e um lugar é texto', () => {
    const vazio = resolveOpportunityCard({
      kind: 'oferta',
      item: { ...ofertaFixa, vagas_disponiveis: 0 },
    });
    expect(vazio.capacidade).toBe('Sem lugares disponíveis');
    expect(vazio.ctaDisabled).toBe(true);

    const um = resolveOpportunityCard({
      kind: 'oferta',
      item: { ...ofertaFixa, vagas_disponiveis: 1 },
    });
    expect(um.capacidade).toBe('1 lugar disponível');
    expect(um.ctaDisabled).toBe(false);
  });

  it('horário flexível e fixo vêm dos dados, sem janela inventada', () => {
    const fixa = resolveOpportunityCard({ kind: 'oferta', item: ofertaFixa });
    expect(fixa.horario).toEqual(['07:15 · Seg–Sex']);

    const flex = resolveOpportunityCard({
      kind: 'oferta',
      item: {
        ...ofertaFixa,
        flexibilidade_rota: true,
        departure_time: '06:00',
        dias_semana: [1, 2, 3, 4, 5],
      },
    });
    expect(flex.horario).toEqual(['06:00', 'Seg–Sex']);
    expect(flex.horario.join(' ')).not.toMatch(/08:30/);
  });
});

describe('opportunityCard — só oportunidades vivas', () => {
  it('aceita oferta disponivel/parcial e procura activa/em negociação', () => {
    expect(isLiveOpportunity('oferta', { estado: 'disponivel' })).toBe(true);
    expect(isLiveOpportunity('oferta', { estado: 'Parcial' })).toBe(true);
    expect(isLiveOpportunity('procura', { estado: 'activa' })).toBe(true);
    expect(isLiveOpportunity('procura', { estado: 'em_negociacao' })).toBe(true);
  });

  it('rejeita cancelada, expirada e inactiva — o cartão não tem esse estado', () => {
    expect(isLiveOpportunity('oferta', { estado: 'expirada' })).toBe(false);
    expect(isLiveOpportunity('oferta', { estado: 'cancelada' })).toBe(false);
    expect(isLiveOpportunity('oferta', { estado: 'inactiva' })).toBe(false);
    expect(isLiveOpportunity('procura', { estado: 'cancelada' })).toBe(false);
    const card = resolveOpportunityCard({ kind: 'oferta', item: ofertaFixa });
    expect(card.estadoLabel).toBeUndefined();
    expect(JSON.stringify(card)).not.toMatch(/expirada/i);
  });
});
