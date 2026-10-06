import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../contexts/ThemeContext';
import PublicLegalPage from './PublicLegalPage';

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

describe('Páginas públicas de privacidade e eliminação', () => {
  afterEach(() => {
    cleanup();
  });

  /**
   * @param {'privacidade' | 'eliminacao'} page
   */
  function renderPage(page) {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <PublicLegalPage page={page} />
        </MemoryRouter>
      </ThemeProvider>,
    );
  }

  it('mostra a política de privacidade com o texto do frame', () => {
    renderPage('privacidade');

    expect(screen.getByRole('heading', { name: 'Política de privacidade' })).toBeInTheDocument();
    expect(screen.getByText(
      'No início de sessão com conta social, a Boleia Certa guarda o teu nome, o email e a foto de perfil.',
    )).toBeInTheDocument();
    expect(screen.getByText(
      'Os provedores de início de sessão são Google, Facebook e LinkedIn.',
    )).toBeInTheDocument();
  });

  it('mostra a eliminação de dados com o texto do frame', () => {
    renderPage('eliminacao');

    expect(screen.getByRole('heading', { name: 'Eliminação de dados' })).toBeInTheDocument();
    expect(screen.getByText(
      'Podes pedir a eliminação da tua conta e dos dados associados.',
    )).toBeInTheDocument();
  });

  it('cabeçalho legal tem pill glass só com logo e alternar tema', () => {
    renderPage('privacidade');

    const header = screen.getByTestId('public-page-header');
    expect(header.querySelector('[data-variant="legal"]')).toBeInTheDocument();
    expect(within(header).getByRole('link', { name: 'Boleia Certa' })).toHaveAttribute('href', '/');
    expect(within(header).getByRole('button', { name: /alternar tema/i })).toBeInTheDocument();
    expect(within(header).queryByRole('navigation', { name: 'Navegação principal' })).not.toBeInTheDocument();
    expect(within(header).queryByRole('button', { name: 'Criar conta' })).not.toBeInTheDocument();
    expect(within(header).queryByRole('link', { name: /^entrar$/i })).not.toBeInTheDocument();
  });

  it('o rodapé liga à privacidade e à eliminação de dados', () => {
    renderPage('eliminacao');

    expect(screen.getByRole('link', { name: /^privacidade$/i })).toHaveAttribute('href', '/privacidade');
    expect(screen.getByRole('link', { name: /^eliminação de dados$/i })).toHaveAttribute(
      'href',
      '/eliminacao-de-dados',
    );
  });

  it('rodapé não inclui Termos', () => {
    renderPage('privacidade');

    expect(screen.queryByRole('link', { name: /^termos$/i })).not.toBeInTheDocument();
  });
});
