/**
 * Follow-up #278 — estado chips, pagamentos motorista, contactos, toasts JC.
 */
import React from 'react';
import {
  render, screen, fireEvent, within, waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MyAgreements from './MyAgreements';
import {
  TOAST_JC_PASSAGEIRO_ACORDO_ENCERRADO,
  TOAST_JC_PASSAGEIRO_LUGAR_TERMINADO,
  TOAST_JC_MOTORISTA_ACORDO_RESCINDIDO,
  LISTA_SECCAO_ENCERRADOS,
} from '../constants/acordoFollowup278Copy.js';
import {
  CHIP_LUGAR_SAiu_JUSTA_CAUSA,
  CHIP_LUGAR_RESERVA_EXPIRADA,
} from '../constants/acordoFollowup278Copy.js';

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
  getAgreementById: vi.fn(),
  leavePassenger: vi.fn(),
  countLugaresVivosAcordo: vi.fn(),
  terminateAgreement: vi.fn(),
  rejectAgreementTermination: vi.fn(),
  listAdendaHistorico: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/offlineQueue', () => ({
  listPending: vi.fn().mockResolvedValue([]),
  drainQueue: vi.fn().mockResolvedValue({ processed: 0, remaining: 0, conflicts: [] }),
}));

vi.mock('../hooks/useNetworkStatus', () => ({
  useNetworkStatus: vi.fn(() => ({ isOnline: true, isOffline: false })),
}));

