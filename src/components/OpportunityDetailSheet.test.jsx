import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { formatKwanza } from '../utils/formatKwanza';
import OpportunityDetailSheet from './OpportunityDetailSheet';

function textoKz(valor) {
  return new RegExp(`${formatKwanza(valor).replace(/\s/g, '\\s')}\\sKz`);
}

const ofertaFlexTotal = {
  flexibilidade_rota: true,
  origin_name: 'Viana',
  destination_name: 'Talatona',
  departure_time: '06:00',
  dias_semana: [1, 2, 3, 4, 5],
  vagas_disponiveis: 4,
  valor_mensal_ask_kz: 30000,
  modo_preco: 'TOTAL_ACORDO',
  n_proposto: 3,
  n_actual: 4,
};

describe('OpportunityDetailSheet', () => {
  it('flexível total do acordo mostra a frase, o horário e um preço, sem rota nem × N', () => {
    render(
      <OpportunityDetailSheet kind="oferta" item={ofertaFlexTotal} onClose={() => {}} onCta={() => {}} />,
    );

    expect(screen.getByRole('heading', { name: 'Oferta flexível' })).toBeInTheDocument();
    expect(screen.getByText('Disponível para acordos')).toBeInTheDocument();
    expect(screen.getByText('06:00')).toBeInTheDocument();
    expect(screen.getByText('Seg–Sex')).toBeInTheDocument();
    expect(screen.getByText('4 lugares disponíveis')).toBeInTheDocument();
    expect(screen.getByText(textoKz(30000))).toBeInTheDocument();
    expect(screen.getByText('Total do acordo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Propor acordo' })).toBeInTheDocument();
    expect(screen.queryByTestId('route-indicator')).not.toBeInTheDocument();
    expect(screen.queryByText('Viana')).not.toBeInTheDocument();
    expect(screen.queryByText('Talatona')).not.toBeInTheDocument();
    expect(screen.queryByText(textoKz(90000))).not.toBeInTheDocument();
    expect(screen.queryByText(textoKz(120000))).not.toBeInTheDocument();
    expect(screen.queryByText(/06:00–08:30/)).not.toBeInTheDocument();
  });

  it('oferta fixa desenha o RouteIndicator com a origem e o destino reais', () => {
    render(
      <OpportunityDetailSheet
        kind="oferta"
        item={{
          flexibilidade_rota: false,
          origin_name: 'Viana',
          destination_name: 'Talatona',
          departure_time: '07:15',
          dias_semana: [1, 2, 3, 4, 5],
          vagas_disponiveis: 4,
          valor_mensal_ask_kz: 10000,
          modo_preco: 'POR_PASSAGEIRO',
        }}
        onClose={() => {}}
        onCta={() => {}}
      />,
    );

    expect(screen.getByTestId('route-indicator')).toBeInTheDocument();
    expect(screen.getByText('Viana')).toBeInTheDocument();
    expect(screen.getByText('Talatona')).toBeInTheDocument();
    expect(screen.queryByText('Disponível para acordos')).not.toBeInTheDocument();
  });

  it('oferta fixa sem destino não inventa rota', () => {
    render(
      <OpportunityDetailSheet
        kind="oferta"
        item={{
          flexibilidade_rota: false,
          origin_name: 'Viana',
          destination_name: null,
          departure_time: '07:15',
          vagas_disponiveis: 2,
          valor_mensal_ask_kz: 10000,
          modo_preco: 'POR_PASSAGEIRO',
        }}
        onClose={() => {}}
      />,
    );

    expect(screen.queryByTestId('route-indicator')).not.toBeInTheDocument();
    expect(screen.queryByText('Destino')).not.toBeInTheDocument();
    expect(screen.queryByText('Viana')).not.toBeInTheDocument();
  });

  it('mostra CTA desactivado quando ctaDisabled sem onCta', () => {
    render(
      <OpportunityDetailSheet
        kind="oferta"
        item={ofertaFlexTotal}
        onClose={() => {}}
        ctaLabel="Proposta enviada"
        ctaDisabled
      />,
    );

    const btn = screen.getByRole('button', { name: 'Proposta enviada' });
    expect(btn).toBeDisabled();
  });

  it('o nome no detalhe é o texto completo, sem fade nem reticências', () => {
    const origem = 'Terminal Rodoviário de Viana, junto ao mercado municipal de Luanda, paragem norte';
    render(
      <OpportunityDetailSheet
        kind="oferta"
        item={{
          flexibilidade_rota: false,
          origin_name: origem,
          destination_name: 'Talatona',
          departure_time: '07:15',
          vagas_disponiveis: 2,
          valor_mensal_ask_kz: 10000,
          modo_preco: 'POR_PASSAGEIRO',
        }}
        onClose={() => {}}
      />,
    );

    const linha = screen.getByText(origem);
    expect(linha.className).not.toMatch(/ellipsis|truncate|line-clamp|text-fade/);
    expect(linha.className).toMatch(/break-words/);
    expect(linha).toHaveTextContent(origem);
  });
});
