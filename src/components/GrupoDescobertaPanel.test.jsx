import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GrupoDescobertaPanel from './GrupoDescobertaPanel';
import { listGruposAbertos, pedirEntradaGrupo } from '../services/GrupoService';

vi.mock('../services/GrupoService', () => ({
  listGruposAbertos: vi.fn(),
  pedirEntradaGrupo: vi.fn(),
}));

describe('GrupoDescobertaPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lista grupos abertos e permite pedir entrada', async () => {
    listGruposAbertos.mockResolvedValue([
      {
        id: 'g-open',
        n_maximo: 4,
        nome: 'Colegas',
        procura_id: 'pr-other',
        procuras: {
          owner_id: 'owner-2',
          origin_name: 'Talatona',
          destination_name: 'Mutual',
          preferred_time: '07:15:00',
          n_candidato: 2,
          estado: 'activa',
        },
      },
    ]);
    pedirEntradaGrupo.mockResolvedValue({ id: 'm-p', estado: 'pendente' });

    render(
      <GrupoDescobertaPanel userId="pax-me" excludeGrupoId={null} onPedidoEnviado={vi.fn()} />,
    );

    expect(await screen.findByText(/Grupos abertos/i)).toBeInTheDocument();
    expect(screen.getByText(/Talatona/i)).toBeInTheDocument();
    expect(screen.getByText(/Grupo · 2 de 4/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Pedir entrada/i }));

    await waitFor(() => {
      expect(pedirEntradaGrupo).toHaveBeenCalledWith(
        'g-open',
        expect.objectContaining({ passenger_id: 'pax-me' }),
      );
    });

    expect(await screen.findByText(/Pedido enviado/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pedir entrada/i })).not.toBeInTheDocument();
  });

  it('mostra estado vazio quando não há grupos', async () => {
    listGruposAbertos.mockResolvedValue([]);

    render(<GrupoDescobertaPanel userId="pax-me" />);

    expect(
      await screen.findByText(/Não há grupos abertos nesta altura/i),
    ).toBeInTheDocument();
  });

  it('não expõe jargon de domínio', async () => {
    listGruposAbertos.mockResolvedValue([]);
    const { container } = render(<GrupoDescobertaPanel userId="pax-me" />);
    await screen.findByText(/Grupos abertos/i);
    expect(container.textContent).not.toMatch(/N_actual|n_maximo|N_candidato/i);
  });

  it('sem userId autenticado não mostra CTA Pedir entrada', async () => {
    listGruposAbertos.mockResolvedValue([
      {
        id: 'g-open',
        n_maximo: 4,
        procuras: {
          owner_id: 'owner-2',
          origin_name: 'Talatona',
          destination_name: 'Mutual',
          n_candidato: 2,
          estado: 'activa',
        },
      },
    ]);

    render(<GrupoDescobertaPanel userId={null} />);

    expect(await screen.findByText(/Talatona/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pedir entrada/i })).not.toBeInTheDocument();
  });

  it('não inventa OD quando origem/destino ausentes', async () => {
    listGruposAbertos.mockResolvedValue([
      {
        id: 'g-open',
        n_maximo: 4,
        procuras: {
          owner_id: 'owner-2',
          origin_name: null,
          destination_name: null,
          n_candidato: 2,
          estado: 'activa',
        },
      },
    ]);

    const { container } = render(<GrupoDescobertaPanel userId="pax-me" />);

    await screen.findByText(/Grupo · 2 de 4/i);
    expect(container.textContent).not.toMatch(/\bOrigem\b|\bDestino\b/);
    expect(screen.getByText(/Rota não indicada/i)).toBeInTheDocument();
  });
});
