import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DriverDashboard from './DriverDashboard';
import { listOfertasByDriver } from '../services/OfertaService';
import { listProcurasDisponiveis } from '../services/ProcuraService';
import { findCompatibleProcuras } from '../services/MatchingService';
import { supabase } from '../lib/supabase';
import { formatKwanza } from '../utils/formatKwanza';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' }),
}));

vi.mock('../services/OfertaService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listOfertasByDriver: vi.fn(),
    createOferta: vi.fn(),
    cancelOferta: vi.fn(),
    updateOferta: vi.fn(),
  };
});

vi.mock('../services/ProcuraService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listProcurasDisponiveis: vi.fn(),
    getProcura: vi.fn(),
  };
});

vi.mock('../services/PropostaService', () => ({
  listPropostasByOferta: vi.fn().mockResolvedValue([]),
  listOpenPropostasByCreator: vi.fn().mockResolvedValue([]),
  rejectProposta: vi.fn(),
  cancelProposta: vi.fn(),
  enrichPropostasForReview: vi.fn().mockResolvedValue([]),
  createProposta: vi.fn(),
}));

vi.mock('../services/MatchingService', () => ({
  findCompatibleProcuras: vi.fn(),
}));

vi.mock('../services/GrupoService', () => ({
  getGrupoByProcura: vi.fn().mockResolvedValue(null),
}));

vi.mock('../services/AgreementService', () => ({
  createAgreementFromProposal: vi.fn(),
  getAgreementsForDriver: vi.fn().mockResolvedValue([]),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: [{ id: 'vei-1' }], error: null }),
      })),
    })),
  },
}));

/** pt-PT usa espaço inseparável; o matcher do DOM normaliza whitespace. */
function textoKz(valor) {
  return new RegExp(`${formatKwanza(valor).replace(/\s/g, '\\s')}\\sKz`);
}

const oferta = {
  id: 'of-1',
  origin_name: 'Talatona',
  destination_name: 'Mutual',
  departure_time: '07:15',
  vagas_disponiveis: 4,
  modo_preco: 'POR_PASSAGEIRO',
  valor_mensal_ask_kz: 10000,
  estado: 'disponivel',
  flexibilidade_rota: false,
  dias_semana: [1, 2, 3, 4, 5],
};

const procuraComRota = {
  id: 'pr-rota',
  origin_name: 'Viana',
  destination_name: 'Talatona',
  preferred_time: '07:15:00',
  dias_semana: [1, 2, 3, 4, 5],
  n_candidato: 1,
  estado: 'activa',
};

const procuraSemRota = {
  id: 'pr-sem',
  origin_name: null,
  destination_name: null,
  preferred_time: '07:30:00',
  dias_semana: [1, 2, 3, 4, 5],
  n_candidato: 1,
  estado: 'activa',
};

async function abrirProcuras() {
  render(
    <MemoryRouter>
      <DriverDashboard />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole('tab', { name: /Procuras e grupos/i }));
  await screen.findByText('Viana');
}

function cartaoCom(texto) {
  const node = screen.getByText(texto);
  const cartao = node.closest('[data-testid="opportunity-card"]');
  expect(cartao).toBeTruthy();
  return cartao;
}

describe('Hub motorista — lista Procuras e grupos usa OpportunityCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: [{ id: 'vei-1' }], error: null }),
      })),
    });
    listOfertasByDriver.mockResolvedValue([{ ...oferta }]);
    listProcurasDisponiveis.mockResolvedValue([procuraComRota, procuraSemRota]);
    findCompatibleProcuras.mockResolvedValue({
      direct: [procuraComRota],
      waitlist: [],
      incompatible: [procuraSemRota],
    });
  });

  it('OD real desenha RouteIndicator', async () => {
    await abrirProcuras();
    const cartao = cartaoCom('Viana');
    expect(within(cartao).getByTestId('route-indicator')).toBeInTheDocument();
    expect(within(cartao).getByText('Talatona')).toBeInTheDocument();
    expect(cartao.querySelector('svg')).toBeNull();
    expect(screen.queryByText('Individual')).not.toBeInTheDocument();
  });

  it('OD em falta não escreve Origem nem Destino e não inventa rota', async () => {
    await abrirProcuras();
    const cartao = cartaoCom('07:30 · Seg–Sex');
    expect(within(cartao).queryByTestId('route-indicator')).not.toBeInTheDocument();
    expect(within(cartao).queryByText('Origem')).not.toBeInTheDocument();
    expect(within(cartao).queryByText('Destino')).not.toBeInTheDocument();
    expect(within(cartao).queryByText('Disponível para acordos')).not.toBeInTheDocument();
    expect(cartao.textContent).not.toMatch(/→/);
  });

  it('sem compatibilidade desliga o CTA no mesmo cartão', async () => {
    await abrirProcuras();
    const incompativel = cartaoCom('07:30 · Seg–Sex');
    expect(within(incompativel).getByText('Sem compatibilidade com esta oferta')).toBeInTheDocument();
    expect(within(incompativel).getByRole('button', { name: 'Enviar proposta' })).toBeDisabled();

    const compativel = cartaoCom('Viana');
    expect(within(compativel).queryByText('Sem compatibilidade com esta oferta')).not.toBeInTheDocument();
    expect(within(compativel).getByRole('button', { name: 'Enviar proposta' })).toBeEnabled();
  });

  it('o preço fica no rodapé à esquerda do CTA e não dentro do botão', async () => {
    await abrirProcuras();
    const cartao = cartaoCom('Viana');
    const rodape = within(cartao).getByTestId('opportunity-footer');
    const preco = within(rodape).getByText(textoKz(10000));
    const cta = within(rodape).getByRole('button', { name: 'Enviar proposta' });
    expect(within(rodape).getByText('Por passageiro')).toBeInTheDocument();
    expect(cta).not.toContainElement(preco);
    expect(preco.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(preco.closest('[data-testid="opportunity-footer"]')).toBe(rodape);
  });
});
