import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AvaliarPassageirosLista from './AvaliarPassageirosLista';
import { RATING_MOMENTO } from '../utils/ratingGates';

const mockUseAcordoRatingContext = vi.fn();

vi.mock('../hooks/useAcordoRatingContext', () => ({
  useAcordoRatingContext: (...args) => mockUseAcordoRatingContext(...args),
  iniciaisNome: (nome) => {
    const parts = String(nome || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'mot-1' } }),
}));

describe('AvaliarPassageirosLista — badges por estado', () => {
  const settledAt = '2026-09-01T10:00:00.000Z';
  const afterWindow = '2026-09-20T12:00:00.000Z';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(afterWindow));
    mockUseAcordoRatingContext.mockReturnValue({
      loading: false,
      error: '',
      acordo: {
        id: 'acordo-1',
        acordos_passageiros: [
          {
            id: 'ap-feito',
            passenger_id: 'p-feito',
            estado: 'activo',
            perfis: { nome_completo: 'Maria Avaliada' },
          },
          {
            id: 'ap-exp',
            passenger_id: 'p-exp',
            estado: 'activo',
            perfis: { nome_completo: 'João Expirado' },
          },
        ],
      },
      pagamentos: [
        {
          acordo_passageiro_id: 'ap-feito',
          estado: 'em_custodia',
          validado_em: settledAt,
          mes_referencia: '2026-09-01',
        },
        {
          acordo_passageiro_id: 'ap-exp',
          estado: 'em_custodia',
          validado_em: settledAt,
          mes_referencia: '2026-09-01',
        },
      ],
      avaliacoes: [
        {
          acordo_passageiro_id: 'ap-feito',
          momento: RATING_MOMENTO.PRIMEIRO_PERIODO,
          avaliador_id: 'mot-1',
        },
      ],
      rotaLabel: 'Talatona → Mutual',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('lugar expirado mostra rótulo neutro e não «Avaliado»', () => {
    render(
      <MemoryRouter initialEntries={['/acordos/acordo-1/avaliar-passageiros']}>
        <AvaliarPassageirosLista />
      </MemoryRouter>,
    );

    const rowExp = screen.getByTestId('avaliar-pax-row-p-exp');
    expect(within(rowExp).getByText('Prazo expirado')).toBeInTheDocument();
    expect(within(rowExp).queryByText('Avaliado')).not.toBeInTheDocument();
  });

  it('lugar avaliado (feito) mantém «Avaliado»', () => {
    render(
      <MemoryRouter initialEntries={['/acordos/acordo-1/avaliar-passageiros']}>
        <AvaliarPassageirosLista />
      </MemoryRouter>,
    );

    const rowFeito = screen.getByTestId('avaliar-pax-row-p-feito');
    expect(within(rowFeito).getByText('Avaliado')).toBeInTheDocument();
    expect(within(rowFeito).queryByText('Prazo expirado')).not.toBeInTheDocument();
  });
});
