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

  it('renderiza headline de boleia casa-trabalho (não o copy legado)', () => {
    renderHero();

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toMatch(/casa|trabalho|boleia|quotidiano|diári/i);
    expect(heading.textContent).not.toBe('A tua rota diária, mais simples e barata.');
  });

  it('mostra marca hero-level e frase de suporte com percurso → acordo mensal', () => {
    renderHero();

    const logo = screen.getByAltText('Boleia Certa');
    expect(logo).toHaveAttribute('src', '/boleia-logo.png');

    expect(document.body.textContent).toMatch(/percurso/i);
    expect(document.body.textContent).toMatch(/motorista|passageiro/i);
    expect(document.body.textContent).toMatch(/acordo/i);
    expect(document.body.textContent).toMatch(/Kz|Kwanza|Luanda/i);
  });

  it('mostra mock leve do produto com lugares, procura e acordo em Kz', () => {
    renderHero();

    expect(screen.getByText(/lugares do motorista/i)).toBeInTheDocument();
    expect(screen.getByText(/quem precisa de boleia/i)).toBeInTheDocument();
    expect(screen.getByText(/1 motorista · vários passageiros/i)).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/Kz/);
  });

  it('não expõe jargon de produto (1:N, matchmaking, marketplace)', () => {
    renderHero();
    const text = document.body.textContent ?? '';

    expect(text).not.toMatch(/1:N|1:n|matchmaking|marketplace/i);
    expect(text).not.toMatch(/N_candidato|N_proposto|N_actual|POR_PASSAGEIRO|TOTAL_ACORDO/);
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
