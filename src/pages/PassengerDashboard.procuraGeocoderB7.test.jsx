import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PassengerDashboard from './PassengerDashboard';
import { listProcurasByOwner } from '../services/ProcuraService';
import {
  EMPTY_GEOCODER_MESSAGE,
  formatUseFreeTextLabel,
} from '../utils/addressGeocoderCopy';

const getPlacePredictions = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'pax-1' }, tipoPerfil: 'Passageiro', loading: false }),
}));

vi.mock('../services/ProcuraService', () => ({
  createProcura: vi.fn(),
  createProcuraWithGrupo: vi.fn(),
  listProcurasByOwner: vi.fn(),
  updateProcura: vi.fn(),
  cancelProcura: vi.fn(),
}));

vi.mock('../services/MatchingService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    findCompatibleOfertas: vi.fn().mockResolvedValue({ direct: [], waitlist: [], incompatible: [] }),
  };
});

vi.mock('../services/OfertaService', () => ({
  listOfertasDisponiveis: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/PropostaService', () => ({
  createProposta: vi.fn(),
  listPropostasByProcura: vi.fn().mockResolvedValue([]),
  listPropostasByOferta: vi.fn().mockResolvedValue([]),
  listOpenPropostasByCreator: vi.fn().mockResolvedValue([]),
  enrichPropostasForReview: vi.fn().mockResolvedValue([]),
  rejectProposta: vi.fn(),
  cancelProposta: vi.fn(),
}));

vi.mock('../services/AgreementService', () => ({
  createAgreementFromProposal: vi.fn(),
  getAgreementsForPassenger: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/offlineQueue', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listPending: vi.fn().mockResolvedValue([]),
    drainQueue: vi.fn().mockResolvedValue({
      processed: 0,
      remaining: 0,
      conflicts: [],
      successes: [],
    }),
  };
});

vi.mock('../services/WaitlistService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    enqueueWaitlist: vi.fn(),
    listWaitlistByProcura: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('../services/GrupoService', () => ({
  getGrupoByProcura: vi.fn().mockResolvedValue(null),
  listMembrosGrupo: vi.fn().mockResolvedValue([]),
  listGruposAbertos: vi.fn().mockResolvedValue([]),
  listPedidosPendentes: vi.fn().mockResolvedValue([]),
  pedirEntradaGrupo: vi.fn(),
  aprovarEntrada: vi.fn(),
  rejeitarEntrada: vi.fn(),
  grupoTemAcordoActivo: vi.fn().mockResolvedValue(false),
  updateGrupoCapacidade: vi.fn(),
  updateMembroRecolha: vi.fn(),
  apagarGrupo: vi.fn(),
  sairDoGrupo: vi.fn(),
}));

vi.mock('../services/ProfileService', () => ({
  findPassageiroByTelefone: vi.fn(),
}));

vi.mock('../services/LocationService', () => ({
  getPlacePredictions: (...args) => getPlacePredictions(...args),
  getPlaceDetails: vi.fn().mockResolvedValue(null),
  LUANDA_PHOTON_LAT: -8.839,
  LUANDA_PHOTON_LON: 13.289,
}));

const procuraBase = {
  id: 'pr-1',
  estado: 'activa',
  origin_name: 'Talatona',
  destination_name: 'Miramar',
  origin_lat: -8.9,
  origin_lng: 13.1,
  destination_lat: -8.8,
  destination_lng: 13.2,
  preferred_time: '07:15',
  dias_semana: [1, 2, 3, 4, 5],
  n_candidato: 1,
};

async function abrirMinhaProcura() {
  const tab = await screen.findByRole('tab', { name: 'A minha procura' });
  if (tab.getAttribute('aria-selected') !== 'true') {
    fireEvent.click(tab);
  }
}

describe('PassengerDashboard — geocoder B7', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    getPlacePredictions.mockResolvedValue([]);
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 1 }]);
  });

  it('editar procura: Escape com lista aberta fecha só a lista (form inline)', async () => {
    getPlacePredictions.mockResolvedValue([
      { place_id: '1', description: 'Talatona, Luanda', lat: -8.91, lng: 13.19 },
    ]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();
    fireEvent.click(await screen.findByRole('button', { name: /Editar procura/i }));

    const originInput = await screen.findByRole('combobox', { name: /^Origem$/i });
    fireEvent.change(originInput, { target: { value: 'Talaton' } });

    await waitFor(
      () => {
        expect(screen.getByRole('listbox', { name: 'Sugestões de locais' })).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(originInput).not.toHaveAttribute('aria-activedescendant');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('listbox', { name: 'Sugestões de locais' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: /Editar procura/i })).toBeInTheDocument();
  });

  it('editar procura (#273): erro geocoder inline mantém «Guardar alterações» no footer sticky', async () => {
    getPlacePredictions.mockRejectedValue(new Error('offline'));

    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();
    fireEvent.click(await screen.findByRole('button', { name: /Editar procura/i }));

    const originInput = await screen.findByRole('combobox', { name: /^Origem$/i });
    fireEvent.change(originInput, { target: { value: 'Talaton' } });

    await waitFor(
      () => {
        expect(screen.getByTestId('geocoder-network-error')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    const footer = screen.getByTestId('procura-form-submit-footer');
    const guardar = screen.getByRole('button', { name: /Guardar alterações/i });
    expect(footer).toContainElement(guardar);
    expect(footer.className).toMatch(/sticky/);
    expect(footer.className).toMatch(/\bbottom-0\b/);
    expect(footer.className).toMatch(/\bpb-3\b/);
    expect(footer.className).not.toMatch(/pb-\[var\(--shell-bottom-inset\)\]/);
    expect(footer.className).not.toMatch(/-mb-\[var\(--shell-bottom-inset\)\]/);
    expect(screen.queryByTestId('procura-form-scroll')).not.toBeInTheDocument();
    expect(screen.getByTestId('procura-form').className).not.toMatch(/max-h-/);
  });

  it('editar procura: focus no valor guardado sem escrever não mostra Usar nem «Não encontrámos»', async () => {
    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();
    fireEvent.click(await screen.findByRole('button', { name: /Editar procura/i }));

    const originInput = await screen.findByRole('combobox', { name: /^Origem$/i });
    expect(originInput).toHaveValue('Talatona');
    expect(originInput.className).toMatch(/border-\[#718096\]/);

    fireEvent.focus(originInput);

    expect(getPlacePredictions).not.toHaveBeenCalled();
    expect(screen.queryByText(EMPTY_GEOCODER_MESSAGE)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: formatUseFreeTextLabel('Talatona') }),
    ).not.toBeInTheDocument();
  });
});
