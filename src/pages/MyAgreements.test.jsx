import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MyAgreements from './MyAgreements';

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
  renegotiateAgreementPricing: vi.fn(),
}));

import {
  getAgreementsForDriver,
  getAgreementsForPassenger,
  leavePassenger,
  renegotiateAgreementPricing,
} from '../services/AgreementService';

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
  });

  it('lista acordos activos com copy humana', async () => {
    renderPage();

    expect(await screen.findByText('Acordos')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Grupo · 3 pessoas/i)).toBeInTheDocument();
      expect(screen.getByText(/Kz \/ pessoa/i)).toBeInTheDocument();
    });
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

    expect(within(dialog).getByRole('button', { name: /Sair do acordo/i })).toBeInTheDocument();
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
    expect(within(dialog).queryByRole('button', { name: /Sair do acordo/i })).not.toBeInTheDocument();
  });

  it('passageiro activo: Sair abre ConfirmationModal e leavePassenger mantém quotas na mensagem', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoPassageiro]);
    leavePassenger.mockResolvedValue({ ok: true });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Sair do acordo/i }));

    expect(
      screen.getByText(/A tua quota deste mês não é reembolsada/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Os preços dos restantes passageiros mantêm-se/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Sair$/i }));

    await waitFor(() => {
      expect(leavePassenger).toHaveBeenCalledWith('acordo-pax', 'pax-viewer');
    });
    expect(
      await screen.findByText(/Saíste do acordo\. A quota do mês mantém-se/i),
    ).toBeInTheDocument();
  });

  it('durante leaveBusy: botões do ConfirmationModal ficam desactivados e overlay não cancela', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoPassageiro]);

    let resolveLeave;
    leavePassenger.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLeave = resolve;
        }),
    );

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Sair do acordo/i }));

    fireEvent.click(screen.getByRole('button', { name: /^Sair$/i }));

    await waitFor(() => {
      expect(leavePassenger).toHaveBeenCalled();
    });

    const confirmBtn = screen.getByRole('button', { name: /^Sair$/i });
    const cancelBtn = screen.getByRole('button', { name: /Voltar/i });
    expect(confirmBtn).toBeDisabled();
    expect(cancelBtn).toBeDisabled();

    const overlay = document.querySelector('[aria-hidden="true"]');
    expect(overlay).toBeTruthy();
    fireEvent.click(overlay);
    expect(screen.getByText(/Sair do acordo\?/i)).toBeInTheDocument();

    resolveLeave({ ok: true });
    await waitFor(() => {
      expect(screen.queryByText(/Sair do acordo\?/i)).not.toBeInTheDocument();
    });
  });

  it('motorista não vê CTA Sair do acordo', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).queryByRole('button', { name: /Sair do acordo/i })).not.toBeInTheDocument();
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

  it('passageiro não vê CTA Renegociar preço', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoPassageiro]);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).queryByRole('button', { name: /Renegociar preço/i })).not.toBeInTheDocument();
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
      screen.getByText(/Aplica-se a partir do próximo mês\. O mês corrente mantém as quotas já combinadas\./i),
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
      await screen.findByText(/Preço actualizado\. Aplica-se a partir do próximo mês\./i),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText(/^Novo preço$/i)).not.toBeInTheDocument();
    });

    // Leave CTA / fluxo do passageiro permanece coberto pelos testes T28 existentes
    expect(within(dialog).getByRole('button', { name: /Registar falta/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Renegociar preço/i })).toBeInTheDocument();
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
});
