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
  value: vi.fn().mockImplementation((query) => ({
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

/**
 * @param {React.ReactElement} [ui]
 */
function renderLanding(ui = <LandingPage />) {
  return render(
    <ThemeProvider>
      <BrowserRouter>{ui}</BrowserRouter>
    </ThemeProvider>
  );
}

describe('LandingPage', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renderiza hero marketplace (sem copy legado de rotas)', () => {
    renderLanding();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/casa e trabalho/i);
    expect(screen.queryByText('A tua rota diária, mais simples e barata.')).not.toBeInTheDocument();
    expect(document.body.textContent).toMatch(/procura|oferta/i);
    expect(document.body.textContent).toMatch(/Kz/i);
  });

  it('navega para /auth?role=passenger ao clicar Sou Passageiro', () => {
    renderLanding();

    fireEvent.click(screen.getAllByRole('button', { name: 'Sou Passageiro' })[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/auth?mode=register&role=passenger');
  });

  it('navega para /auth?role=driver ao clicar Sou Motorista', () => {
    renderLanding();

    fireEvent.click(screen.getAllByRole('button', { name: 'Sou Motorista' })[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/auth?mode=register&role=driver');
  });

  it('renderiza logos oficiais boleia-logo.png', () => {
    renderLanding();

    const logos = screen.getAllByAltText(/Boleia Certa/i);
    expect(logos.length).toBeGreaterThanOrEqual(1);
    logos.forEach((logo) => {
      expect(logo).toHaveAttribute('src', '/boleia-logo.png');
    });
  });

  it('expõe âncoras das secções e menu mobile funcional', () => {
    renderLanding();

    expect(document.getElementById('como-funciona')).toBeInTheDocument();
    expect(document.getElementById('vantagens')).toBeInTheDocument();
    expect(document.getElementById('seguranca')).toBeInTheDocument();

    const menuButton = screen.getByRole('button', { name: /abrir menu/i });
    fireEvent.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('landing-menu-overlay')).toBeInTheDocument();
  });

  it('não inclui stock googleusercontent nem Blog', () => {
    const { container } = renderLanding();

    expect(container.innerHTML).not.toMatch(/googleusercontent/i);
    expect(screen.queryByRole('link', { name: /blog/i })).not.toBeInTheDocument();
  });

  it('mostra soft claim no CTA sem números inventados', () => {
    renderLanding();

    expect(screen.getByText(/junta-te ao boleia certa/i)).toBeInTheDocument();
    expect(screen.queryByText(/centenas de pessoas/i)).not.toBeInTheDocument();
  });
});
