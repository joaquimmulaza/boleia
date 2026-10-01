import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ProposalSheet from './ProposalSheet';

const review = {
  proposta: {
    id: 'prop-1',
    estado: 'aberta',
    modo_preco: 'POR_PASSAGEIRO',
    valor_mensal_ask_kz: 28000,
    n_passageiros_propostos: 1,
  },
  membros: [{ nome: 'Maria Silva', passenger_id: 'p1' }],
  titulo: '1 passageiro',
  pricing: { valor_mensal_por_passageiro_kz: 28000 },
};

describe('ProposalSheet', () => {
  it('mostra empty state Figma C2b', () => {
    const onClose = vi.fn();
    render(
      <ProposalSheet
        tituloOferta="Oferta flexível"
        horario="07:15"
        reviews={[]}
        loading={false}
        onClose={onClose}
        onVerReview={vi.fn()}
      />,
    );

    expect(screen.getByText('Propostas')).toBeInTheDocument();
    expect(screen.getByText(/0 propostas/i)).toBeInTheDocument();
    expect(screen.getByText(/Ainda não há propostas nesta oferta/i)).toBeInTheDocument();
    expect(screen.getByText(/Quando alguém propuser, aparece aqui/i)).toBeInTheDocument();
    expect(screen.queryByText(/Rever proposta/i)).not.toBeInTheDocument();
  });

  it('lista rows com Ver › tapável', () => {
    const onVerReview = vi.fn();
    render(
      <ProposalSheet
        tituloOferta="Oferta flexível"
        horario="07:15"
        reviews={[review]}
        loading={false}
        onClose={vi.fn()}
        onVerReview={onVerReview}
      />,
    );

    expect(screen.getByText(/Maria S\. · 1 pax/i)).toBeInTheDocument();
    expect(screen.getByText('Pendente')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ver proposta Maria S\./i }));
    expect(onVerReview).toHaveBeenCalledWith(review);
  });

  it('Fechar chama onClose', () => {
    const onClose = vi.fn();
    render(
      <ProposalSheet
        tituloOferta="Oferta flexível"
        horario="07:15"
        reviews={[]}
        loading={false}
        onClose={onClose}
        onVerReview={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Fechar$/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
