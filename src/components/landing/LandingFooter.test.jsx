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

  it('organiza três colunas: Passageiro, Motorista e Geral', () => {
    renderFooter();

    expect(screen.getByRole('heading', { name: /^passageiro$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^motorista$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^geral$/i })).toBeInTheDocument();
  });

  it('coluna Passageiro liga Explorar, Criar conta e Entrar', () => {
    renderFooter();

    expect(screen.getByRole('link', { name: /^explorar boleias$/i })).toHaveAttribute('href', '/explorar');
    expect(screen.getByRole('link', { name: /^criar conta$/i })).toHaveAttribute('href', '/auth?mode=register');
    expect(screen.getByRole('link', { name: /^entrar$/i })).toHaveAttribute('href', '/auth');
  });

  it('coluna Motorista liga Publicar oferta e Sou Motorista', () => {
    renderFooter();

    expect(screen.getByRole('link', { name: /^publicar oferta$/i })).toHaveAttribute('href', '/publicar-trajeto');
    expect(screen.getByRole('link', { name: /^sou motorista$/i })).toHaveAttribute(
      'href',
      '/auth?mode=register&role=driver',
    );
  });

  it('coluna Geral liga Contacto, Privacidade e Eliminação de dados', () => {
    renderFooter();

    const email = 'joaquimmulazadev@gmail.com';
    expect(screen.getByRole('link', { name: /^contacto$/i })).toHaveAttribute('href', `mailto:${email}`);
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

  it('mostra copyright', () => {
    renderFooter();

    expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()} Boleia Certa`, 'i'))).toBeInTheDocument();
  });
});
