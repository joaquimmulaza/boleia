import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import MyAgreements from './MyAgreements';
import { supabase } from '../lib/supabase';
import { approveAgreement } from '../services/AgreementsService';
import { useAgreementNotifications } from '../hooks/useAgreementNotifications';

// Mock dependencies
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

vi.mock('../services/AgreementsService', () => ({
  approveAgreement: vi.fn(),
  rejectAgreement: vi.fn(),
}));

vi.mock('../hooks/useAgreementNotifications', () => ({
  useAgreementNotifications: vi.fn(),
}));

describe('Acordos E2E - Driver Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAgreementNotifications.mockReturnValue({
      notification: null,
      clearNotification: vi.fn(),
    });
  });

  it('completes the agreement acceptance flow for a driver', async () => {
    // 1. Setup mock data for driver
    const driverId = 'driver-123';
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: driverId, user_metadata: { tipo_perfil: 'Motorista' } } },
      error: null,
    });

    // Mock driver routes query
    const mockRoutesSelect = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [{ id: 'route-1' }], error: null }),
    };

    // Mock agreements query
    const mockAgreementsData = [
      {
        id: 'agreement-1',
        route_id: 'route-1',
        passenger_id: 'passenger-456',
        estado: 'Pendente',
        routes: {
          origin_name: 'Origin',
          destination_name: 'Destination',
          departure_time: '08:00',
          monthly_price_per_seat: 5000,
        },
      },
    ];

    const mockAgreementsSelect = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: mockAgreementsData, error: null }),
    };

    supabase.from.mockImplementation((table) => {
      if (table === 'routes') return mockRoutesSelect;
      if (table === 'acordos') return mockAgreementsSelect;
      return { select: vi.fn() };
    });

    approveAgreement.mockResolvedValue(true);

    // 2. Render the component
    render(
      <BrowserRouter>
        <MyAgreements />
      </BrowserRouter>
    );

    // 3. Verify driver dashboard loaded correctly
    await waitFor(() => {
      expect(screen.getByText('Pedidos de Passageiros')).toBeInTheDocument();
    });

    // 4. Verify agreement is displayed
    const acceptBtn = screen.getByRole('button', { name: /Aceitar/i });
    expect(acceptBtn).toBeInTheDocument();

    // 5. Driver clicks Accept
    fireEvent.click(acceptBtn);

    // 6. Verify service called correctly
    await waitFor(() => {
      expect(approveAgreement).toHaveBeenCalledWith('agreement-1');
    });

    // 7. Verify UI state changes
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Aceitar/i })).not.toBeInTheDocument();
      const badge = screen.getByTestId('badge-estado');
      expect(badge).toHaveTextContent(/ativo/i);
    });
  });
});
