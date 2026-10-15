import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PassengerDashboard from './PassengerDashboard';
import { listProcurasByOwner, updateProcura } from '../services/ProcuraService';
import { findCompatibleOfertas } from '../services/MatchingService';
import { listOfertasDisponiveis } from '../services/OfertaService';
import {
  listPropostasByProcura,
  listOpenPropostasByCreator,
  enrichPropostasForReview,
} from '../services/PropostaService';
import { getAgreementsForPassenger } from '../services/AgreementService';
import { getGrupoByProcura, listMembrosGrupo } from '../services/GrupoService';
import { listWaitlistByProcura } from '../services/WaitlistService';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'pax-1' }, tipoPerfil: 'Passageiro' }),
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

vi.mock('../services/WaitlistService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    enqueueWaitlist: vi.fn(),
    listWaitlistByProcura: vi.fn().mockResolvedValue([]),
  };
});

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

vi.mock('../components/AddressInput', () => ({
  default: ({ name, label, value, onChange }) => (
    <label htmlFor={`mock-${name}`}>
      {label}
      <input
        id={`mock-${name}`}
        name={name}
        value={value || ''}
        onChange={(e) => onChange?.(e)}
      />
    </label>
  ),
}));

const procuraBase = {
  id: 'pr-1',
  estado: 'activa',
  origin_name: 'Talatona',
  destination_name: 'Miramar',
  preferred_time: '07:15:00',
  origin_lat: -8.9,
  origin_lng: 13.1,
  destination_lat: -8.8,
  destination_lng: 13.2,
  dias_semana: [1, 2, 3, 4, 5],
  n_candidato: 1,
};

describe('PassengerDashboard — hora inválida bloqueia Guardar procura', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listProcurasByOwner.mockResolvedValue([procuraBase]);
    findCompatibleOfertas.mockResolvedValue({ direct: [], waitlist: [], incompatible: [] });
    listOfertasDisponiveis.mockResolvedValue([]);
    listPropostasByProcura.mockResolvedValue([]);
    listOpenPropostasByCreator.mockResolvedValue([]);
    enrichPropostasForReview.mockResolvedValue([]);
    getAgreementsForPassenger.mockResolvedValue([]);
    getGrupoByProcura.mockResolvedValue(null);
    listMembrosGrupo.mockResolvedValue([]);
    listWaitlistByProcura.mockResolvedValue([]);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      writable: true,
      value: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        ready: Promise.resolve({}),
      },
    });
  });

  it('não chama updateProcura quando Hora preferida é inválida após blur', async () => {
    render(
      <MemoryRouter initialEntries={['/passageiro']}>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    const tab = await screen.findByRole('tab', { name: 'A minha procura' });
    if (tab.getAttribute('aria-selected') !== 'true') {
      fireEvent.click(tab);
    }

    fireEvent.click(await screen.findByRole('button', { name: /Editar procura/i }));

    const hora = await screen.findByLabelText(/Hora preferida/i);
    fireEvent.focus(hora);
    fireEvent.change(hora, { target: { value: '28:00' } });
    fireEvent.blur(hora);

    const guardar = screen.getByRole('button', { name: /Guardar alterações/i });
    expect(guardar).toBeDisabled();
    fireEvent.click(guardar);
    expect(updateProcura).not.toHaveBeenCalled();
  });
});
