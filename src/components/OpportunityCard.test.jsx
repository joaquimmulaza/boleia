import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { formatKwanza } from '../utils/formatKwanza';
import OpportunityCard from './OpportunityCard';

/** pt-PT usa espaço inseparável; o matcher do DOM normaliza whitespace. */
function textoKz(valor) {
  return new RegExp(`${formatKwanza(valor).replace(/\s/g, '\\s')}\\sKz`);
}

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

describe('OpportunityCard', () => {
  it('o toque abre o detalhe e o CTA não cria proposta', () => {
    const onOpen = vi.fn();
    const onCta = vi.fn();
    render(
      <OpportunityCard kind="oferta" item={ofertaFixa} onOpen={onOpen} onCta={onCta} />,
    );

    fireEvent.click(screen.getByTestId('opportunity-open'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onCta).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Propor acordo' }));
    expect(onCta).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(1);

    const open = screen.getByTestId('opportunity-open');
    expect(open).not.toContainElement(screen.getByRole('button', { name: 'Propor acordo' }));
  });

  it('oferta fixa mostra RouteIndicator e o preço no rodapé', () => {
    render(<OpportunityCard kind="oferta" item={ofertaFixa} onCta={() => {}} />);
    expect(screen.getByTestId('route-indicator')).toBeInTheDocument();
    expect(screen.getByText('Viana')).toBeInTheDocument();
    expect(screen.getByText('Talatona')).toBeInTheDocument();
    expect(screen.getByText(textoKz(10000))).toBeInTheDocument();
    expect(screen.getByText('Por passageiro')).toBeInTheDocument();
    expect(screen.getByTestId('opportunity-footer')).toContainElement(
      screen.getByRole('button', { name: 'Propor acordo' }),
    );
    expect(screen.queryByText(/expirada/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/A partir de/i)).not.toBeInTheDocument();
  });

  it('flexível sem OD não desenha rota e mostra «Disponível para acordos»', () => {
    render(
      <OpportunityCard
        kind="oferta"
        item={{
          ...ofertaFixa,
          flexibilidade_rota: true,
          origin_name: 'Viana',
          destination_name: 'Talatona',
          valor_mensal_ask_kz: null,
        }}
        onCta={() => {}}
      />,
    );
    expect(screen.queryByTestId('route-indicator')).not.toBeInTheDocument();
    expect(screen.queryByText('Viana')).not.toBeInTheDocument();
    expect(screen.queryByText('Talatona')).not.toBeInTheDocument();
    expect(screen.getByText('Disponível para acordos')).toBeInTheDocument();
    expect(screen.getByText('Definido no acordo')).toBeInTheDocument();
    expect(screen.queryByText('Por passageiro')).not.toBeInTheDocument();
    expect(screen.queryByText(/A partir de/i)).not.toBeInTheDocument();
  });

  it('TOTAL_ACORDO no cartão é um único valor, sem multiplicar por N', () => {
    render(
      <OpportunityCard
        kind="oferta"
        item={{
          ...ofertaFixa,
          flexibilidade_rota: true,
          origin_name: null,
          destination_name: null,
          modo_preco: 'TOTAL_ACORDO',
          valor_mensal_ask_kz: 30000,
          vagas_disponiveis: 4,
          n_proposto: 3,
        }}
        onCta={() => {}}
      />,
    );
    expect(screen.getByText(textoKz(30000))).toBeInTheDocument();
    expect(screen.getByText('Total do acordo')).toBeInTheDocument();
    expect(screen.queryByText(textoKz(90000))).not.toBeInTheDocument();
    expect(screen.queryByText(textoKz(120000))).not.toBeInTheDocument();
    expect(screen.queryByTestId('route-indicator')).not.toBeInTheDocument();
    expect(screen.getByText('Disponível para acordos')).toBeInTheDocument();
  });

  it('sem lugares desliga o CTA e escreve a frase; um lugar é texto', () => {
    const { rerender } = render(
      <OpportunityCard
        kind="oferta"
        item={{ ...ofertaFixa, vagas_disponiveis: 0 }}
        onCta={() => {}}
      />,
    );
    expect(screen.getByText('Sem lugares disponíveis')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Propor acordo' })).toBeDisabled();

    rerender(
      <OpportunityCard
        kind="oferta"
        item={{ ...ofertaFixa, vagas_disponiveis: 1 }}
        onCta={() => {}}
      />,
    );
    expect(screen.getByText('1 lugar disponível')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Propor acordo' })).toBeEnabled();
  });

  it('o CTA usa a cor #06130b no rótulo', () => {
    render(<OpportunityCard kind="oferta" item={ofertaFixa} onCta={() => {}} />);
    expect(screen.getByRole('button', { name: 'Propor acordo' }).className).toMatch(/06130b/);
  });

  it('procura e grupo pedem «Enviar proposta»', () => {
    const onCta = vi.fn();
    const { rerender } = render(
      <OpportunityCard
        kind="procura"
        item={{
          origin_name: 'Viana',
          destination_name: 'Talatona',
          preferred_time: '07:15',
          dias_semana: [1, 2, 3, 4, 5],
          n_candidato: 3,
        }}
        onCta={onCta}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Enviar proposta' }));
    expect(onCta).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Definido no acordo/)).not.toBeInTheDocument();

    rerender(
      <OpportunityCard
        kind="grupo"
        item={{ n_pessoas: 2, preferred_time: '07:30', dias_semana: [1, 2, 3, 4, 5] }}
        onCta={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Enviar proposta' })).toBeInTheDocument();
    expect(screen.getByText('Grupo · 2 pessoas')).toBeInTheDocument();
    expect(screen.queryByTestId('route-indicator')).not.toBeInTheDocument();
  });

  it('nome longo fica completo no acessível, com fade de 2 linhas e sem reticências', () => {
    const origem = 'Terminal Rodoviário de Viana, junto ao mercado municipal de Luanda';
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(72);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(48);

    render(
      <OpportunityCard
        kind="oferta"
        item={{ ...ofertaFixa, origin_name: origem }}
        onOpen={() => {}}
      />,
    );

    const linha = screen.getByText(origem);
    expect(linha.className).toMatch(/text-fade-lines/);
    expect(linha.className).not.toMatch(/ellipsis|truncate/);
    expect(linha).toHaveAccessibleName(origem);
    expect(screen.getByTestId('opportunity-open')).toHaveAccessibleName(expect.stringContaining(origem));
  });
});
