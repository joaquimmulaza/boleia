import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GrupoProcuraPanel from './GrupoProcuraPanel';
import {
  getGrupoByProcura,
  listMembrosGrupo,
  grupoTemAcordoActivo,
} from '../services/GrupoService';
import { getPlacePredictions, getPlaceDetails } from '../services/LocationService';

vi.mock('../services/GrupoService', () => ({
  createGrupo: vi.fn(),
  addMembroGrupo: vi.fn(),
  getGrupoByProcura: vi.fn(),
  listMembrosGrupo: vi.fn(),
  listPedidosPendentes: vi.fn().mockResolvedValue([]),
  aprovarEntrada: vi.fn(),
  rejeitarEntrada: vi.fn(),
  sairDoGrupo: vi.fn(),
  grupoTemAcordoActivo: vi.fn().mockResolvedValue(false),
  updateGrupoCapacidade: vi.fn(),
  updateMembroRecolha: vi.fn(),
  apagarGrupo: vi.fn(),
}));

vi.mock('../services/ProfileService', () => ({
  findPassageiroByTelefone: vi.fn(),
}));

vi.mock('../services/LocationService', () => ({
  getPlacePredictions: vi.fn(),
  getPlaceDetails: vi.fn(),
}));

const procura = {
  id: 'pr-1',
  n_candidato: 1,
  origin_name: 'Talatona',
  origin_lat: -8.9,
  origin_lng: 13.1,
  destination_name: 'Miramar',
};

describe('GrupoProcuraPanel — sheet Editar grupo (integração real)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getGrupoByProcura.mockResolvedValue({ id: 'g-1', procura_id: 'pr-1', n_maximo: 4 });
    listMembrosGrupo.mockResolvedValue([
      {
        id: 'm-1',
        passenger_id: 'pax-1',
        estado: 'activo',
        ordem_insercao: 0,
        pickup_name: '',
        perfis: { nome_completo: 'Ana' },
      },
    ]);
    grupoTemAcordoActivo.mockResolvedValue(true);
    getPlacePredictions.mockResolvedValue([
      {
        place_id: '1',
        description: 'Talatona, Município do Talatona',
        lat: -8.91,
        lng: 13.19,
      },
      {
        place_id: '2',
        description: 'Viana, Município de Viana',
        lat: -8.9,
        lng: 13.18,
      },
      {
        place_id: '3',
        description: 'Kilamba, Município de Belas',
        lat: -8.99,
        lng: 13.27,
      },
      {
        place_id: '4',
        description: 'Cazenga, Município de Cazenga',
        lat: -8.83,
        lng: 13.28,
      },
    ]);
    getPlaceDetails.mockResolvedValue({ lat: -8.91, lng: 13.19 });
  });

  async function abrirSheetEditar() {
    render(<GrupoProcuraPanel procura={procura} userId="pax-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    return screen.findByTestId('editar-grupo-sheet');
  }

  it('clicar Fechar fecha o sheet (sem dropdown)', async () => {
    await abrirSheetEditar();
    const fechar = screen.getByTestId('editar-grupo-fechar');
    fireEvent.pointerDown(fechar);
    fireEvent.click(fechar);
    await waitFor(() => {
      expect(screen.queryByTestId('editar-grupo-sheet')).not.toBeInTheDocument();
    });
  });

  it('clicar Fechar fecha o sheet com dropdown de sugestões aberto', async () => {
    await abrirSheetEditar();
    const pickup = screen.getByRole('combobox', { name: /Ponto de recolha \(opcional\)/i });
    fireEvent.change(pickup, { target: { value: 'Talatona' } });

    await waitFor(
      () => {
        expect(screen.getByRole('listbox', { name: 'Sugestões de locais' })).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    const fechar = screen.getByTestId('editar-grupo-fechar');
    fireEvent.pointerDown(fechar);
    fireEvent.click(fechar);

    await waitFor(() => {
      expect(screen.queryByTestId('editar-grupo-sheet')).not.toBeInTheDocument();
    });
  });
});
