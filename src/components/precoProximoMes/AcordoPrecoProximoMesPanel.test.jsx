import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AcordoPrecoProximoMesPanel from './AcordoPrecoProximoMesPanel';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderPanel(props = {}) {
  return render(
    <MemoryRouter>
      <AcordoPrecoProximoMesPanel
        acordoId="acordo-1"
        precoActual={28000}
        negociacao={null}
        historico={[]}
        janelaAberta
        mesActualLabel="Outubro"
        podePropor
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('AcordoPrecoProximoMesPanel — CTAs rejeitada', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sem negociação mostra Mudar o preço no próximo mês', () => {
    renderPanel();

    expect(screen.getByTestId('mudar-preco-proximo-mes-cta')).toHaveTextContent(
      /Mudar o preço no próximo mês/i,
    );
  });

  it('proposta rejeitada mostra Ver proposta recusada e Nova proposta', () => {
    renderPanel({
      negociacao: {
        id: 'adenda-1',
        estado: 'rejeitada',
        created_by: 'driver-1',
        effective_from: '2026-11-01',
        valor_mensal_por_passageiro_kz: 26500,
        applied_at: null,
      },
      podePropor: true,
    });

    expect(screen.getByTestId('preco-proposta-recusada-cta')).toBeInTheDocument();
    expect(screen.getByTestId('mudar-preco-proximo-mes-cta')).toHaveTextContent(/Nova proposta/i);
  });

  it('proposta pendente mostra Ver proposta e oculta Nova proposta', () => {
    renderPanel({
      negociacao: {
        id: 'adenda-1',
        estado: 'pendente_passageiro',
        effective_from: '2026-11-01',
        valor_mensal_por_passageiro_kz: 26500,
        applied_at: null,
      },
      podePropor: false,
    });

    expect(screen.getByTestId('preco-ver-proposta-cta')).toBeInTheDocument();
    expect(screen.queryByTestId('mudar-preco-proximo-mes-cta')).not.toBeInTheDocument();
  });

  it('Nova proposta navega para ecrã novo', () => {
    renderPanel({
      negociacao: {
        id: 'adenda-1',
        estado: 'rejeitada',
        created_by: 'driver-1',
        effective_from: '2026-11-01',
        valor_mensal_por_passageiro_kz: 26500,
        applied_at: null,
      },
    });

    fireEvent.click(screen.getByTestId('mudar-preco-proximo-mes-cta'));
    expect(mockNavigate).toHaveBeenCalledWith('/acordos/acordo-1/preco/novo');
  });
});
