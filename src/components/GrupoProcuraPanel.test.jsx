import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GrupoProcuraPanel from './GrupoProcuraPanel';
import {
  createGrupo,
  addMembroGrupo,
  getGrupoByProcura,
  listMembrosGrupo,
} from '../services/GrupoService';
import { findPassageiroByTelefone } from '../services/ProfileService';

vi.mock('../services/GrupoService', () => ({
  createGrupo: vi.fn(),
  addMembroGrupo: vi.fn(),
  getGrupoByProcura: vi.fn(),
  listMembrosGrupo: vi.fn(),
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

describe('GrupoProcuraPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getGrupoByProcura.mockResolvedValue(null);
    listMembrosGrupo.mockResolvedValue([]);
  });

  it('mostra CTA para criar grupo quando ainda não existe', async () => {
    render(
      <GrupoProcuraPanel
        procura={procura}
        userId="pax-1"
        onGrupoChange={vi.fn()}
      />,
    );

    expect(await screen.findByRole('button', { name: /Criar grupo/i })).toBeInTheDocument();
    expect(screen.getByText(/Individual/i)).toBeInTheDocument();
  });

  it('cria grupo, adiciona o dono e actualiza tamanho do grupo', async () => {
    const onGrupoChange = vi.fn();
    createGrupo.mockResolvedValue({ id: 'g-1', procura_id: 'pr-1', nome: 'Colegas' });
    addMembroGrupo.mockResolvedValue({ id: 'm-1', passenger_id: 'pax-1' });
    getGrupoByProcura
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: 'g-1', procura_id: 'pr-1', nome: 'Colegas' });
    listMembrosGrupo.mockResolvedValue([
      {
        id: 'm-1',
        passenger_id: 'pax-1',
        pickup_name: 'Talatona',
        estado: 'activo',
        ordem_insercao: 0,
        perfis: { nome_completo: 'Tu', telefone: '+244923000001' },
      },
    ]);

    render(
      <GrupoProcuraPanel
        procura={procura}
        userId="pax-1"
        onGrupoChange={onGrupoChange}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Criar grupo/i }));

    await waitFor(() => {
      expect(createGrupo).toHaveBeenCalledWith('pr-1', expect.any(String));
      expect(addMembroGrupo).toHaveBeenCalledWith(
        'g-1',
        expect.objectContaining({
          passenger_id: 'pax-1',
          pickup_name: 'Talatona',
        }),
      );
    });

    expect(await screen.findByText(/Grupo · 1 pessoa/i)).toBeInTheDocument();
    expect(onGrupoChange).toHaveBeenCalled();
  });

  it('adiciona membro por telefone com ponto de recolha opcional', async () => {
    getGrupoByProcura.mockResolvedValue({ id: 'g-1', procura_id: 'pr-1', nome: 'Colegas' });
    listMembrosGrupo
      .mockResolvedValueOnce([
        {
          id: 'm-1',
          passenger_id: 'pax-1',
          pickup_name: 'Talatona',
          estado: 'activo',
          ordem_insercao: 0,
          perfis: { nome_completo: 'Ana', telefone: '+244923000001' },
        },
      ])
      .mockResolvedValue([
        {
          id: 'm-1',
          passenger_id: 'pax-1',
          pickup_name: 'Talatona',
          estado: 'activo',
          ordem_insercao: 0,
          perfis: { nome_completo: 'Ana', telefone: '+244923000001' },
        },
        {
          id: 'm-2',
          passenger_id: 'pax-2',
          pickup_name: 'Benfica',
          estado: 'activo',
          ordem_insercao: 1,
          perfis: { nome_completo: 'Bruno', telefone: '+244923456789' },
        },
      ]);
    findPassageiroByTelefone.mockResolvedValue({
      id: 'pax-2',
      nome_completo: 'Bruno',
      telefone: '+244923456789',
    });
    addMembroGrupo.mockResolvedValue({ id: 'm-2', passenger_id: 'pax-2' });

    const onGrupoChange = vi.fn();
    render(
      <GrupoProcuraPanel
        procura={{ ...procura, n_candidato: 1 }}
        userId="pax-1"
        onGrupoChange={onGrupoChange}
      />,
    );

    expect(await screen.findByText(/Ana/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Telefone do colega/i), {
      target: { value: '923456789' },
    });
    fireEvent.change(screen.getByLabelText(/Ponto de recolha/i), {
      target: { value: 'Benfica' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar ao grupo/i }));

    await waitFor(() => {
      expect(findPassageiroByTelefone).toHaveBeenCalledWith('923456789');
      expect(addMembroGrupo).toHaveBeenCalledWith(
        'g-1',
        expect.objectContaining({
          passenger_id: 'pax-2',
          pickup_name: 'Benfica',
          ordem_insercao: 1,
        }),
      );
    });

    expect(await screen.findByText(/Grupo · 2 pessoas/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Bruno/i).length).toBeGreaterThanOrEqual(1);
    expect(onGrupoChange).toHaveBeenCalled();
  });

  it('não expõe jargon de domínio na UI', async () => {
    getGrupoByProcura.mockResolvedValue({ id: 'g-1', procura_id: 'pr-1', nome: null });
    listMembrosGrupo.mockResolvedValue([
      {
        id: 'm-1',
        passenger_id: 'pax-1',
        estado: 'activo',
        ordem_insercao: 0,
        perfis: { nome_completo: 'Ana', telefone: '+244923000001' },
      },
    ]);

    const { container } = render(
      <GrupoProcuraPanel
        procura={{ ...procura, n_candidato: 1 }}
        userId="pax-1"
        onGrupoChange={vi.fn()}
      />,
    );

    await screen.findByText(/Ana/i);
    expect(container.textContent).not.toMatch(/N_candidato|POR_PASSAGEIRO|n_candidato/i);
  });
});
