import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../../contexts/ThemeContext';
import LandingHeader from './LandingHeader';

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
 * @param {React.ReactElement} ui
 */
function renderHeader(ui = <LandingHeader />) {
  return render(
    <ThemeProvider>
      <BrowserRouter>{ui}</BrowserRouter>
    </ThemeProvider>
  );
}

describe('LandingHeader', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renderiza o logo Boleia Certa', () => {
    renderHeader();

    const logo = screen.getByAltText('Boleia Certa');
    expect(logo).toHaveAttribute('src', '/boleia-logo.png');
  });

  it('renderiza âncoras de navegação no desktop', () => {
    renderHeader();

    const explorar = screen.getAllByRole('link', { name: 'Explorar' });
    const oQueMuda = screen.getAllByRole('link', { name: 'O que muda' });
    const comoFunciona = screen.getAllByRole('link', { name: 'Como funciona' });
    const perguntas = screen.getAllByRole('link', { name: 'Perguntas' });

    expect(explorar.some((el) => el.getAttribute('href') === '/explorar')).toBe(true);
    expect(oQueMuda.some((el) => el.getAttribute('href') === '#o-que-muda')).toBe(true);
    expect(comoFunciona.some((el) => el.getAttribute('href') === '#como-funciona')).toBe(true);
    expect(perguntas.some((el) => el.getAttribute('href') === '#perguntas')).toBe(true);

    expect(screen.queryByRole('link', { name: 'Vantagens' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Segurança' })).not.toBeInTheDocument();

    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(within(nav).getAllByRole('link')).toHaveLength(4);
  });

  it('Criar conta abre o registo', () => {
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(mockNavigate).toHaveBeenCalledWith('/auth?mode=register');
  });

  it('inclui o ThemeToggle no header', () => {
    renderHeader();

    expect(screen.getByRole('button', { name: /alternar tema/i })).toBeInTheDocument();
  });

  it('abre o menu mobile com aria-expanded e aria-controls', () => {
    renderHeader();

    const menuButton = screen.getByRole('button', { name: /abrir menu/i });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    const panelId = menuButton.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();

    fireEvent.click(menuButton);

    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(panelId)).toBeInTheDocument();
  });

  it('fecha o menu com Escape', () => {
    renderHeader();

    const menuButton = screen.getByRole('button', { name: /abrir menu/i });
    fireEvent.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('fecha o menu ao clicar no overlay', () => {
    renderHeader();

    const menuButton = screen.getByRole('button', { name: /abrir menu/i });
    fireEvent.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');

    const overlay = screen.getByTestId('landing-menu-overlay');
    fireEvent.click(overlay);

    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('fecha o menu ao clicar numa âncora do painel', () => {
    renderHeader();

    const menuButton = screen.getByRole('button', { name: /abrir menu/i });
    const panelId = menuButton.getAttribute('aria-controls');
    fireEvent.click(menuButton);

    const panel = document.getElementById(panelId);
    const anchor = within(panel).getByRole('link', { name: 'Como funciona' });
    fireEvent.click(anchor);

    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('navega para /auth ao clicar Entrar no painel e fecha o menu', () => {
    renderHeader();

    const menuButton = screen.getByRole('button', { name: /abrir menu/i });
    const panelId = menuButton.getAttribute('aria-controls');
    fireEvent.click(menuButton);

    const panel = document.getElementById(panelId);
    fireEvent.click(within(panel).getByRole('button', { name: 'Entrar' }));

    expect(mockNavigate).toHaveBeenCalledWith('/auth');
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('navega para auth passageiro/motorista a partir do painel e fecha o menu', () => {
    renderHeader();

    const menuButton = screen.getByRole('button', { name: /abrir menu/i });
    const panelId = menuButton.getAttribute('aria-controls');
    fireEvent.click(menuButton);

    const panel = document.getElementById(panelId);
    fireEvent.click(within(panel).getByRole('button', { name: 'Sou Passageiro' }));
    expect(mockNavigate).toHaveBeenCalledWith('/auth?mode=register&role=passenger');
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(menuButton);
    fireEvent.click(within(document.getElementById(panelId)).getByRole('button', { name: 'Sou Motorista' }));
    expect(mockNavigate).toHaveBeenCalledWith('/auth?mode=register&role=driver');
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  });
});
