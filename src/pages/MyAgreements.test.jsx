import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MyAgreements from './MyAgreements';
import { expectNoUserFacingJargon } from '../test/jargonBan';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockAuth = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuth(),
}));

vi.mock('../services/AgreementService', () => ({
  getAgreementsForDriver: vi.fn(),
  getAgreementsForPassenger: vi.fn(),
  leavePassenger: vi.fn(),
  terminateAgreement: vi.fn(),
  renegotiateAgreementPricing: vi.fn(),
  acceptAgreementAdenda: vi.fn(),
  rejectAgreementAdenda: vi.fn(),
}));

vi.mock('../services/offlineQueue', () => ({
  listPending: vi.fn().mockResolvedValue([]),
  drainQueue: vi.fn().mockResolvedValue({ processed: 0, remaining: 0, conflicts: [] }),
}));

vi.mock('../hooks/useNetworkStatus', () => ({
  useNetworkStatus: vi.fn(() => ({ isOnline: true, isOffline: false })),
}));

import {
  getAgreementsForDriver,
  getAgreementsForPassenger,
  leavePassenger,
  terminateAgreement,
  renegotiateAgreementPricing,
  acceptAgreementAdenda,
  rejectAgreementAdenda,
} from '../services/AgreementService';
import { listPending } from '../services/offlineQueue';

const acordoMotorista = {
  id: 'acordo-1',
  estado: 'activo',
  n_passageiros_contrato: 3,
  valor_mensal_por_passageiro_kz: 40000,
  valor_mensal_total_kz: 120000,
  is_hidden_by_user: false,
  created_at: '2026-06-12T10:00:00Z',
  ofertas_capacidade: {
    origin_name: 'Talatona',
    destination_name: 'Mutual',
    departure_time: '07:15',
  },
  acordos_passageiros: [
    {
      id: 'ap-1',
      passenger_id: 'pax-1',
      estado: 'activo',
      quota_mensal_kz: 40000,
      perfis: { nome_completo: 'Ana Costa' },
    },
    {
      id: 'ap-2',
      passenger_id: 'pax-2',
      estado: 'activo',
      quota_mensal_kz: 40000,
      perfis: { nome_completo: 'João Pedro' },
    },
    {
      id: 'ap-3',
      passenger_id: 'pax-3',
      estado: 'saiu',
      quota_mensal_kz: 40000,
      perfis: { nome_completo: 'Maria Silva' },
    },
  ],
};

const acordoPassageiro = {
  id: 'acordo-pax',
  estado: 'activo',
  n_passageiros_contrato: 3,
  valor_mensal_por_passageiro_kz: 40000,
  valor_mensal_total_kz: 120000,
  is_hidden_by_user: false,
  ofertas_capacidade: {
    origin_name: 'Talatona',
    destination_name: 'Mutual',
    departure_time: '07:15',
  },
  acordos_passageiros: [
    {
      id: 'ap-1',
      passenger_id: 'pax-viewer',
      estado: 'activo',
      quota_mensal_kz: 40000,
      perfis: { nome_completo: 'Tu Mesmo' },
    },
    {
      id: 'ap-2',
      passenger_id: 'pax-2',
      estado: 'activo',
      quota_mensal_kz: 40000,
      perfis: { nome_completo: 'João Pedro' },
    },
  ],
};

function renderPage(initialEntries = ['/acordos']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <MyAgreements />
    </MemoryRouter>,
  );
}

