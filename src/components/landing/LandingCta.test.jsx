import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LandingCta from './LandingCta';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('LandingCta', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('reforça acordo mensal sem números inventados', () => {
    render(
      <BrowserRouter>
        <LandingCta />
      </BrowserRouter>
    );

    expect(screen.getByText(/junta-te ao boleia certa/i)).toBeInTheDocument();
    expect(screen.getByText(/acordo mensal/i)).toBeInTheDocument();
    expect(screen.queryByText(/centenas de pessoas/i)).not.toBeInTheDocument();
  });

  it('não expõe jargon de produto (1:N, matchmaking, marketplace)', () => {
    const { container } = render(
      <BrowserRouter>
        <LandingCta />
      </BrowserRouter>
    );
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/1:N|1:n|matchmaking|marketplace/i);
  });

  it('navega para registo com papel explícito', () => {
    render(
      <BrowserRouter>
        <LandingCta />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Sou Passageiro/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/auth?mode=register&role=passenger');

    fireEvent.click(screen.getByRole('button', { name: /Sou Motorista/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/auth?mode=register&role=driver');
  });
});
