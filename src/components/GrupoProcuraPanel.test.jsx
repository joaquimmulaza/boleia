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
import { findPassageiroByTelefone } from '../services/ProfileService';

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
  default: ({ id, name, label, value, onChange, required = true }) => (
    <label htmlFor={id || name}>
      {label}
      <input
        id={id || name}
        name={name}
        value={value || ''}
        onChange={onChange}
        required={required}
      />
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

  it('demove telefone para fallback colapsável e não expõe jargon', async () => {
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

    const fallback = await screen.findByRole('button', {
      name: /Fallback: Convidar por telefone/i,
    });
    expect(fallback).toBeInTheDocument();
    expect(screen.queryByLabelText(/Telefone do colega/i)).not.toBeInTheDocument();

    fireEvent.click(fallback);
    expect(await screen.findByLabelText(/Telefone do colega/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /WhatsApp/i })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/N_actual|n_maximo|POR_PASSAGEIRO/i);
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

  it('fluxo fallback telefone: campo de recolha tem required=false e telefone tem required=true', async () => {
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

    render(<GrupoProcuraPanel procura={procura} userId="pax-1" onGrupoChange={vi.fn()} />);

    const fallbackBtn = await screen.findByRole('button', {
      name: /Fallback: Convidar por telefone/i,
    });
    fireEvent.click(fallbackBtn);

    const telefoneInput = screen.getByLabelText(/Telefone do colega/i);
    expect(telefoneInput).toBeRequired();

    const pickupInput = screen.getByLabelText(/Ponto de recolha \(opcional\)/i);
    expect(pickupInput).not.toBeRequired();
  });

  it('permite submeter formulário de fallback com recolha vazia persistindo null', async () => {
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
    findPassageiroByTelefone.mockResolvedValue({
      id: 'pax-novo',
      nome_completo: 'Colega Novo',
    });
    addMembroGrupo.mockResolvedValue({
      id: 'm-2',
      passenger_id: 'pax-novo',
      pickup_name: null,
      pickup_lat: null,
      pickup_lng: null,
    });

    const onGrupoChange = vi.fn();
    render(<GrupoProcuraPanel procura={procura} userId="pax-1" onGrupoChange={onGrupoChange} />);

    fireEvent.click(
      await screen.findByRole('button', { name: /Fallback: Convidar por telefone/i }),
    );

    const telefoneInput = screen.getByLabelText(/Telefone do colega/i);
    fireEvent.change(telefoneInput, { target: { value: '923456789' } });

    // Ponto de recolha fica intencionalmente vazio
    const pickupInput = screen.getByLabelText(/Ponto de recolha \(opcional\)/i);
    expect(pickupInput.value).toBe('');

    fireEvent.click(screen.getByRole('button', { name: /Adicionar ao grupo/i }));

    await waitFor(() => {
      expect(addMembroGrupo).toHaveBeenCalledWith(
        'g-1',
        expect.objectContaining({
          passenger_id: 'pax-novo',
          pickup_name: null,
          pickup_lat: null,
          pickup_lng: null,
          ordem_insercao: 1,
        }),
      );
    });

    expect(
      await screen.findByText(/Colega Novo adicionado ao grupo/i),
    ).toBeInTheDocument();
  });

  it('submeter formulário de fallback com apenas espaços na recolha persiste null', async () => {
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
    findPassageiroByTelefone.mockResolvedValue({
      id: 'pax-novo',
      nome_completo: 'Colega Novo',
    });
    addMembroGrupo.mockResolvedValue({
      id: 'm-2',
      passenger_id: 'pax-novo',
      pickup_name: null,
      pickup_lat: null,
      pickup_lng: null,
    });

    render(<GrupoProcuraPanel procura={procura} userId="pax-1" onGrupoChange={vi.fn()} />);

    fireEvent.click(
      await screen.findByRole('button', { name: /Fallback: Convidar por telefone/i }),
    );

    const telefoneInput = screen.getByLabelText(/Telefone do colega/i);
    fireEvent.change(telefoneInput, { target: { value: '923456789' } });

    const pickupInput = screen.getByLabelText(/Ponto de recolha \(opcional\)/i);
    fireEvent.change(pickupInput, { target: { value: '   ' } });

    fireEvent.click(screen.getByRole('button', { name: /Adicionar ao grupo/i }));

    await waitFor(() => {
      expect(addMembroGrupo).toHaveBeenCalledWith(
        'g-1',
        expect.objectContaining({
          passenger_id: 'pax-novo',
          pickup_name: null,
          pickup_lat: null,
          pickup_lng: null,
        }),
      );
    });
  });
});