describe('MyAgreements — marketplace 1:N', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' });
    getAgreementsForDriver.mockResolvedValue([acordoMotorista]);
    getAgreementsForPassenger.mockResolvedValue([]);
    listPending.mockResolvedValue([]);
  });

  it('lista acordos activos com copy humana', async () => {
    renderPage();

    expect(await screen.findByText('Acordos')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Grupo · 3 pessoas/i)).toBeInTheDocument();
      expect(screen.getByText(/Kz \/ pessoa/i)).toBeInTheDocument();
    });
  });

  it('acordo com oferta flexível não mostra placeholders Origem/Destino', async () => {
    getAgreementsForDriver.mockResolvedValue([
      {
        ...acordoMotorista,
        ofertas_capacidade: {
          flexibilidade_rota: true,
          departure_time: '07:15',
          origin_name: null,
          destination_name: null,
        },
      },
    ]);

    renderPage();

    expect(await screen.findByText('Oferta flexível')).toBeInTheDocument();
    expect(screen.queryByText(/^Origem$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Destino$/)).not.toBeInTheDocument();
  });

  it('motorista no detalhe vê N linhas com nome, quota Kz e estado humano', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).getByText(/Preço combinado/i)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/O valor fica congelado durante este acordo/i),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/Passageiros · 3/i)).toBeInTheDocument();

    expect(within(dialog).getByText('Ana Costa')).toBeInTheDocument();
    expect(within(dialog).getByText('João Pedro')).toBeInTheDocument();
    expect(within(dialog).getByText('Maria Silva')).toBeInTheDocument();

    expect(within(dialog).getAllByText(/40\.?\s?000 Kz/i).length).toBeGreaterThanOrEqual(3);
    expect(within(dialog).getAllByText(/Confirmad/i).length).toBeGreaterThanOrEqual(2);
    expect(within(dialog).getByText(/^Saiu$/i)).toBeInTheDocument();

    expect(within(dialog).queryByText(/N_contrato/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/POR_PASSAGEIRO/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/passenger_id/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/pax-1/i)).not.toBeInTheDocument();
  });

  it('passageiro vê a sua quota em destaque e badge de preço congelado', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoPassageiro]);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).getByText(/Preço combinado/i)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/O valor fica congelado durante este acordo/i),
    ).toBeInTheDocument();

    const ownRow = within(dialog).getByTestId('passenger-row-pax-viewer');
    expect(ownRow).toHaveAttribute('data-highlighted', 'true');
    expect(within(ownRow).getByText('Tu Mesmo')).toBeInTheDocument();
    expect(within(ownRow).getByText(/40\.?\s?000 Kz/i)).toBeInTheDocument();

    expect(within(dialog).getByRole('button', { name: /Sair só eu/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Encerrar acordo/i })).toBeInTheDocument();
  });

  it('CTA Registar falta navega para /faltas/:id', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Registar falta/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/faltas/acordo-1');
  });

  it('acordo activo: mostra CTA Registar falta', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).getByRole('button', { name: /Registar falta/i })).toBeInTheDocument();
  });

  it('acordo não activo: não mostra CTA Registar falta', async () => {
    getAgreementsForDriver.mockResolvedValue([
      { ...acordoMotorista, id: 'acordo-cancelado', estado: 'cancelado' },
    ]);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).queryByRole('button', { name: /Registar falta/i })).not.toBeInTheDocument();
  });

  it('passageiro que saiu: não mostra CTA Registar falta no detalhe do acordo inactivo', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([
      {
        ...acordoPassageiro,
        id: 'acordo-saiu',
        estado: 'cancelado',
        acordos_passageiros: [
          {
            id: 'ap-1',
            passenger_id: 'pax-viewer',
            estado: 'saiu',
            quota_mensal_kz: 40000,
            perfis: { nome_completo: 'Tu Mesmo' },
          },
        ],
      },
    ]);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).queryByRole('button', { name: /Registar falta/i })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Sair só eu/i })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Encerrar acordo/i })).not.toBeInTheDocument();
  });

  it('passageiro activo: Encerrar acordo abre modalidades A/B/C', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoPassageiro]);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Encerrar acordo/i }));

    const picker = await screen.findByTestId('terminate-modality-picker');
    expect(within(picker).getByText(/^Acordo amigável$/i)).toBeInTheDocument();
    expect(within(picker).getByText(/^Aviso prévio$/i)).toBeInTheDocument();
    expect(within(picker).getByText(/^Justa causa imediata$/i)).toBeInTheDocument();
  });

  it('passageiro activo: Sair só eu chama leavePassenger', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoPassageiro]);
    leavePassenger.mockResolvedValue({ ok: true });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Sair só eu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Sair$/i }));

    await waitFor(() => {
      expect(leavePassenger).toHaveBeenCalledWith('acordo-pax', 'pax-viewer');
    });
    expect(
      await screen.findByText(/Saíste do acordo\. A quota do mês mantém-se/i),
    ).toBeInTheDocument();
  });

  it('leave offlineQueued: mostra Saída Pendente e desactiva Sair só eu', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoPassageiro]);
    leavePassenger.mockResolvedValue({
      offlineQueued: true,
      id: 'acordo-pax',
      idempotency_key: 'idem-leave-1',
    });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Sair só eu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Sair$/i }));

    await waitFor(() => {
      expect(leavePassenger).toHaveBeenCalledWith('acordo-pax', 'pax-viewer');
    });

    expect(await screen.findByText(/Saída Pendente/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Talatona/i }));
    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).getByRole('button', { name: /Sair só eu/i })).toBeDisabled();
  });

  it('passageiro escolhe aviso prévio e chama terminateAgreement', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoPassageiro]);
    terminateAgreement.mockResolvedValue({ id: 'acordo-pax', estado: 'cancelamento_pendente' });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Encerrar acordo/i }));

    const picker = await screen.findByTestId('terminate-modality-picker');
    fireEvent.click(within(picker).getByRole('button', { name: /Aviso prévio/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }));

    await waitFor(() => {
      expect(terminateAgreement).toHaveBeenCalledWith('acordo-pax', { modo: 'aviso_previo' });
    });
    expect(
      await screen.findByText(/Rescisão agendada|mantém-se activo até ao fim do mês/i),
    ).toBeInTheDocument();
  });

  it('terminate offlineQueued: mostra feedback de sincronização', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoPassageiro]);
    terminateAgreement.mockResolvedValue({
      offlineQueued: true,
      id: 'acordo-pax',
      idempotency_key: 'idem-term-1',
    });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Encerrar acordo/i }));

    const picker = await screen.findByTestId('terminate-modality-picker');
    fireEvent.click(within(picker).getByRole('button', { name: /Acordo amigável/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }));

    await waitFor(() => {
      expect(terminateAgreement).toHaveBeenCalledWith('acordo-pax', { modo: 'consensual' });
    });

    const feedback = screen.getByTestId('agreements-feedback');
    expect(feedback).toHaveAttribute('data-variant', 'success');
    expect(feedback).toHaveTextContent(/guardada|Sincronizamos/i);
  });

  it('cartão activo destaca a quota congelada com tipografia forte', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoPassageiro]);

    renderPage();

    const card = await screen.findByRole('button', { name: /Talatona/i });
    const quota = within(card).getByTestId('card-quota-congelada');
    expect(quota).toHaveTextContent(/40[\s.]?000/);
    expect(quota.className).toMatch(/text-lg/);
    expect(quota.className).toMatch(/font-bold/);
    expect(quota.className).toMatch(/text-primary/);
  });

  it('durante terminateBusy: botões de confirmação ficam desactivados', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoPassageiro]);

    let resolveTerminate;
    terminateAgreement.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTerminate = resolve;
        }),
    );

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Encerrar acordo/i }));

    const picker = await screen.findByTestId('terminate-modality-picker');
    fireEvent.click(within(picker).getByRole('button', { name: /Aviso prévio/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }));

    await waitFor(() => {
      expect(terminateAgreement).toHaveBeenCalled();
    });

    const confirmBtn = screen.getByRole('button', { name: /^Confirmar$/i });
    const cancelBtn = screen.getByRole('button', { name: /Voltar/i });
    expect(confirmBtn).toBeDisabled();
    expect(cancelBtn).toBeDisabled();

    resolveTerminate({ id: 'acordo-pax', estado: 'cancelamento_pendente' });
    await waitFor(() => {
      expect(screen.queryByTestId('terminate-modality-picker')).not.toBeInTheDocument();
    });
  });

  it('motorista activo vê Encerrar acordo (sem Sair só eu)', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).getByRole('button', { name: /Encerrar acordo/i })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Sair só eu/i })).not.toBeInTheDocument();
  });

  it('motorista não vê Sair só eu', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).queryByRole('button', { name: /Sair só eu/i })).not.toBeInTheDocument();
  });
});

