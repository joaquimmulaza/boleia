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

  it('mostra soft claim sem inventar números', () => {
    render(
      <BrowserRouter>
        <LandingCta />
      </BrowserRouter>
    );

    expect(screen.getByText(/junta-te ao boleia certa/i)).toBeInTheDocument();
    expect(screen.queryByText(/centenas de pessoas/i)).not.toBeInTheDocument();
  });

  it('navega para /auth ao clicar no botão', () => {
    render(
      <BrowserRouter>
        <LandingCta />
      </BrowserRouter>
    );

    const button = screen.getByRole('button', { name: /começar|registar|juntar|entrar/i });
    fireEvent.click(button);
    expect(mockNavigate).toHaveBeenCalledWith('/auth');
  });
});
