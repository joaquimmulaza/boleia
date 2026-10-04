import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicLegalPage from './PublicLegalPage';

describe('Páginas públicas de privacidade e eliminação', () => {
  afterEach(() => {
    cleanup();
  });

  /**
   * @param {'privacidade' | 'eliminacao'} page
   */
  function renderPage(page) {
    render(
      <MemoryRouter>
        <PublicLegalPage page={page} />
      </MemoryRouter>,
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

  it('o cabeçalho inteiro liga a / e não tem Voltar', () => {
    renderPage('privacidade');

    const header = screen.getByRole('banner');
    const home = screen.getByRole('link', { name: 'Boleia Certa' });
    expect(header).toContainElement(home);
    expect(home).toHaveAttribute('href', '/');
    expect(screen.queryByRole('link', { name: /voltar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /voltar/i })).not.toBeInTheDocument();
  });

  it('o rodapé liga à privacidade e à eliminação de dados', () => {
    renderPage('eliminacao');

    expect(screen.getByRole('link', { name: /^privacidade$/i })).toHaveAttribute('href', '/privacidade');
    expect(screen.getByRole('link', { name: /^eliminação de dados$/i })).toHaveAttribute(
      'href',
      '/eliminacao-de-dados',
    );
  });
});
