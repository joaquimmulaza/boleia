import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GrupoProcuraPanel from './GrupoProcuraPanel';
import {
  createGrupo,
  addMembroGrupo,
  getGrupoByProcura,
  listMembrosGrupo,
  listPedidosPendentes,
  aprovarEntrada,
  sairDoGrupo,
} from '../services/GrupoService';

vi.mock('../services/GrupoService', () => ({
  createGrupo: vi.fn(),
  addMembroGrupo: vi.fn(),
  getGrupoByProcura: vi.fn(),
  listMembrosGrupo: vi.fn(),
  listPedidosPendentes: vi.fn(),
  aprovarEntrada: vi.fn(),
  rejeitarEntrada: vi.fn(),
  sairDoGrupo: vi.fn(),
}));

vi.mock('../services/ProfileService', () => ({
  findPassageiroByTelefone: vi.fn(),
}));

vi.mock('./AddressInput', () => ({
  default: ({ name, label, value, onChange }) => (
    <label>
      {label}
      <input name={name} value={value || ''} onChange={onChange} />
    </label>
  ),
}));

const procura = {
  id: 'pr-1',
  n_candidato: 1,
  origin_name: 'Talatona',
  origin_lat: -8.9,
  origin_lng: 13.1,
  destination_name: 'Miramar',
};