describe('MyAgreements — T29 adenda / renegociar preço', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' });
    getAgreementsForDriver.mockResolvedValue([acordoMotorista]);
    getAgreementsForPassenger.mockResolvedValue([]);
    renegotiateAgreementPricing.mockResolvedValue({ id: 'acordo-1' });
  });

  it('motorista com acordo activo vê CTA Renegociar preço acima de Registar falta', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    const renegociar = within(dialog).getByRole('button', { name: /Renegociar preço/i });
    const falta = within(dialog).getByRole('button', { name: /Registar falta/i });
    expect(renegociar.compareDocumentPosition(falta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('passageiro activo vê CTA Renegociar preço', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoPassageiro]);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).getByRole('button', { name: /Renegociar preço/i })).toBeInTheDocument();
  });

  it('acordo não activo: motorista não vê Renegociar preço', async () => {
    getAgreementsForDriver.mockResolvedValue([
      { ...acordoMotorista, id: 'acordo-cancelado', estado: 'cancelado' },
    ]);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).queryByRole('button', { name: /Renegociar preço/i })).not.toBeInTheDocument();
  });

  it('abre formulário Novo preço e preview Por passageiro', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Renegociar preço/i }));

    const dialog = screen.getByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).getByText(/^Novo preço$/i)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Actualiza o valor combinado do acordo/i),
    ).toBeInTheDocument();

    const valorInput = within(dialog).getByLabelText(/Valor mensal/i);
    fireEvent.change(valorInput, { target: { value: '45000' } });

    expect(within(dialog).getByText(/Como fica/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Cada um paga/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/45\.?\s?000 Kz/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Como fica/i).closest('div')).toHaveTextContent(
      /Total\s+90[\s.]?000\s*Kz/i,
    );
    expect(within(dialog).queryByText(/POR_PASSAGEIRO/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/TOTAL_ACORDO/i)).not.toBeInTheDocument();
  });

  it('preview Total do acordo com resto', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Renegociar preço/i }));

    const dialog = screen.getByRole('dialog', { name: /Detalhe do acordo/i });
    fireEvent.click(within(dialog).getByRole('button', { name: /^Total do acordo$/i }));

    const valorInput = within(dialog).getByLabelText(/Valor mensal/i);
    fireEvent.change(valorInput, { target: { value: '100001' } });

    const nInput = within(dialog).getByLabelText(/Passageiros no preço/i);
    fireEvent.change(nInput, { target: { value: '3' } });

    expect(within(dialog).getByText(/Como fica/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Como fica/i).closest('div')).toHaveTextContent(
      /Total\s+100[\s.]?001\s*Kz/i,
    );
    expect(within(dialog).getByText(/O resto fica no último/i)).toBeInTheDocument();
  });

  it('Rever e confirmar chama renegotiateAgreementPricing com modo/valor correctos', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Renegociar preço/i }));

    const dialog = screen.getByRole('dialog', { name: /Detalhe do acordo/i });
    fireEvent.click(within(dialog).getByRole('button', { name: /Total do acordo/i }));
    fireEvent.change(within(dialog).getByLabelText(/Valor mensal/i), {
      target: { value: '120000' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Passageiros no preço/i), {
      target: { value: '3' },
    });

    fireEvent.click(within(dialog).getByRole('button', { name: /Rever e confirmar/i }));

    expect(screen.getByText(/Confirmar novo preço\?/i)).toBeInTheDocument();
    expect(
      screen.getByText(/à espera da aceitação do passageiro/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }));

    await waitFor(() => {
      expect(renegotiateAgreementPricing).toHaveBeenCalledWith('acordo-1', {
        modo_preco: 'TOTAL_ACORDO',
        valor_ask_kz: 120000,
        n_passageiros: 3,
      });
    });
  });

  it('sucesso mostra mensagem e fecha o formulário de adenda', async () => {
    const apósAdenda = {
      ...acordoMotorista,
      adenda_pendente: {
        id: 'adenda-new',
        estado: 'pendente_passageiro',
        effective_from: '2026-10-01',
        modo_preco: 'POR_PASSAGEIRO',
        valor_mensal_por_passageiro_kz: 45000,
        valor_mensal_total_kz: 90000,
        n_passageiros_contrato: 2,
        applied_at: null,
      },
    };
    renegotiateAgreementPricing.mockResolvedValue(apósAdenda);
    getAgreementsForDriver
      .mockResolvedValueOnce([acordoMotorista])
      .mockResolvedValueOnce([apósAdenda]);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Renegociar preço/i }));

    const dialog = screen.getByRole('dialog', { name: /Detalhe do acordo/i });
    fireEvent.change(within(dialog).getByLabelText(/Valor mensal/i), {
      target: { value: '45000' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /Rever e confirmar/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }));

    expect(
      await screen.findByText(/Proposta de novo preço enviada\. Fica à espera da aceitação do passageiro\./i),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText(/^Novo preço$/i)).not.toBeInTheDocument();
    });

    // Leave CTA / fluxo do passageiro permanece coberto pelos testes T28 existentes
    expect(within(dialog).getByRole('button', { name: /Registar falta/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Renegociar preço/i })).toBeInTheDocument();
  });

  it('com adenda_pendente aceite mostra chip, comparação de preços e mantém preço corrente', async () => {
    getAgreementsForDriver.mockResolvedValue([
      {
        ...acordoMotorista,
        adenda_pendente: {
          estado: 'aceite',
          effective_from: '2026-10-01',
          modo_preco: 'POR_PASSAGEIRO',
          valor_mensal_por_passageiro_kz: 45000,
          valor_mensal_total_kz: 90000,
          n_passageiros_contrato: 2,
          applied_at: null,
        },
      },
    ]);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).getByText(/Preço combinado/i)).toBeInTheDocument();
    expect(within(dialog).getByTestId('quota-destaque')).toHaveTextContent(/40/);
    const pendente = within(dialog).getByTestId('adenda-pendente');
    expect(within(pendente).getByTestId('adenda-chip')).toHaveTextContent(/Aceite vigora em/i);
    expect(within(pendente).getByTestId('adenda-precos-comparacao')).toBeInTheDocument();
    expect(within(pendente).getByText(/Preço actual/i)).toBeInTheDocument();
    expect(within(pendente).getByText(/Preço futuro/i)).toBeInTheDocument();
  });

  it('erro de renegociação mostra role=alert junto ao form', async () => {
    renegotiateAgreementPricing.mockRejectedValue(new Error('Sem permissão para renegociar.'));

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Renegociar preço/i }));

    const dialog = screen.getByRole('dialog', { name: /Detalhe do acordo/i });
    fireEvent.change(within(dialog).getByLabelText(/Valor mensal/i), {
      target: { value: '45000' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /Rever e confirmar/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Sem permissão para renegociar/i);
    expect(within(dialog).getByText(/^Novo preço$/i)).toBeInTheDocument();
  });

  it('Cancelar fecha o formulário de adenda', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Renegociar preço/i }));

    const dialog = screen.getByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).getByText(/^Novo preço$/i)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /^Cancelar$/i }));
    expect(within(dialog).queryByText(/^Novo preço$/i)).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Renegociar preço/i })).toBeInTheDocument();
  });

  it('passageiro vê CTA Aceitar Alteração e Rejeitar Alteração quando pendente', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([
      {
        ...acordoPassageiro,
        adenda_pendente: {
          id: 'adenda-1',
          estado: 'pendente_passageiro',
          effective_from: '2026-10-01',
          modo_preco: 'POR_PASSAGEIRO',
          valor_mensal_por_passageiro_kz: 45000,
          valor_mensal_total_kz: 90000,
          applied_at: null,
        },
      },
    ]);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    const pendente = within(dialog).getByTestId('adenda-pendente');
    expect(within(pendente).getByTestId('adenda-chip')).toHaveTextContent(/À espera tua/i);
    expect(within(dialog).getByRole('button', { name: /Aceitar Alteração/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Rejeitar Alteração/i })).toBeInTheDocument();
  });

  it('passageiro aceita adenda e actualiza o detalhe', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger
      .mockResolvedValueOnce([
        {
          ...acordoPassageiro,
          adenda_pendente: {
            id: 'adenda-1',
            estado: 'pendente_passageiro',
            effective_from: '2026-10-01',
            valor_mensal_por_passageiro_kz: 45000,
            valor_mensal_total_kz: 90000,
            applied_at: null,
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          ...acordoPassageiro,
          adenda_pendente: {
            id: 'adenda-1',
            estado: 'aceite',
            effective_from: '2026-10-01',
            valor_mensal_por_passageiro_kz: 45000,
            valor_mensal_total_kz: 90000,
            applied_at: null,
            aceite_em: '2026-09-05T16:00:00Z',
          },
        },
      ]);
    acceptAgreementAdenda.mockResolvedValue({
      id: 'adenda-1',
      estado: 'aceite',
      applied_at: null,
    });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Aceitar Alteração/i }));

    await waitFor(() => {
      expect(acceptAgreementAdenda).toHaveBeenCalledWith('adenda-1');
    });

    expect(await screen.findByText(/Adenda aceite|Alteração aceite/i)).toBeInTheDocument();
    const dialog = screen.getByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).getByTestId('adenda-pendente')).toHaveTextContent(
      /Aceite vigora em/i,
    );
    expect(within(dialog).queryByRole('button', { name: /Aceitar Alteração/i })).not.toBeInTheDocument();
  });

  it('passageiro rejeita adenda com feedback modeless e remove CTAs', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger
      .mockResolvedValueOnce([
        {
          ...acordoPassageiro,
          adenda_pendente: {
            id: 'adenda-1',
            estado: 'pendente_passageiro',
            effective_from: '2026-10-01',
            valor_mensal_por_passageiro_kz: 45000,
            valor_mensal_total_kz: 90000,
            applied_at: null,
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          ...acordoPassageiro,
          adenda_pendente: null,
        },
      ]);
    rejectAgreementAdenda.mockResolvedValue({
      id: 'adenda-1',
      estado: 'rejeitada',
    });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Rejeitar Alteração/i }));

    await waitFor(() => {
      expect(rejectAgreementAdenda).toHaveBeenCalledWith('adenda-1');
    });

    expect(await screen.findByText(/Alteração rejeitada|adenda rejeitada/i)).toBeInTheDocument();
    const dialog = screen.getByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).queryByRole('button', { name: /Aceitar Alteração/i })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Rejeitar Alteração/i })).not.toBeInTheDocument();
  });

  it('passageiro propõe renegociação e mensagem menciona motorista', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoPassageiro]);
    renegotiateAgreementPricing.mockResolvedValue({ id: 'acordo-pax' });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Renegociar preço/i }));

    const dialog = screen.getByRole('dialog', { name: /Detalhe do acordo/i });
    fireEvent.change(within(dialog).getByLabelText(/Valor mensal/i), {
      target: { value: '42000' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /Rever e confirmar/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }));

    await waitFor(() => {
      expect(renegotiateAgreementPricing).toHaveBeenCalledWith('acordo-pax', {
        modo_preco: 'POR_PASSAGEIRO',
        valor_ask_kz: 42000,
        n_passageiros: 2,
      });
    });
    expect(
      await screen.findByText(/aceitação do motorista|contraparte/i),
    ).toBeInTheDocument();
  });

  it('motorista vê CTAs aceitar/rejeitar quando adenda pendente_contraparte', async () => {
    getAgreementsForDriver.mockResolvedValue([
      {
        ...acordoMotorista,
        adenda_pendente: {
          id: 'adenda-pax-prop',
          estado: 'pendente_contraparte',
          effective_from: '2026-10-01',
          valor_mensal_por_passageiro_kz: 42000,
          valor_mensal_total_kz: 84000,
          applied_at: null,
        },
      },
    ]);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    const pendente = within(dialog).getByTestId('adenda-pendente');
    expect(within(pendente).getByTestId('adenda-chip')).toHaveTextContent(/À espera tua/i);
    expect(pendente).toHaveTextContent(/Revisa a proposta/i);
    expect(within(dialog).getByRole('button', { name: /Aceitar Alteração/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Rejeitar Alteração/i })).toBeInTheDocument();
  });

  it('motorista aceita adenda pendente_contraparte', async () => {
    getAgreementsForDriver
      .mockResolvedValueOnce([
        {
          ...acordoMotorista,
          adenda_pendente: {
            id: 'adenda-pax-prop',
            estado: 'pendente_contraparte',
            effective_from: '2026-10-01',
            valor_mensal_por_passageiro_kz: 42000,
            valor_mensal_total_kz: 84000,
            applied_at: null,
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          ...acordoMotorista,
          adenda_pendente: {
            id: 'adenda-pax-prop',
            estado: 'aceite',
            effective_from: '2026-10-01',
            valor_mensal_por_passageiro_kz: 42000,
            applied_at: null,
          },
        },
      ]);
    acceptAgreementAdenda.mockResolvedValue({ id: 'adenda-pax-prop', estado: 'aceite' });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Aceitar Alteração/i }));

    await waitFor(() => {
      expect(acceptAgreementAdenda).toHaveBeenCalledWith('adenda-pax-prop');
    });
  });

  it('motorista com adenda pendente_passageiro vê chip À espera deles sem CTA Aceitar', async () => {
    getAgreementsForDriver.mockResolvedValue([
      {
        ...acordoMotorista,
        adenda_pendente: {
          id: 'adenda-1',
          estado: 'pendente_passageiro',
          effective_from: '2026-10-01',
          valor_mensal_por_passageiro_kz: 45000,
          valor_mensal_total_kz: 90000,
          applied_at: null,
        },
      },
    ]);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    const pendente = within(dialog).getByTestId('adenda-pendente');
    expect(within(pendente).getByTestId('adenda-chip')).toHaveTextContent(/À espera deles/i);
    expect(within(dialog).queryByRole('button', { name: /Aceitar Alteração/i })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Rejeitar Alteração/i })).not.toBeInTheDocument();
  });

  it('cancelamento_pendente mostra banner com data Luanda e vaga ocupada', async () => {
    getAgreementsForDriver.mockResolvedValue([
      {
        ...acordoMotorista,
        estado: 'cancelamento_pendente',
        rescisao_effective_on: '2026-10-01',
      },
    ]);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    const banner = within(dialog).getByTestId('cancelamento-pendente-banner');
    expect(banner).toHaveTextContent(/30 de setembro de 2026/i);
    expect(banner).toHaveTextContent(/vaga permanece ocupada/i);
    expect(banner).toHaveTextContent(/quotas congeladas/i);
  });

  it('não expõe jargon de produto na UI de acordos', async () => {
    renderPage();
    expect(await screen.findByText(/Acordos/i)).toBeInTheDocument();
    expectNoUserFacingJargon(document.body.textContent);
  });
});
