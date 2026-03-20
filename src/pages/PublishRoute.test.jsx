import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import PublishRoute from './PublishRoute';
import { supabase } from '../lib/supabase';

vi.mock('../services/GoogleMapsService', () => ({
  getPlacePredictions: vi.fn().mockResolvedValue([]),
  getPlaceDetails: vi.fn().mockResolvedValue({ lat: -8.839, lng: 13.289 }),
}));

// Setup router wrapper for tests
const renderWithRouter = (ui) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

// Mock Supabase client
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe('PublishRoute Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all form fields correctly', async () => {
    await act(async () => { renderWithRouter(<PublishRoute />); });

    expect(screen.getByLabelText(/Local de Partida/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Local de Chegada/i)).toBeInTheDocument();
    // Using getAllByText since multiple 'Ida' could exist, or getting by specific role/name
    const timeInputs = screen.getAllByRole('textbox', { hidden: true }).length > 0 ? screen.getAllByRole('textbox', { hidden: true }) : screen.getAllByRole('textbox');
    // Just verify the inputs exist by ID or Name since they are time/number types
    expect(document.querySelector('input[name="departure_time"]')).toBeInTheDocument();
    expect(document.querySelector('input[name="return_time"]')).toBeInTheDocument();
    expect(document.querySelector('input[name="available_seats"]')).toBeInTheDocument();
    expect(document.querySelector('input[name="monthly_price_per_seat"]')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Publicar Trajeto/i })).toBeInTheDocument();
  });

  it('submits form with correct data and shows loading state', async () => {
    // Mock user
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });

    // Mock database insert
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),
    });
    supabase.from.mockReturnValue({ insert: mockInsert });

    await act(async () => { renderWithRouter(<PublishRoute />); });

    // Fill form
    const originInput = document.querySelector('input[name="origin_name"]'); if(originInput) fireEvent.change(originInput, { target: { value: 'Luanda' } });
    fireEvent.change(document.querySelector('input[name="destination_name"]'), { target: { value: 'Talatona' } });
    fireEvent.change(document.querySelector('input[name="departure_time"]'), { target: { value: '07:00' } });
    fireEvent.change(document.querySelector('input[name="return_time"]'), { target: { value: '17:00' } });
    fireEvent.change(document.querySelector('input[name="available_seats"]'), { target: { value: '3' } });
    fireEvent.change(document.querySelector('input[name="monthly_price_per_seat"]'), { target: { value: '25000' } });

    // Submit
    const submitButton = screen.getByRole('button', { name: /Publicar Trajeto/i });
    fireEvent.click(submitButton);

    // Assert loading state
    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/A publicar.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('routes');
      expect(mockInsert).toHaveBeenCalledWith([{
        driver_id: 'test-user-id',
        origin_name: 'Luanda',
        origin_lat: null,
        origin_lng: null,
        destination_name: 'Talatona',
        destination_lat: null,
        destination_lng: null,
        departure_time: '07:00',
        return_time: '17:00',
        available_seats: 3,
        monthly_price_per_seat: 25000,
      }]);
      expect(screen.getByText(/Trajeto publicado com sucesso/i)).toBeInTheDocument();
    });
  });

  it('enforces poka-yoke constraints on inputs', async () => {
    await act(async () => { renderWithRouter(<PublishRoute />); });

    const seatsInput = document.querySelector('input[name="available_seats"]');
    expect(seatsInput).toHaveAttribute('type', 'number');
    expect(seatsInput).toHaveAttribute('min', '1');
    expect(seatsInput).toHaveAttribute('max', '4');

    const priceInput = document.querySelector('input[name="monthly_price_per_seat"]');
    expect(priceInput).toHaveAttribute('type', 'number');
    expect(priceInput).toHaveAttribute('min', '0');
  });

  it('shows error message when database insertion fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Mock user
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });

    // Mock database insert failure
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: null, error: new Error('DB Error') }),
    });
    // This is missing in original, the API returns the result of the insert itself in my mock
    supabase.from.mockReturnValue({ insert: vi.fn().mockResolvedValue({ data: null, error: new Error('DB Error') }) });

    await act(async () => { renderWithRouter(<PublishRoute />); });

    // Fill form (minimum required)
    const originInput = document.querySelector('input[name="origin_name"]'); if(originInput) fireEvent.change(originInput, { target: { value: 'Luanda' } });
    fireEvent.change(document.querySelector('input[name="destination_name"]'), { target: { value: 'Talatona' } });
    fireEvent.change(document.querySelector('input[name="departure_time"]'), { target: { value: '07:00' } });
    fireEvent.change(document.querySelector('input[name="return_time"]'), { target: { value: '17:00' } });
    fireEvent.change(document.querySelector('input[name="available_seats"]'), { target: { value: '3' } });
    fireEvent.change(document.querySelector('input[name="monthly_price_per_seat"]'), { target: { value: '25000' } });

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Publicar Trajeto/i })); });

    await waitFor(() => {
      expect(screen.getByText(/Erro ao publicar trajeto. Tente novamente./i)).toBeInTheDocument();
    });
  });

  it('shows error message when user is not authenticated', async () => {
    // Mock NO user
    supabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await act(async () => { renderWithRouter(<PublishRoute />); });

    // Fill form (minimum required)
    fireEvent.change(screen.getByLabelText(/Local de Partida/i), { target: { value: 'Luanda' } });
    fireEvent.change(screen.getByLabelText(/Local de Chegada/i), { target: { value: 'Benguela' } });
    fireEvent.change(screen.getByLabelText(/^Ida/i), { target: { value: '08:00' } });
    fireEvent.change(screen.getByLabelText(/Volta/i), { target: { value: '18:00' } });
    fireEvent.change(screen.getByLabelText(/Nº Vagas/i), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText(/Valor Mensal/i), { target: { value: '15000' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Publicar Trajeto/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Você precisa estar logado para publicar uma rota./i)).toBeInTheDocument();
    });
  });
});
