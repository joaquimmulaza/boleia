import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LandingPage from './LandingPage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('LandingPage Component', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders Hero text correctly', () => {
    render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );

    expect(screen.getByText('Sua rota diária, mais simples e barata.')).toBeInTheDocument();
    expect(screen.getByText(/Conectamos você a motoristas para trajetos fixos e acordos mensais/i)).toBeInTheDocument();
  });

  it('navigates to /auth?role=passenger when clicking "Sou Passageiro"', () => {
    render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );

    const passengerButton = screen.getByText('Sou Passageiro');
    fireEvent.click(passengerButton);

    expect(mockNavigate).toHaveBeenCalledWith('/auth?role=passenger');
  });

  it('navigates to /auth?role=driver when clicking "Sou Motorista"', () => {
    render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );

    const driverButton = screen.getByText('Sou Motorista');
    fireEvent.click(driverButton);

    expect(mockNavigate).toHaveBeenCalledWith('/auth?role=driver');
  });
});
