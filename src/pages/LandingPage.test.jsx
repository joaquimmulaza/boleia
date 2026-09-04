import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../contexts/ThemeContext';
import LandingPage from './LandingPage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
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

    expect(screen.getByText('A tua rota diária, mais simples e barata.')).toBeInTheDocument();
    expect(screen.getByText(/Ligamos-te a motoristas para trajetos fixos e acordos mensais/i)).toBeInTheDocument();
  });

  it('navigates to /auth?role=passenger when clicking "Sou Passageiro"', () => {
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

  it('navigates to /auth?role=driver when clicking "Sou Motorista"', () => {
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

  it('renders official boleia-logo.png images in header and footer', () => {
    render(
      <ThemeProvider>
        <BrowserRouter>
          <LandingPage />
        </BrowserRouter>
      </ThemeProvider>
    );

    const logos = screen.getAllByAltText(/Boleia Certa/i);
    expect(logos.length).toBeGreaterThanOrEqual(1);
    logos.forEach(logo => {
      expect(logo).toHaveAttribute('src', '/boleia-logo.png');
    });
  });
});
