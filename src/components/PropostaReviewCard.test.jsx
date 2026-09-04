import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PropostaReviewCard from './PropostaReviewCard';

/**
 * @returns {import('./PropostaReviewCard').PropostaReview}
 */
function buildReview(overrides = {}) {
  return {
    proposta: {
      id: 'prop-1',
      modo_preco: 'TOTAL_ACORDO',
      valor_mensal_ask_kz: 120000,
      n_passageiros_propostos: 3,
      grupo_id: 'g-1',
      estado: 'aberta',
    },
    membros: [
      {
        passenger_id: 'p1',
        nome: 'Ana Silva',
        telefone: '+244900000001',
        pickup_name: 'Talatona, perto do Condo',
        quota_mensal_kz: 40000,
        ordem_insercao: 0,
      },
      {
        passenger_id: 'p2',
        nome: 'Bruno Costa',
        telefone: '+244900000002',
        pickup_name: null,
        quota_mensal_kz: 40000,
        ordem_insercao: 1,
      },
      {
        passenger_id: 'p3',
        nome: 'Carla Dias',
        telefone: '+244900000003',
        pickup_name: 'Miramar',
        quota_mensal_kz: 40000,
        ordem_insercao: 2,
      },
    ],
    pricing: {
      valor_mensal_total_kz: 120000,
      valor_mensal_por_passageiro_kz: 40000,
      quotas: [40000, 40000, 40000],
      temResto: false,
    },
    titulo: 'Grupo · 3 pessoas',
    avisoComposicao: null,
    ...overrides,
  };
}

describe('PropostaReviewCard', () => {
  it('mostra título do grupo, nomes e pickup', () => {
    render(
      <PropostaReviewCard
        review={buildReview()}
        busy={false}
        onAceitar={vi.fn()}
        onRecusar={vi.fn()}
      />,
    );

    expect(screen.getByText('Grupo · 3 pessoas')).toBeInTheDocument();
    expect(screen.getByText('Ana Silva')).toBeInTheDocument();
    expect(screen.getByText('Bruno Costa')).toBeInTheDocument();
    expect(screen.getByText('Carla Dias')).toBeInTheDocument();
    expect(screen.getByText(/Talatona, perto do Condo/i)).toBeInTheDocument();
  });

  it('mostra Total do acordo e montantes resolvidos', () => {
    render(
      <PropostaReviewCard
        review={buildReview()}
        busy={false}
        onAceitar={vi.fn()}
        onRecusar={vi.fn()}
      />,
    );

    expect(screen.getByText('Total do acordo')).toBeInTheDocument();
    expect(screen.getByText(/120[\s.]?000/)).toBeInTheDocument();
    expect(screen.getByText(/40[\s.]?000/)).toBeInTheDocument();
  });

  it('não expõe jargon interno na UI', () => {
    render(
      <PropostaReviewCard
        review={buildReview()}
        busy={false}
        onAceitar={vi.fn()}
        onRecusar={vi.fn()}
      />,
    );

    expect(screen.queryByText(/N_proposto|POR_PASSAGEIRO|N_actual/)).toBeNull();
  });

  it('chama onAceitar e onRecusar', () => {
    const onAceitar = vi.fn();
    const onRecusar = vi.fn();

    render(
      <PropostaReviewCard
        review={buildReview()}
        busy={false}
        onAceitar={onAceitar}
        onRecusar={onRecusar}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Aceitar proposta/i }));
    // ConfirmationModal antes do aceite
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }));
    expect(onAceitar).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Recusar/i }));
    expect(onRecusar).toHaveBeenCalledTimes(1);
  });

  it('mostra nota suave quando pricing.temResto', () => {
    render(
      <PropostaReviewCard
        review={buildReview({
          pricing: {
            valor_mensal_total_kz: 100000,
            valor_mensal_por_passageiro_kz: 33333,
            quotas: [33334, 33333, 33333],
            temResto: true,
          },
        })}
        busy={false}
        onAceitar={vi.fn()}
        onRecusar={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/pagam .+ para o total fechar exacto/i),
    ).toBeInTheDocument();
  });
});