vi.mock('../services/PaymentService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listPagamentosByAcordo: vi.fn().mockResolvedValue([]),
    getPagamentoForPassageiro: vi.fn(),
    getAcordoContactos: vi.fn(),
    getObrigacaoPagamentoPassageiro: vi.fn(),
    listAnulacaoMotivoLugarAcordos: vi.fn().mockResolvedValue([]),
    listPagamentosPendentesMotoristaAcordo: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('../services/RatingService', () => ({
  listMinhasAvaliacoesAcordo: vi.fn().mockResolvedValue([]),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

import {
  getAgreementsForDriver,
  getAgreementsForPassenger,
  countLugaresVivosAcordo,
  terminateAgreement,
} from '../services/AgreementService';
import {
  getAcordoContactos,
  listPagamentosPendentesMotoristaAcordo,
  getObrigacaoPagamentoPassageiro,
  listAnulacaoMotivoLugarAcordos,
} from '../services/PaymentService';
import { ANULACAO_MOTIVO } from '../constants/anulacaoMotivos.js';
import { resetOverlayStackForTests } from '../utils/overlayStack';

const acordoActivoMulti = {
  id: 'acordo-e117',
  driver_id: 'driver-1',
  estado: 'activo',
  n_passageiros_contrato: 2,
  valor_mensal_por_passageiro_kz: 15000,
  ofertas_capacidade: {
    origin_name: 'Viana',
    destination_name: 'Centro',
    departure_time: '07:00',
  },
  acordos_passageiros: [
    {
      id: 'ap-debt',
      passenger_id: 'pax-debt',
      estado: 'reservado',
      quota_mensal_kz: 15000,
      perfis: { nome_completo: 'Maria Devedora' },
    },
    {
      id: 'ap-other',
      passenger_id: 'pax-other',
      estado: 'activo',
      quota_mensal_kz: 15000,
      perfis: { nome_completo: 'João Outro' },
    },
  ],
};

function renderPage(initial = ['/acordos']) {
  resetOverlayStackForTests();
  return render(
    <MemoryRouter initialEntries={initial}>
      <MyAgreements />
    </MemoryRouter>,
  );
}

async function clickAcordoKebabItem(name) {
  fireEvent.click(await screen.findByRole('menuitem', { name }));
}

async function fluxoJustaCausaPassageiro() {
  const dialog = await screen.findByTestId('acordo-detalhe-sheet');
  fireEvent.click(within(dialog).getByRole('button', { name: /Mais acções do acordo/i }));
  await clickAcordoKebabItem(/Encerrar acordo/i);
  fireEvent.click(await screen.findByRole('button', { name: /Justa causa imediata/i }));
  fireEvent.click(await screen.findByRole('button', { name: /Faltas excessivas/i }));
  fireEvent.click(await screen.findByRole('button', { name: /^Continuar$/i }));
  await waitFor(() => {
    expect(screen.getByTestId('terminate-confirm-sheet')).toBeInTheDocument();
  });
}

async function fluxoConsensualImediatoMotorista() {
  const dialog = await screen.findByTestId('acordo-detalhe-sheet');
  fireEvent.click(within(dialog).getByRole('button', { name: /Mais acções do acordo/i }));
  await clickAcordoKebabItem(/Encerrar acordo/i);
  const picker = await screen.findByTestId('terminate-modality-picker');
  fireEvent.click(within(picker).getByRole('button', { name: /Acordo amigável/i }));
  const vigencia = await screen.findByTestId('terminate-vigencia-picker');
  fireEvent.click(within(vigencia).getByRole('button', { name: /Agora — ajuste proporcional/i }));
  fireEvent.click(screen.getByRole('button', { name: /^Encerrar acordo$/i }));
  const confirmSheet = screen.queryByTestId('terminate-confirm-sheet');
  if (confirmSheet) {
    await userEvent.click(screen.getByTestId('terminate-confirm-submit'));
  }
}

describe('MyAgreements follow-up #278', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' });
    getAgreementsForDriver.mockResolvedValue([acordoActivoMulti]);
    getAgreementsForPassenger.mockResolvedValue([]);
    countLugaresVivosAcordo.mockResolvedValue(2);
    getAcordoContactos.mockResolvedValue({ bloqueado: false, passageiros: [], motorista: null });
    getObrigacaoPagamentoPassageiro.mockResolvedValue(null);
    listAnulacaoMotivoLugarAcordos.mockResolvedValue([]);
    listPagamentosPendentesMotoristaAcordo.mockResolvedValue([]);
  });

  it('P1-a: motorista vê Pagamento pendente quando BD é pendente_pagamento (acordo activo)', async () => {
    listPagamentosPendentesMotoristaAcordo.mockResolvedValue([
      {
        pagamento_id: 'e4f7e6b4',
        passenger_id: 'pax-debt',
        passenger_nome: 'Maria Devedora',
        estado: 'pendente_pagamento',
        valor: 15000,
        valor_em_divida: 15000,
      },
    ]);

    renderPage(['/acordos?openAcordoId=acordo-e117']);

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    await waitFor(() => {
      expect(within(dialog).getByTestId('motorista-pagamento-pax-debt')).toBeInTheDocument();
    });
    expect(within(dialog).getByText('Pagamento pendente')).toBeInTheDocument();
    expect(within(dialog).queryByText('Pagamento cancelado')).not.toBeInTheDocument();
  });

  it('P1-b: passageiro saiu não chama get_acordo_contactos', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-left' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([
      {
        ...acordoActivoMulti,
        acordos_passageiros: [
          {
            id: 'ap-left',
            passenger_id: 'pax-left',
            estado: 'saiu',
            quota_mensal_kz: 15000,
            perfis: { nome_completo: 'Tu' },
          },
        ],
      },
    ]);
    getObrigacaoPagamentoPassageiro.mockResolvedValue({
      pagamento: { estado: 'anulado' },
      obrigacao: { valor_em_divida: 0 },
    });

    renderPage(['/acordos?openAcordoId=acordo-e117']);
    await screen.findByTestId('acordo-detalhe-sheet');
    await waitFor(() => {
      expect(getAcordoContactos).not.toHaveBeenCalled();
    });
  });

  it('P1-b: erro RPC contactos mostra Contactos bloqueados (sem P0001)', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-other' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoActivoMulti]);
    getAcordoContactos.mockRejectedValue(Object.assign(new Error('Sem permissão'), { code: 'P0001' }));
    getObrigacaoPagamentoPassageiro.mockResolvedValue({
      pagamento: { estado: 'em_custodia' },
      obrigacao: { valor_em_divida: 0 },
    });

    renderPage(['/acordos?openAcordoId=acordo-e117']);
    const sheet = await screen.findByTestId('acordo-detalhe-sheet');
    await waitFor(() => {
      expect(within(sheet).getByTestId('contactos-bloqueados')).toBeInTheDocument();
    });
    expect(within(sheet).queryByText(/P0001/i)).not.toBeInTheDocument();
  });

  it('B2: motorista JC vê toast «Acordo terminado por justa causa.»', async () => {
    terminateAgreement.mockResolvedValue({
      id: 'acordo-e117',
      estado: 'cancelado_justificado',
      rescisao_modo: 'justa_causa',
      terminate_status: 'ok',
    });

    renderPage(['/acordos?openAcordoId=acordo-e117']);
    await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    await fluxoJustaCausaPassageiro();
    await userEvent.click(screen.getByTestId('terminate-confirm-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('agreements-feedback')).toHaveTextContent(
        TOAST_JC_MOTORISTA_ACORDO_RESCINDIDO,
      );
    });
    expect(screen.getByTestId('agreements-feedback')).not.toHaveTextContent(
      TOAST_JC_PASSAGEIRO_LUGAR_TERMINADO,
    );
  });

  it('B2: passageiro cancelado_justificado sem JC usa toast passageiro (não motorista)', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-other' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoActivoMulti]);
    getObrigacaoPagamentoPassageiro.mockResolvedValue({
      pagamento: { estado: 'em_custodia' },
      obrigacao: { valor_em_divida: 0 },
    });
    terminateAgreement.mockResolvedValue({
      id: 'acordo-e117',
      estado: 'cancelado_justificado',
      terminate_status: 'ok',
    });

    renderPage(['/acordos?openAcordoId=acordo-e117']);
    await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    await fluxoConsensualImediatoMotorista();

    await waitFor(() => {
      expect(screen.getByTestId('agreements-feedback')).toHaveTextContent(
        TOAST_JC_PASSAGEIRO_ACORDO_ENCERRADO,
      );
    });
    expect(screen.getByTestId('agreements-feedback')).not.toHaveTextContent(
      TOAST_JC_MOTORISTA_ACORDO_RESCINDIDO,
    );
  });

  it('B2: cancelado_justificado sem modo justa_causa usa toast motorista', async () => {
    terminateAgreement.mockResolvedValue({
      id: 'acordo-e117',
      estado: 'cancelado_justificado',
      terminate_status: 'ok',
    });

    renderPage(['/acordos?openAcordoId=acordo-e117']);
    await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    await fluxoConsensualImediatoMotorista();

    await waitFor(() => {
      expect(screen.getByTestId('agreements-feedback')).toHaveTextContent(
        TOAST_JC_MOTORISTA_ACORDO_RESCINDIDO,
      );
    });
  });

  it('P1-c: toast parcial vs encerrado; folha Confirmar não reaparece após JC', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-other' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoActivoMulti]);
    countLugaresVivosAcordo.mockResolvedValue(2);
    getObrigacaoPagamentoPassageiro.mockResolvedValue({
      pagamento: { estado: 'em_custodia' },
      obrigacao: { valor_em_divida: 0 },
    });
    terminateAgreement.mockResolvedValue({
      id: 'acordo-e117',
      estado: 'activo',
      terminate_status: 'ok',
    });

    renderPage(['/acordos?openAcordoId=acordo-e117']);
    await screen.findByRole('dialog', { name: /Detalhe do acordo/i });

    await fluxoJustaCausaPassageiro();
    await userEvent.click(screen.getByTestId('terminate-confirm-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('agreements-feedback')).toHaveTextContent(
        TOAST_JC_PASSAGEIRO_LUGAR_TERMINADO,
      );
    });
    expect(screen.queryByTestId('terminate-confirm-sheet')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Confirmar$/i })).not.toBeInTheDocument();

    terminateAgreement.mockResolvedValue({
      id: 'acordo-solo',
      estado: 'cancelado',
      terminate_status: 'ok',
    });
    countLugaresVivosAcordo.mockResolvedValue(1);
    getAgreementsForPassenger.mockResolvedValue([
      {
        ...acordoActivoMulti,
        id: 'acordo-solo',
        n_passageiros_contrato: 1,
        acordos_passageiros: [
          {
            id: 'ap-solo',
            passenger_id: 'pax-other',
            estado: 'activo',
            quota_mensal_kz: 15000,
            perfis: { nome_completo: 'Tu' },
          },
        ],
      },
    ]);

    renderPage(['/acordos?openAcordoId=acordo-solo']);
    await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    await fluxoJustaCausaPassageiro();
    await userEvent.click(screen.getByTestId('terminate-confirm-submit'));

    await waitFor(() => {
      expect(screen.getAllByTestId('agreements-feedback').pop()).toHaveTextContent(
        TOAST_JC_PASSAGEIRO_ACORDO_ENCERRADO,
      );
    });
  });

  it('DRY: cartão e header partilham chipCtx — mesma copy no chip de lugar', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-exp' }, tipoPerfil: 'Passageiro' });
    listAnulacaoMotivoLugarAcordos.mockResolvedValue([
      {
        acordo_id: 'acordo-e117',
        passenger_id: 'pax-exp',
        anulacao_motivo: ANULACAO_MOTIVO.PRAZO_RESERVA_EXPIRADO,
        pagamento_estado: 'anulado',
      },
    ]);
    getAgreementsForPassenger.mockResolvedValue([
      {
        ...acordoActivoMulti,
        acordos_passageiros: [
          {
            id: 'ap-exp-me',
            passenger_id: 'pax-exp',
            estado: 'expirado',
            quota_mensal_kz: 15000,
            perfis: { nome_completo: 'Tu' },
          },
          acordoActivoMulti.acordos_passageiros[1],
        ],
      },
    ]);
    getObrigacaoPagamentoPassageiro.mockResolvedValue({
      pagamento: { estado: 'anulado', anulacao_motivo: ANULACAO_MOTIVO.PRAZO_RESERVA_EXPIRADO },
      obrigacao: { valor_em_divida: 0 },
    });

    renderPage(['/acordos?openAcordoId=acordo-e117']);
    const chipTestId = 'acordo-lugar-expirado-chip-acordo-e117';
    await waitFor(() => {
      expect(screen.getAllByTestId(chipTestId).length).toBeGreaterThanOrEqual(2);
    });
    const [cardChip, headerChip] = screen.getAllByTestId(chipTestId);
    expect(cardChip).toHaveTextContent(CHIP_LUGAR_RESERVA_EXPIRADA);
    expect(headerChip).toHaveTextContent(CHIP_LUGAR_RESERVA_EXPIRADA);
    expect(cardChip.textContent).toBe(headerChip.textContent);
  });

  it('B1: chip justa causa no header do sheet coincide com a lista (passageiro)', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-jc' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([
      {
        ...acordoActivoMulti,
        acordos_passageiros: [
          {
            id: 'ap-jc-me',
            passenger_id: 'pax-jc',
            estado: 'saiu',
            lugar_rescisao_modo: 'justa_causa',
            quota_mensal_kz: 15000,
            perfis: { nome_completo: 'Tu' },
          },
          acordoActivoMulti.acordos_passageiros[1],
        ],
      },
    ]);
    getObrigacaoPagamentoPassageiro.mockResolvedValue({
      pagamento: { estado: 'anulado' },
      obrigacao: { valor_em_divida: 0 },
    });

    renderPage(['/acordos?openAcordoId=acordo-e117']);
    const chipTestId = 'acordo-lugar-saiu-chip-acordo-e117';
    await waitFor(() => {
      expect(screen.getAllByTestId(chipTestId).length).toBeGreaterThanOrEqual(2);
    });
    const chips = screen.getAllByTestId(chipTestId);
    chips.forEach((chip) => {
      expect(chip).toHaveTextContent(CHIP_LUGAR_SAiu_JUSTA_CAUSA);
    });
    const header = screen.getByTestId('acordo-detalhe-sheet-header');
    expect(within(header).getByTestId(chipTestId)).toHaveTextContent(CHIP_LUGAR_SAiu_JUSTA_CAUSA);
  });

  it('B1: chip reserva expirada no header do sheet coincide com a lista (passageiro)', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-exp' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([
      {
        ...acordoActivoMulti,
        acordos_passageiros: [
          {
            id: 'ap-exp-me',
            passenger_id: 'pax-exp',
            estado: 'expirado',
            quota_mensal_kz: 15000,
            perfis: { nome_completo: 'Tu' },
          },
          acordoActivoMulti.acordos_passageiros[1],
        ],
      },
    ]);
    getObrigacaoPagamentoPassageiro.mockResolvedValue({
      pagamento: { estado: 'anulado', anulacao_motivo: 'reserva_expirada' },
      obrigacao: { valor_em_divida: 0 },
    });

    renderPage(['/acordos?openAcordoId=acordo-e117']);
    const chipTestId = 'acordo-lugar-expirado-chip-acordo-e117';
    await waitFor(() => {
      expect(screen.getAllByTestId(chipTestId).length).toBeGreaterThanOrEqual(2);
    });
    const chips = screen.getAllByTestId(chipTestId);
    chips.forEach((chip) => {
      expect(chip).toHaveTextContent(CHIP_LUGAR_RESERVA_EXPIRADA);
    });
    const header = screen.getByTestId('acordo-detalhe-sheet-header');
    expect(within(header).getByTestId(chipTestId)).toHaveTextContent(CHIP_LUGAR_RESERVA_EXPIRADA);
  });

  it('P1-d: chip justa causa unificado na lista motorista', async () => {
    getAgreementsForDriver.mockResolvedValue([
      {
        ...acordoActivoMulti,
        acordos_passageiros: [
          {
            id: 'ap-jc',
            passenger_id: 'pax-jc',
            estado: 'saiu',
            lugar_rescisao_modo: 'justa_causa',
            quota_mensal_kz: 15000,
            perfis: { nome_completo: 'Ana JC' },
          },
          acordoActivoMulti.acordos_passageiros[1],
        ],
      },
    ]);

    renderPage(['/acordos?openAcordoId=acordo-e117']);
    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(
      within(dialog).getByTestId('passageiro-estado-chip-pax-jc'),
    ).toHaveTextContent(CHIP_LUGAR_SAiu_JUSTA_CAUSA);
  });

  it('P1-e: passageiro A vê secção Encerrados quando saiu e acordo continua', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-a' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([
      {
        ...acordoActivoMulti,
        acordos_passageiros: [
          {
            id: 'ap-a',
            passenger_id: 'pax-a',
            estado: 'saiu',
            quota_mensal_kz: 15000,
            perfis: { nome_completo: 'Tu' },
          },
          acordoActivoMulti.acordos_passageiros[1],
        ],
      },
    ]);
    getObrigacaoPagamentoPassageiro.mockResolvedValue({
      pagamento: { estado: 'pendente_pagamento' },
      obrigacao: { valor_em_divida: 15000 },
    });

    renderPage();
    expect(await screen.findByText(new RegExp(`${LISTA_SECCAO_ENCERRADOS} · 1`, 'i'))).toBeInTheDocument();
    expect(screen.queryByText(/Activos · 1/i)).not.toBeInTheDocument();
  });

  it('UI Maestro: cartão motorista mostra linha Grupo com lugares vivos', async () => {
    renderPage();
    expect(await screen.findByTestId('acordo-grupo-linha-acordo-e117')).toHaveTextContent(
      'Grupo · 2 pessoas',
    );
  });
});
