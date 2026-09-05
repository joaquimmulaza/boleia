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
      </BrowserRouter>
    );
  }

  it('mostra logo oficial', () => {
    renderFooter();

    const logo = screen.getByAltText(/boleia certa/i);
    expect(logo).toHaveAttribute('src', '/boleia-logo.png');
  });

  it('Entrar leva a /auth', () => {
    renderFooter();

    const entrar = screen.getByRole('link', { name: /^entrar$/i });
    expect(entrar).toHaveAttribute('href', '/auth');
  });

  it('Contacto usa mailto honesto', () => {
    renderFooter();

    const contacto = screen.getByRole('link', { name: /^contacto$/i });
    expect(contacto.getAttribute('href')).toMatch(/^mailto:/);
  });

  it('Termos e Privacidade não são links mortos href="#"', () => {
    renderFooter();

    const termos = screen.getByRole('link', { name: /^termos$/i });
    const privacidade = screen.getByRole('link', { name: /^privacidade$/i });

    expect(termos.getAttribute('href')).not.toBe('#');
    expect(privacidade.getAttribute('href')).not.toBe('#');
    expect(termos.getAttribute('href')).toMatch(/^(mailto:|#termos|#privacidade|\/)/);
    expect(privacidade.getAttribute('href')).toMatch(/^(mailto:|#termos|#privacidade|\/)/);
  });

  it('não inclui link Blog', () => {
    renderFooter();

    expect(screen.queryByRole('link', { name: /blog/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/^blog$/i)).not.toBeInTheDocument();
  });
});
