import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LandingMotoristaStrip from './LandingMotoristaStrip';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('LandingMotoristaStrip', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  /**
   * @returns {void}
   */
  function renderStrip() {
    render(
      <BrowserRouter>
        <LandingMotoristaStrip />
      </BrowserRouter>,
    );
  }

  it('mostra copy da faixa motorista', () => {
    renderStrip();

    expect(screen.getByRole('heading', { name: /já fazes este caminho\?/i })).toBeInTheDocument();
    expect(screen.getByText(/partilha os lugares com quem vai no mesmo sentido/i)).toBeInTheDocument();
  });

  it('usa fundo inverse e hairlines de border', () => {
    renderStrip();

    const strip = screen.getByTestId('landing-motorista-strip');
    expect(strip.className).toMatch(/bg-inverse/);
    expect(strip.className).toMatch(/border-border/);
    expect(strip.className).toMatch(/border-y/);
  });

  it('navega para registo motorista como o CTA final', () => {
    renderStrip();

    fireEvent.click(screen.getByRole('button', { name: /^sou motorista$/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/auth?mode=register&role=driver');
  });
});
