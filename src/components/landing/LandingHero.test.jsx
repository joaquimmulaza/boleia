import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LandingHero from './LandingHero';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('LandingHero', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  /**
   * @returns {HTMLElement}
   */
  function renderHero() {
    const { container } = render(
      <BrowserRouter>
        <LandingHero />
      </BrowserRouter>
    );
    return container;
  }

  it('renderiza headline de marketplace casa-trabalho (não o copy legado)', () => {
    renderHero();

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toMatch(/casa|trabalho|boleia|match|quotidiano|diári/i);
    expect(heading.textContent).not.toBe('A tua rota diária, mais simples e barata.');
  });

  it('mostra marca hero-level e frase de suporte com fluxo procura/oferta → acordo', () => {
    renderHero();

    const logo = screen.getByAltText('Boleia Certa');
    expect(logo).toHaveAttribute('src', '/boleia-logo.png');

    expect(screen.getAllByText(/procura|oferta/i).length).toBeGreaterThan(0);
    expect(document.body.textContent).toMatch(/proposta/i);
    expect(document.body.textContent).toMatch(/acordo/i);
    expect(document.body.textContent).toMatch(/Kz|Luanda/i);
  });

  it('mostra mock leve do produto com Oferta, Procura e Acordo em Kz', () => {
    renderHero();

    expect(screen.getByText('Oferta')).toBeInTheDocument();
    expect(screen.getByText('Procura')).toBeInTheDocument();
    expect(screen.getByText('Acordo')).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/Kz/);
  });

  it('navega para auth passageiro e motorista nos CTAs', () => {
    renderHero();

    fireEvent.click(screen.getByRole('button', { name: 'Sou Passageiro' }));
    expect(mockNavigate).toHaveBeenCalledWith('/auth?mode=register&role=passenger');

    fireEvent.click(screen.getByRole('button', { name: 'Sou Motorista' }));
    expect(mockNavigate).toHaveBeenCalledWith('/auth?mode=register&role=driver');
  });

  it('não usa stock externo nem URLs http(s) no HTML do hero', () => {
    const container = renderHero();
    const html = `${container.innerHTML}\n${document.body.innerHTML}`;

    expect(html).not.toMatch(/googleusercontent/i);
    expect(html).not.toMatch(/backgroundImage|background-image[^;]*https?:\/\//i);
    expect(html).not.toMatch(/url\(\s*["']?https?:\/\//i);
    expect(html).not.toMatch(/src=["']https?:\/\//i);
  });
});
