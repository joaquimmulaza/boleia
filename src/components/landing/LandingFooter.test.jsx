import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LandingFooter from './LandingFooter';

describe('LandingFooter', () => {
  afterEach(() => {
    cleanup();
  });

  /**
   * @returns {void}
   */
  function renderFooter() {
    render(
      <BrowserRouter>
        <LandingFooter />
      </BrowserRouter>,
    );
  }

  it('Entrar leva a /auth', () => {
    renderFooter();

    const entrar = screen.getByRole('link', { name: /^entrar$/i });
    expect(entrar).toHaveAttribute('href', '/auth');
  });

  it('Contacto usa o email de contacto', () => {
    renderFooter();

    const contacto = screen.getByRole('link', { name: /^contacto$/i });
    const email = 'joaquimmulazadev@gmail.com';

    expect(contacto).toHaveAttribute('href', `mailto:${email}`);
  });

  it('Privacidade e Eliminação de dados são páginas públicas', () => {
    renderFooter();

    expect(screen.getByRole('link', { name: /^privacidade$/i })).toHaveAttribute('href', '/privacidade');
    expect(screen.getByRole('link', { name: /^eliminação de dados$/i })).toHaveAttribute(
      'href',
      '/eliminacao-de-dados',
    );
  });

  it('não inclui link Termos (cancelado)', () => {
    renderFooter();

    expect(screen.queryByRole('link', { name: /^termos$/i })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/termos de uso/i);
  });

  it('não inclui link Blog', () => {
    renderFooter();

    expect(screen.queryByRole('link', { name: /blog/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/^blog$/i)).not.toBeInTheDocument();
  });
});
