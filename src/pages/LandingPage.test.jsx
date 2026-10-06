import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
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

  it('hero parte da dor do táxi em Luanda e promete o mesmo carro', () => {
    renderLanding();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/táxi/i);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/mesmo carro/i);
    expect(screen.queryByText('A tua rota diária, mais simples e barata.')).not.toBeInTheDocument();
    expect(document.body.textContent).toMatch(/paragem|trânsito/i);
    expect(document.body.textContent).toMatch(/Kz/);
  });

  it('fala ao motorista de rota própria e ao de aplicativo com renda extra', () => {
    renderLanding();
    const text = document.body.textContent ?? '';

    expect(text).toMatch(/renda extra|rendimento/i);
    expect(text).toMatch(/Yango|aplicativo|táxi/i);
    expect(text).toMatch(/sem rota marcada/i);
  });

  it('segue a ordem hero → o que muda → como funciona → perguntas → cta', () => {
    renderLanding();

    const ids = ['o-que-muda', 'como-funciona', 'perguntas'];
    const positions = ids.map((id) => {
      const el = document.getElementById(id);
      expect(el).toBeInTheDocument();
      return Array.from(document.querySelectorAll('section')).indexOf(el);
    });
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('hero navega para /explorar e registo nos CTAs principais', () => {
    renderLanding();

    fireEvent.click(screen.getByRole('button', { name: 'Explorar boleias' }));
    expect(mockNavigate).toHaveBeenCalledWith('/explorar');

    const hero = screen.getByRole('heading', { level: 1 }).closest('section');
    fireEvent.click(within(hero).getByRole('button', { name: 'Criar conta' }));
    expect(mockNavigate).toHaveBeenCalledWith('/auth?mode=register');
  });

  it('CTA final navega para registo com papel', () => {
    renderLanding();

    fireEvent.click(screen.getAllByRole('button', { name: 'Sou Passageiro' })[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/auth?mode=register&role=passenger');

    fireEvent.click(screen.getAllByRole('button', { name: 'Sou Motorista' })[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/auth?mode=register&role=driver');
  });

  it('renderiza logo no header pill', () => {
    renderLanding();

    const home = screen.getByRole('link', { name: 'Boleia Certa' });
    expect(home.querySelector('img')).toHaveAttribute('src', '/boleia-logo.png');
  });

  it('expõe âncoras das secções e menu mobile funcional', () => {
    renderLanding();

    expect(document.getElementById('o-que-muda')).toBeInTheDocument();
    expect(document.getElementById('como-funciona')).toBeInTheDocument();
    expect(document.getElementById('perguntas')).toBeInTheDocument();
    expect(document.getElementById('vantagens')).not.toBeInTheDocument();
    expect(document.getElementById('seguranca')).not.toBeInTheDocument();

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

  it('não expõe jargon de produto nem claims proibidos em toda a landing', () => {
    renderLanding();
    const text = document.body.textContent ?? '';

    expect(text).not.toMatch(/1:N|1:n|matchmaking|marketplace|matching|custódia/i);
    expect(text).not.toMatch(/N_candidato|N_proposto|N_actual|POR_PASSAGEIRO|TOTAL_ACORDO/);
    expect(text).not.toMatch(/seguro|segurança|verificad|garantid|multicaixa|proxypay/i);
    expect(text).not.toMatch(/centenas de pessoas|milhares de/i);
  });

  it('CTA final fecha com o mesmo carro e o preço do mês em Kz', () => {
    renderLanding();

    expect(screen.getByRole('heading', { name: /todos os dias, no mesmo carro/i })).toBeInTheDocument();
    expect(screen.queryByText(/junta-te ao boleia certa/i)).not.toBeInTheDocument();
  });
});
