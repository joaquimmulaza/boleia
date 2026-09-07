import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PropostaReviewCard from './PropostaReviewCard';

vi.mock('maplibre-gl', () => ({
  default: {
    Map: vi.fn(function Map() {
      this.remove = vi.fn();
      this.fitBounds = vi.fn();
      this.setCenter = vi.fn();
      this.setZoom = vi.fn();
      this.on = vi.fn();
    }),
    Marker: vi.fn(function Marker() {
      this.setLngLat = vi.fn().mockReturnThis();
      this.addTo = vi.fn().mockReturnThis();
      this.remove = vi.fn();
    }),
    LngLatBounds: vi.fn(function LngLatBounds() {
      this.extend = vi.fn().mockReturnThis();
    }),
  },
}));

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));

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
        pickup_lat: -8.917,
        pickup_lng: 13.188,
        quota_mensal_kz: 40000,
        ordem_insercao: 0,
      },
      {
        passenger_id: 'p2',
        nome: 'Bruno Costa',
        telefone: '+244900000002',
        pickup_name: null,
        pickup_lat: null,
        pickup_lng: null,
        quota_mensal_kz: 40000,
        ordem_insercao: 1,
      },
      {
        passenger_id: 'p3',
        nome: 'Carla Dias',
        telefone: '+244900000003',
        pickup_name: 'Miramar',
        pickup_lat: -8.812,
        pickup_lng: 13.234,
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('com coordenadas mostra o mapa dos pontos preferenciais', () => {
    render(
      <PropostaReviewCard
        review={buildReview({
          membros: [
            {
              passenger_id: 'p1',
              nome: 'Ana Silva',
              pickup_name: 'Talatona',
              pickup_lat: -8.917,
              pickup_lng: 13.188,
              quota_mensal_kz: 40000,
            },
          ],
        })}
        busy={false}
        onAceitar={vi.fn()}
        onRecusar={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Mapa dos pontos preferenciais')).toBeInTheDocument();
  });

  it('sem coordenadas mostra mensagem vazia do mapa', () => {
    render(
      <PropostaReviewCard
        review={buildReview({
          membros: [
            {
              passenger_id: 'p1',
              nome: 'Ana Silva',
              pickup_name: 'Talatona',
              pickup_lat: null,
              pickup_lng: null,
              quota_mensal_kz: 40000,
            },
          ],
        })}
        busy={false}
        onAceitar={vi.fn()}
        onRecusar={vi.fn()}
      />,
    );

    expect(
      screen.getByText('Pontos de recolha sem localização no mapa'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Mapa dos pontos preferenciais')).not.toBeInTheDocument();
  });

  it('com localização parcial mostra «X de Y com localização»', () => {
    render(
      <PropostaReviewCard
        review={buildReview()}
        busy={false}
        onAceitar={vi.fn()}
        onRecusar={vi.fn()}
      />,
    );

    expect(screen.getByText('2 de 3 com localização')).toBeInTheDocument();
    expect(screen.getByLabelText('Mapa dos pontos preferenciais')).toBeInTheDocument();
  });

  it('sem membros (solo) não monta o bloco do mapa', () => {
    render(
      <PropostaReviewCard
        review={buildReview({
          membros: [],
          titulo: '1 passageiro',
          proposta: {
            id: 'prop-solo',
            modo_preco: 'POR_PASSAGEIRO',
            valor_mensal_ask_kz: 40000,
            n_passageiros_propostos: 1,
            grupo_id: null,
            estado: 'aberta',
          },
        })}
        busy={false}
        onAceitar={vi.fn()}
        onRecusar={vi.fn()}
      />,
    );

    expect(
      screen.queryByText('Pontos de recolha sem localização no mapa'),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Mapa dos pontos preferenciais')).not.toBeInTheDocument();
  });

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

  it('modo criador mostra Cancelar e chama onCancelar após confirmação', () => {
    const onCancelar = vi.fn();
    const onAceitar = vi.fn();
    const onRecusar = vi.fn();

    render(
      <PropostaReviewCard
        review={buildReview()}
        busy={false}
        modo="criador"
        onCancelar={onCancelar}
        onAceitar={onAceitar}
        onRecusar={onRecusar}
      />,
    );

    expect(screen.queryByRole('button', { name: /Aceitar proposta/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Recusar/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Cancelar proposta/i }));
    fireEvent.click(screen.getByRole('button', { name: /Confirmar cancelamento/i }));
    expect(onCancelar).toHaveBeenCalledTimes(1);
    expect(onAceitar).not.toHaveBeenCalled();
    expect(onRecusar).not.toHaveBeenCalled();
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

  it('com requiresMemberSelection: Aceitar desactivado até exactamente N seleccionados', () => {
    const onAceitar = vi.fn();
    render(
      <PropostaReviewCard
        review={buildReview({
          requiresMemberSelection: true,
          avisoComposicao:
            'O grupo tem mais pessoas do que as cobertas nesta proposta. Escolhe exactamente 3 passageiros para o acordo.',
          membros: [
            ...buildReview().membros,
            {
              passenger_id: 'p4',
              nome: 'Diana Lima',
              pickup_name: null,
              quota_mensal_kz: null,
            },
          ],
        })}
        busy={false}
        onAceitar={onAceitar}
        onRecusar={vi.fn()}
      />,
    );

    const aceitar = screen.getByRole('button', { name: /Aceitar proposta/i });
    expect(aceitar).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /Ana Silva/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Bruno Costa/i }));
    expect(aceitar).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /Carla Dias/i }));
    expect(aceitar).not.toBeDisabled();

    fireEvent.click(aceitar);
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }));
    expect(onAceitar).toHaveBeenCalledWith(['p1', 'p2', 'p3']);
  });

  it('sem requiresMemberSelection com grupo: onAceitar envia IDs dos membros listados', () => {
    const onAceitar = vi.fn();
    render(
      <PropostaReviewCard
        review={buildReview({ requiresMemberSelection: false })}
        busy={false}
        onAceitar={onAceitar}
        onRecusar={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Aceitar proposta/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }));
    expect(onAceitar).toHaveBeenCalledWith(['p1', 'p2', 'p3']);
  });

  it('proposta solo sem grupo: onAceitar sem IDs', () => {
    const onAceitar = vi.fn();
    render(
      <PropostaReviewCard
        review={buildReview({
          requiresMemberSelection: false,
          proposta: {
            ...buildReview().proposta,
            grupo_id: null,
            n_passageiros_propostos: 1,
          },
          membros: [],
          titulo: '1 passageiro',
        })}
        busy={false}
        onAceitar={onAceitar}
        onRecusar={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Aceitar proposta/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }));
    expect(onAceitar).toHaveBeenCalledWith(undefined);
  });

  it('modo historico não mostra picker de membros mesmo com requiresMemberSelection', () => {
    render(
      <PropostaReviewCard
        review={buildReview({
          requiresMemberSelection: true,
          proposta: {
            ...buildReview().proposta,
            estado: 'aceite',
            n_passageiros_propostos: 3,
          },
          membros: [
            ...buildReview().membros,
            {
              passenger_id: 'p4',
              nome: 'Diana Lima',
              pickup_name: null,
              quota_mensal_kz: null,
            },
          ],
        })}
        modo="historico"
        secao="recebidas"
      />,
    );

    expect(screen.queryByTestId('member-picker')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
