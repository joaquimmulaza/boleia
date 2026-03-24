import { vi, describe, it, expect, beforeEach } from 'vitest';
import { supabase } from '../lib/supabase';
import { publishRoute } from './RouteService';
import { requestSeat, approveAgreement } from './AgreementsService';

// Mock dependencies
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe('Mental E2E - Agreement Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('completes the full lifecycle of an agreement', async () => {
    // ---- FASE 1: Motorista publica rota ----
    const driverId = 'motorista-123';
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: driverId } },
      error: null,
    });

    const routeData = {
      origin_name: 'Casa',
      origin_lat: -8.839,
      origin_lng: 13.289,
      destination_name: 'Trabalho',
      destination_lat: -8.845,
      destination_lng: 13.265,
      departure_time: '07:30',
      return_time: '18:00',
      available_seats: 4,
      monthly_price_per_seat: 10000,
    };

    const mockInsertRoute = vi.fn().mockResolvedValue({ error: null });

    // Configura o mock inicial para routes (insert)
    supabase.from.mockImplementation((table) => {
      if (table === 'routes') {
        return { insert: mockInsertRoute };
      }
      return {};
    });

    const publishResult = await publishRoute(routeData);
    expect(publishResult.success).toBe(true);
    expect(mockInsertRoute).toHaveBeenCalledWith([
      expect.objectContaining({
        driver_id: driverId,
        available_seats: 4,
      }),
    ]);


    // ---- FASE 2: Passageiro pede vaga ----
    const passengerId = 'passageiro-456';
    const routeId = 'rota-1';

    const mockInsertAgreement = {
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'acordo-1', route_id: routeId, passenger_id: passengerId, estado: 'Pendente' },
        error: null,
      }),
    };

    supabase.from.mockImplementation((table) => {
      if (table === 'acordos') {
        return { insert: vi.fn().mockReturnValue(mockInsertAgreement) };
      }
      return {};
    });

    const requestResult = await requestSeat(routeId, passengerId);
    expect(requestResult.estado).toBe('Pendente');


    // ---- FASE 3: Motorista aceita → estado muda para Ativo & available_seats decresce ----
    const agreementId = 'acordo-1';

    // Mock das chamadas sequenciais no approveAgreement:
    // 1. update acordos
    const mockUpdateAcordos = vi.fn().mockResolvedValue({ error: null });

    // 2. select acordos
    const mockSelectAcordosSingle = vi.fn().mockResolvedValue({
        data: { route_id: routeId },
        error: null,
    });
    const mockSelectAcordosEq = vi.fn().mockReturnValue({ single: mockSelectAcordosSingle });

    // 3. select routes
    const mockSelectRoutesSingle = vi.fn().mockResolvedValue({
        data: { available_seats: 4 }, // vagas actuais
        error: null,
    });
    const mockSelectRoutesEq = vi.fn().mockReturnValue({ single: mockSelectRoutesSingle });

    // 4. update routes
    const mockUpdateRoutes = vi.fn().mockResolvedValue({ error: null });

    // Configuração do mock dinâmico complexo
    supabase.from.mockImplementation((table) => {
      if (table === 'acordos') {
        return {
          update: (payload) => ({
             eq: (field, value) => {
               mockUpdateAcordos(payload, field, value);
               return Promise.resolve({ error: null });
             }
          }),
          select: () => ({ eq: mockSelectAcordosEq }),
        };
      }
      if (table === 'routes') {
        return {
          select: () => ({ eq: mockSelectRoutesEq }),
          update: (payload) => ({
             eq: (field, value) => {
                mockUpdateRoutes(payload, field, value);
                return Promise.resolve({ error: null });
             }
          }),
        };
      }
      return {};
    });

    const approveResult = await approveAgreement(agreementId);

    expect(approveResult).toBe(true);

    // Verifica mudança de estado para 'Ativo'
    expect(mockUpdateAcordos).toHaveBeenCalledWith({ estado: 'Ativo' }, 'id', agreementId);

    // Verifica se os available_seats decresceram (-1 de 4)
    expect(mockUpdateRoutes).toHaveBeenCalledWith({ available_seats: 3 }, 'id', routeId);
  });
});
