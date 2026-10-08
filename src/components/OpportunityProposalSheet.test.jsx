import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { formatKwanza } from '../utils/formatKwanza';
import { COPY_N_FIXO } from '../utils/opportunityProposal';
import OpportunityProposalSheet from './OpportunityProposalSheet';

function textoKz(valor) {
  return new RegExp(`${formatKwanza(valor).replace(/\s/g, '\\s')}\\sKz`);
}

const procura = {
  origin_name: 'Viana',
  destination_name: 'Talatona',
  preferred_time: '07:15',
  dias_semana: [1, 2, 3, 4, 5],
  n_candidato: 8,
  n_actual: 8,
};

describe('OpportunityProposalSheet', () => {
  it('motorista para grupo e para passageiro fixa o número nesta proposta', () => {
    const { rerender } = render(
      <OpportunityProposalSheet
        papel="motorista"
        alvo="grupo"
        item={{ ...procura, nome: 'Grupo da paróquia de Viana' }}
        nProposto={3}
        valorKz={10000}
        modoPreco="POR_PASSAGEIRO"
        onClose={() => {}}
        onSubmit={() => {}}
      />,
    );

    expect(screen.getByText(COPY_N_FIXO)).toBeInTheDocument();
    const rotaGrupo = screen.getByTestId('route-indicator').parentElement;
    expect(within(rotaGrupo).getByText('Grupo da paróquia de Viana')).toBeInTheDocument();
    expect(within(rotaGrupo).getByText('Viana')).toBeInTheDocument();
    expect(within(rotaGrupo).getByText('Talatona')).toBeInTheDocument();
    expect(screen.getByText('3 passageiros')).toBeInTheDocument();
    expect(screen.getByText(textoKz(30000))).toBeInTheDocument();
    expect(screen.queryByText(textoKz(80000))).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mais passageiros' })).not.toBeInTheDocument();

    rerender(
      <OpportunityProposalSheet
        papel="motorista"
        alvo="passageiro"
        item={procura}
        nProposto={1}
        valorKz={10000}
        modoPreco="POR_PASSAGEIRO"
        onClose={() => {}}
        onSubmit={() => {}}
      />,
    );

    expect(screen.getByText(COPY_N_FIXO)).toBeInTheDocument();
    expect(screen.getByText('1 passageiro')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mais passageiros' })).not.toBeInTheDocument();
  });

  it('total do acordo no sheet do motorista é um preço, sem × N', () => {
    render(
      <OpportunityProposalSheet
        papel="motorista"
        alvo="grupo"
        item={{
          flexibilidade_rota: true,
          origin_name: null,
          destination_name: null,
          departure_time: '06:00',
          dias_semana: [1, 2, 3, 4, 5],
          n_actual: 4,
          nome: 'Grupo da paróquia',
        }}
        nProposto={3}
        valorKz={30000}
        modoPreco="TOTAL_ACORDO"
        onClose={() => {}}
        onSubmit={() => {}}
      />,
    );

    expect(screen.getByText('Disponível para acordos')).toBeInTheDocument();
    expect(screen.getByText('06:00')).toBeInTheDocument();
    expect(screen.getByText(textoKz(30000))).toBeInTheDocument();
    expect(screen.getByText('Total do acordo')).toBeInTheDocument();
    expect(screen.getByText(COPY_N_FIXO)).toBeInTheDocument();
    expect(screen.queryByTestId('route-indicator')).not.toBeInTheDocument();
    expect(screen.queryByText(textoKz(90000))).not.toBeInTheDocument();
    expect(screen.queryByText(/por passageiro/i)).not.toBeInTheDocument();
  });

  it('o stepper do passageiro não mostra a frase e o total do acordo não acompanha o N', () => {
    const { rerender } = render(
      <OpportunityProposalSheet
        papel="passageiro"
        alvo="passageiro"
        item={procura}
        nProposto={1}
        valorKz={10000}
        modoPreco="POR_PASSAGEIRO"
        onClose={() => {}}
        onSubmit={() => {}}
      />,
    );

    expect(screen.queryByText(COPY_N_FIXO)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mais passageiros' })).toBeInTheDocument();
    expect(screen.getByText('Passageiros')).toBeInTheDocument();

    rerender(
      <OpportunityProposalSheet
        papel="passageiro"
        alvo="passageiro"
        item={{
          flexibilidade_rota: true,
          departure_time: '06:00',
          dias_semana: [1, 2, 3, 4, 5],
          n_actual: 4,
        }}
        nProposto={1}
        valorKz={30000}
        modoPreco="TOTAL_ACORDO"
        onClose={() => {}}
        onSubmit={() => {}}
      />,
    );

    expect(screen.queryByText(COPY_N_FIXO)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mais passageiros' })).not.toBeInTheDocument();
    expect(screen.queryByText('Passageiros')).not.toBeInTheDocument();
    expect(screen.getByText(textoKz(30000))).toBeInTheDocument();
    expect(screen.getByText('Total do acordo')).toBeInTheDocument();
    expect(screen.queryByText(textoKz(60000))).not.toBeInTheDocument();
    expect(screen.queryByText(/×/)).not.toBeInTheDocument();
  });

  it('passageiro com valor editável pré-preenche ask e mostra PropostaValorInput', () => {
    render(
      <OpportunityProposalSheet
        papel="passageiro"
        alvo="passageiro"
        item={{
          ...procura,
          origin_name: 'Talatona',
          destination_name: 'Maianga',
          departure_time: '07:30',
          vagas_disponiveis: 3,
          flexibilidade_rota: false,
        }}
        nProposto={1}
        valorKz={45000}
        modoPreco="POR_PASSAGEIRO"
        valorEditavel
        onClose={() => {}}
        onSubmit={() => {}}
      />,
    );

    expect(screen.getByTestId('proposta-valor-input')).toHaveValue(45000);
    expect(screen.getByText(/Preço publicado: 45[\s.]?000 Kz/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Preço$/)).not.toBeInTheDocument();
  });

  it('passageiro sem valor editável mantém preço só leitura', () => {
    render(
      <OpportunityProposalSheet
        papel="passageiro"
        alvo="passageiro"
        item={procura}
        nProposto={1}
        valorKz={45000}
        modoPreco="POR_PASSAGEIRO"
        valorEditavel={false}
        onClose={() => {}}
        onSubmit={() => {}}
      />,
    );

    expect(screen.queryByTestId('proposta-valor-input')).not.toBeInTheDocument();
    expect(screen.getByText(/45[\s.]?000 Kz por passageiro/i)).toBeInTheDocument();
  });

  it('o nome na proposta é o texto completo, sem fade nem reticências', () => {
    const nome = 'Grupo da paróquia de Viana, junto ao mercado municipal, com lugar marcado na paragem norte';
    render(
      <OpportunityProposalSheet
        papel="motorista"
        alvo="grupo"
        item={{ ...procura, nome }}
        nProposto={2}
        valorKz={10000}
        modoPreco="POR_PASSAGEIRO"
        onClose={() => {}}
        onSubmit={() => {}}
      />,
    );

    const linha = screen.getByText(nome);
    expect(linha.className).not.toMatch(/ellipsis|truncate|line-clamp|text-fade/);
    expect(linha.className).toMatch(/break-words/);
    expect(linha).toHaveTextContent(nome);
  });
});
