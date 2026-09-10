/**
 * PACOTE #23 — Passageiro: CTA «Propor acordo» nas ofertas (browse).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PassengerDashboard from '../pages/PassengerDashboard.jsx';
import OfertaMatchCard from '../components/OfertaMatchCard.jsx';
import ProtectedRoute from '../components/ProtectedRoute.jsx';
import { labelRotaOferta } from '../utils/ofertaLabels.js';
import { buildProcuraMinimaFromOferta } from '../utils/procuraFromOferta.js';
import { listProcurasByOwner, createProcura } from './ProcuraService.js';
import { listOfertasDisponiveis } from './OfertaService.js';
import { createProposta } from './PropostaService.js';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'pax-1' },
    session: { access_token: 'tok' },
    loading: false,
    tipoPerfil: 'Passageiro',
  }),
}));

vi.mock('../services/ProcuraService', () => ({
  createProcura: vi.fn(),
  createProcuraWithGrupo: vi.fn(),
  listProcurasByOwner: vi.fn().mockResolvedValue([]),
  updateProcura: vi.fn(),
  cancelProcura: vi.fn(),
}));

vi.mock('../services/OfertaService', () => ({
  listOfertasDisponiveis: vi.fn().mockResolvedValue([]),
  isOfertaFlexivel: (o) => Boolean(o?.flexibilidade_rota),
}));

vi.mock('../services/MatchingService', () => ({
  findCompatibleOfertas: vi.fn().mockResolvedValue({ direct: [], waitlist: [], incompatible: [] }),
}));

vi.mock('../services/GrupoService', () => ({
  getGrupoByProcura: vi.fn().mockResolvedValue(null),
  listMembrosGrupo: vi.fn().mockResolvedValue([]),
  listGruposAbertos: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/PropostaService', () => ({
  createProposta: vi.fn(),
  listPropostasByProcura: vi.fn().mockResolvedValue([]),
  enrichPropostasForReview: vi.fn().mockResolvedValue([]),
  rejectProposta: vi.fn(),
  cancelProposta: vi.fn(),
}));

vi.mock('../services/WaitlistService', () => ({
  enqueueWaitlist: vi.fn(),
  filterWaitlistEntriesVisiveis: vi.fn((x) => x),
  listWaitlistByProcura: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/AgreementService', () => ({
  createAgreementFromProposal: vi.fn(),
}));

const ofertaFixaBrowse = {
  id: 'of-browse',
  origin_name: 'Talatona',
  origin_lat: -8.916,
  origin_lng: 13.234,
  destination_name: 'Miramar',
  destination_lat: -8.82,
  destination_lng: 13.25,
  departure_time: '07:15:00',
  vagas_disponiveis: 3,
  valor_mensal_ask_kz: 90000,
  modo_preco: 'POR_PASSAGEIRO',
  flexibilidade_rota: false,
  dias_semana: [1, 2, 3, 4, 5],
};

const ofertaFlexBrowse = {
  id: 'of-flex',
  flexibilidade_rota: true,
  departure_time: '07:00:00',
  vagas_disponiveis: 2,
  valor_mensal_ask_kz: 70000,
  modo_preco: 'POR_PASSAGEIRO',
  dias_semana: [1, 2, 3, 4, 5],
};

describe('PACOTE #23 — propor acordo no browse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listProcurasByOwner.mockResolvedValue([]);
    listOfertasDisponiveis.mockResolvedValue([]);
  });

  describe('buildProcuraMinimaFromOferta (contrato)', () => {
    it('flexível não inventa OD', () => {
      const p = buildProcuraMinimaFromOferta(ofertaFlexBrowse);
      expect(p.origin_lat).toBeNull();
      expect(p.destination_lat).toBeNull();
    });

    it('fixa copia coordenadas da oferta', () => {
      const p = buildProcuraMinimaFromOferta(ofertaFixaBrowse);
      expect(p.origin_lat).toBe(-8.916);
      expect(p.destination_name).toBe('Miramar');
    });
  });

  describe('OfertaMatchCard browse', () => {
    it('mostra CTA Propor acordo quando onPropor fornecido', () => {
      const onPropor = vi.fn();
      render(
        <OfertaMatchCard
          oferta={ofertaFixaBrowse}
          variant="browse"
          onPropor={onPropor}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /Propor acordo/i }));
      expect(onPropor).toHaveBeenCalledTimes(1);
    });

    it('flexível: labelRotaOferta sem OD inventada', () => {
      expect(labelRotaOferta(ofertaFlexBrowse)).toEqual({
        origem: 'Oferta flexível',
        destino: 'Sem origem/destino fixos',
      });
    });
  });

  describe('PassengerDashboard browse → propor', () => {
    it('browse com oferta fixa: CTA Propor acordo visível', async () => {
      listOfertasDisponiveis.mockResolvedValue([ofertaFixaBrowse]);

      render(
        <MemoryRouter>
          <PassengerDashboard />
        </MemoryRouter>,
      );

      expect(await screen.findByRole('button', { name: /Propor acordo/i })).toBeInTheDocument();
    });

    it('browse: clicar Propor cria procura mínima + proposta com valores da oferta', async () => {
      listOfertasDisponiveis.mockResolvedValue([ofertaFixaBrowse]);
      createProcura.mockResolvedValue({ id: 'pr-new', n_candidato: 1, estado: 'activa' });
      createProposta.mockResolvedValue({ id: 'prop-1' });
      listProcurasByOwner
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'pr-new', n_candidato: 1, estado: 'activa' }]);

      render(
        <MemoryRouter>
          <PassengerDashboard />
        </MemoryRouter>,
      );

      fireEvent.click(await screen.findByRole('button', { name: /Propor acordo/i }));

      await waitFor(() => {
        expect(createProcura).toHaveBeenCalledWith(
          expect.objectContaining({
            preferred_time: '07:15',
            origin_name: 'Talatona',
            origin_lat: -8.916,
            destination_name: 'Miramar',
          }),
        );
      });

      await waitFor(() => {
        expect(createProposta).toHaveBeenCalledWith(
          expect.objectContaining({
            oferta_id: 'of-browse',
            procura_id: 'pr-new',
            modo_preco: 'POR_PASSAGEIRO',
            valor_mensal_ask_kz: 90000,
            n_passageiros_propostos: 1,
          }),
        );
      });
    });

    it('browse flexível: propor sem OD na procura mínima', async () => {
      listOfertasDisponiveis.mockResolvedValue([ofertaFlexBrowse]);
      createProcura.mockResolvedValue({ id: 'pr-flex', n_candidato: 1, estado: 'activa' });
      createProposta.mockResolvedValue({ id: 'prop-flex' });
      listProcurasByOwner
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'pr-flex', n_candidato: 1, estado: 'activa' }]);

      render(
        <MemoryRouter>
          <PassengerDashboard />
        </MemoryRouter>,
      );

      fireEvent.click(await screen.findByRole('button', { name: /Propor acordo/i }));

      await waitFor(() => {
        expect(createProcura).toHaveBeenCalledWith(
          expect.objectContaining({
            origin_lat: null,
            destination_lat: null,
            preferred_time: '07:00',
          }),
        );
      });
    });
  });

  describe('auth gate (ProtectedRoute)', () => {
    it('sem sessão redireciona para /auth — guest não acede ao hub passageiro', async () => {
      vi.resetModules();
      vi.doMock('../contexts/AuthContext', () => ({
        useAuth: () => ({ session: null, loading: false, tipoPerfil: null }),
      }));

      const { default: RouteGuard } = await import('../components/ProtectedRoute.jsx');
      const { MemoryRouter, Routes, Route } = await import('react-router-dom');

      render(
        <MemoryRouter initialEntries={['/passageiro']}>
          <Routes>
            <Route element={<RouteGuard allowedRole="Passageiro" />}>
              <Route path="/passageiro" element={<div data-testid="hub">Hub</div>} />
            </Route>
            <Route path="/auth" element={<div data-testid="auth-gate">Login</div>} />
          </Routes>
        </MemoryRouter>,
      );

      expect(await screen.findByTestId('auth-gate')).toBeInTheDocument();
      expect(screen.queryByTestId('hub')).not.toBeInTheDocument();
    });
  });
});