describe('GrupoProcuraPanel T31', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getGrupoByProcura.mockResolvedValue(null);
    listMembrosGrupo.mockResolvedValue([]);
    listPedidosPendentes.mockResolvedValue([]);
  });

  it('permite escolher capacidade pretendida ao criar grupo', async () => {
    createGrupo.mockResolvedValue({
      id: 'g-1',
      procura_id: 'pr-1',
      nome: 'O meu grupo',
      n_maximo: 4,
    });
    addMembroGrupo.mockResolvedValue({ id: 'm-1', passenger_id: 'pax-1' });
    getGrupoByProcura
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: 'g-1', procura_id: 'pr-1', n_maximo: 4 });
    listMembrosGrupo.mockResolvedValue([
      {
        id: 'm-1',
        passenger_id: 'pax-1',
        estado: 'activo',
        ordem_insercao: 0,
        perfis: { nome_completo: 'Tu' },
      },
    ]);

    render(<GrupoProcuraPanel procura={procura} userId="pax-1" onGrupoChange={vi.fn()} />);

    expect(await screen.findByText(/Até quantas pessoas/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^4$/ }));
    fireEvent.click(screen.getByRole('button', { name: /Criar grupo/i }));

    await waitFor(() => {
      expect(createGrupo).toHaveBeenCalledWith('pr-1', expect.any(String), 4);
    });

    expect(await screen.findByText(/Grupo · 1 de 4/i)).toBeInTheDocument();
  });

  it('mostra pedidos pendentes e permite aceitar', async () => {
    getGrupoByProcura.mockResolvedValue({
      id: 'g-1',
      procura_id: 'pr-1',
      n_maximo: 4,
    });
    listMembrosGrupo.mockResolvedValue([
      {
        id: 'm-1',
        passenger_id: 'pax-1',
        estado: 'activo',
        ordem_insercao: 0,
        perfis: { nome_completo: 'Ana' },
      },
    ]);
    listPedidosPendentes
      .mockResolvedValueOnce([
        {
          id: 'm-p',
          passenger_id: 'pax-2',
          estado: 'pendente',
          perfis: { nome_completo: 'Bruno' },
        },
      ])
      .mockResolvedValue([]);
    aprovarEntrada.mockResolvedValue({ id: 'm-p', estado: 'activo' });
    listMembrosGrupo
      .mockResolvedValueOnce([
        {
          id: 'm-1',
          passenger_id: 'pax-1',
          estado: 'activo',
          ordem_insercao: 0,
          perfis: { nome_completo: 'Ana' },
        },
      ])
      .mockResolvedValue([
        {
          id: 'm-1',
          passenger_id: 'pax-1',
          estado: 'activo',
          ordem_insercao: 0,
          perfis: { nome_completo: 'Ana' },
        },
        {
          id: 'm-p',
          passenger_id: 'pax-2',
          estado: 'activo',
          ordem_insercao: 1,
          perfis: { nome_completo: 'Bruno' },
        },
      ]);

    const onGrupoChange = vi.fn();
    render(
      <GrupoProcuraPanel procura={procura} userId="pax-1" onGrupoChange={onGrupoChange} />,
    );

    expect(await screen.findByText(/Pedidos de entrada/i)).toBeInTheDocument();
    expect(screen.getByText(/Bruno/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Aceitar/i }));

    await waitFor(() => {
      expect(aprovarEntrada).toHaveBeenCalledWith('m-p');
      expect(onGrupoChange).toHaveBeenCalled();
    });
  });

  it('mantém telefone como fallback e não expõe jargon', async () => {
    getGrupoByProcura.mockResolvedValue({
      id: 'g-1',
      procura_id: 'pr-1',
      n_maximo: 4,
    });
    listMembrosGrupo.mockResolvedValue([
      {
        id: 'm-1',
        passenger_id: 'pax-1',
        estado: 'activo',
        ordem_insercao: 0,
        perfis: { nome_completo: 'Ana' },
      },
    ]);

    const { container } = render(
      <GrupoProcuraPanel procura={procura} userId="pax-1" onGrupoChange={vi.fn()} />,
    );

    expect(await screen.findByText(/Ou convidar por telefone/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/N_actual|n_maximo|POR_PASSAGEIRO|pendente/i);
  });

  it('grupo incompleto: copy a explicar que já se pode negociar', async () => {
    getGrupoByProcura.mockResolvedValue({
      id: 'g-1',
      procura_id: 'pr-1',
      n_maximo: 4,
    });
    listMembrosGrupo.mockResolvedValue([
      {
        id: 'm-1',
        passenger_id: 'pax-1',
        estado: 'activo',
        ordem_insercao: 0,
        perfis: { nome_completo: 'Ana' },
      },
      {
        id: 'm-2',
        passenger_id: 'pax-2',
        estado: 'activo',
        ordem_insercao: 1,
        perfis: { nome_completo: 'Bruno' },
      },
    ]);

    render(<GrupoProcuraPanel procura={procura} userId="pax-1" onGrupoChange={vi.fn()} />);

    expect(await screen.findByText(/Grupo · 2 de 4/i)).toBeInTheDocument();
    expect(
      screen.getByText(/propor|negociar|tamanho actual|sem o grupo cheio/i),
    ).toBeInTheDocument();
  });

  it('após aceitar pedido avisa que propostas anteriores mantêm o tamanho', async () => {
    getGrupoByProcura.mockResolvedValue({
      id: 'g-1',
      procura_id: 'pr-1',
      n_maximo: 4,
    });
    listMembrosGrupo.mockResolvedValue([
      {
        id: 'm-1',
        passenger_id: 'pax-1',
        estado: 'activo',
        ordem_insercao: 0,
        perfis: { nome_completo: 'Ana' },
      },
    ]);
    listPedidosPendentes
      .mockResolvedValueOnce([
        {
          id: 'm-p',
          passenger_id: 'pax-2',
          estado: 'pendente',
          perfis: { nome_completo: 'Bruno' },
        },
      ])
      .mockResolvedValue([]);
    aprovarEntrada.mockResolvedValue({ id: 'm-p', estado: 'activo' });
    listMembrosGrupo
      .mockResolvedValueOnce([
        {
          id: 'm-1',
          passenger_id: 'pax-1',
          estado: 'activo',
          ordem_insercao: 0,
          perfis: { nome_completo: 'Ana' },
        },
      ])
      .mockResolvedValue([
        {
          id: 'm-1',
          passenger_id: 'pax-1',
          estado: 'activo',
          ordem_insercao: 0,
          perfis: { nome_completo: 'Ana' },
        },
        {
          id: 'm-p',
          passenger_id: 'pax-2',
          estado: 'activo',
          ordem_insercao: 1,
          perfis: { nome_completo: 'Bruno' },
        },
      ]);

    render(<GrupoProcuraPanel procura={procura} userId="pax-1" onGrupoChange={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /Aceitar/i }));

    expect(
      await screen.findByText(/propostas.*mantêm|nova proposta|tamanho anterior/i),
    ).toBeInTheDocument();
  });

  it('permite sair do grupo quando há mais de um membro', async () => {
    getGrupoByProcura.mockResolvedValue({
      id: 'g-1',
      procura_id: 'pr-1',
      n_maximo: 4,
    });
    listMembrosGrupo
      .mockResolvedValueOnce([
        {
          id: 'm-1',
          passenger_id: 'pax-1',
          estado: 'activo',
          ordem_insercao: 0,
          perfis: { nome_completo: 'Ana' },
        },
        {
          id: 'm-2',
          passenger_id: 'pax-2',
          estado: 'activo',
          ordem_insercao: 1,
          perfis: { nome_completo: 'Bruno' },
        },
      ])
      .mockResolvedValue([
        {
          id: 'm-1',
          passenger_id: 'pax-1',
          estado: 'activo',
          ordem_insercao: 0,
          perfis: { nome_completo: 'Ana' },
        },
      ]);
    sairDoGrupo.mockResolvedValue({ id: 'm-2', estado: 'saiu' });

    const onGrupoChange = vi.fn();
    render(
      <GrupoProcuraPanel procura={procura} userId="pax-2" onGrupoChange={onGrupoChange} />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Sair do grupo/i }));

    await waitFor(() => {
      expect(sairDoGrupo).toHaveBeenCalledWith('g-1', 'pax-2');
      expect(onGrupoChange).toHaveBeenCalled();
    });
  });
});
