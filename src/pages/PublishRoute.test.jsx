import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import PublishRoute from './PublishRoute';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn()
    }
  }
}));

const mockInsert = vi.fn();

describe('PublishRoute Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.from.mockReturnValue({
      insert: mockInsert
    });
    mockInsert.mockResolvedValue({ error: null });
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'test-driver-id' } }, error: null });
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <PublishRoute />
      </BrowserRouter>
    );
  };

  it('renders all form fields correctly', () => {
    renderComponent();
    
    expect(screen.getByLabelText(/Local de Partida/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Destino/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Hora de Partida/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Hora de Regresso/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Vagas/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Valor Mensal/i)).toBeInTheDocument();
  });

  it('submits form with correct data and shows loading state', async () => {
    renderComponent();
    
    fireEvent.change(screen.getByLabelText(/Local de Partida/i), { target: { value: 'Luanda' } });
    fireEvent.change(screen.getByLabelText(/Destino/i), { target: { value: 'Benguela' } });
    fireEvent.change(screen.getByLabelText(/Hora de Partida/i), { target: { value: '08:00' } });
    fireEvent.change(screen.getByLabelText(/Hora de Regresso/i), { target: { value: '18:00' } });
    fireEvent.change(screen.getByLabelText(/Vagas/i), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText(/Valor Mensal/i), { target: { value: '15000' } });

    const submitButton = screen.getByRole('button', { name: /Publicar Trajeto/i });
    expect(submitButton).not.toBeDisabled();

    fireEvent.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/A publicar.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith([{
        driver_id: 'test-driver-id',
        origin_name: 'Luanda',
        destination_name: 'Benguela',
        departure_time: '08:00',
        return_time: '18:00',
        available_seats: 3,
        monthly_price_per_seat: 15000
      }]);
    });

    await waitFor(() => {
        expect(screen.getByText(/Trajeto publicado com sucesso/i)).toBeInTheDocument();
    });
  });

  it('enforces poka-yoke constraints on inputs', () => {
    renderComponent();

    const departureTimeInput = screen.getByLabelText(/Hora de Partida/i);
    expect(departureTimeInput).toHaveAttribute('type', 'time');

    const returnTimeInput = screen.getByLabelText(/Hora de Regresso/i);
    expect(returnTimeInput).toHaveAttribute('type', 'time');

    const seatsInput = screen.getByLabelText(/Vagas/i);
    expect(seatsInput).toHaveAttribute('type', 'number');
    expect(seatsInput).toHaveAttribute('min', '1');
    expect(seatsInput).toHaveAttribute('max', '4');

    const priceInput = screen.getByLabelText(/Valor Mensal/i);
    expect(priceInput).toHaveAttribute('type', 'number');
    expect(priceInput).toHaveAttribute('min', '0');
  });
});
