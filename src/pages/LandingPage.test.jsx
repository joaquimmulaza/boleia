import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ThemeProvider } from '../contexts/ThemeContext';
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
      <ThemeProvider>
        <BrowserRouter>
          <LandingPage />
        </BrowserRouter>
      </ThemeProvider>
    );

    expect(screen.getByText('Sua rota diária, mais simples e barata.')).toBeInTheDocument();
    expect(screen.getByText(/Conectamos você a motoristas para trajetos fixos e acordos mensais/i)).toBeInTheDocument();
  });

  it('navigates to /auth?mode=register&role=passenger when clicking "Sou Passageiro"', () => {
    render(
      <ThemeProvider>
        <BrowserRouter>
          <LandingPage />
        </BrowserRouter>
      </ThemeProvider>
    );

    const passengerButton = screen.getByText('Sou Passageiro');
    fireEvent.click(passengerButton);

    expect(mockNavigate).toHaveBeenCalledWith('/auth?mode=register&role=passenger');
  });

  it('navigates to /auth?mode=register&role=driver when clicking "Sou Motorista"', () => {
    render(
      <ThemeProvider>
        <BrowserRouter>
          <LandingPage />
        </BrowserRouter>
      </ThemeProvider>
    );

    const driverButton = screen.getByText('Sou Motorista');
    fireEvent.click(driverButton);

    expect(mockNavigate).toHaveBeenCalledWith('/auth?mode=register&role=driver');
  });
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
