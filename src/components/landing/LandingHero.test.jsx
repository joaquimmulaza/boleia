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

/**
 * @param {string} text
 * @returns {number}
 */
function countWords(text) {
  return text.trim().split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

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

  it('headline parte da dor do táxi e promete o mesmo carro, em ≤10 palavras', () => {
    renderHero();

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toMatch(/táxi/i);
    expect(heading.textContent).toMatch(/mesmo carro/i);
    expect(countWords(heading.textContent)).toBeLessThanOrEqual(10);
  });

  it('frase de apoio descreve a paragem cheia, fala a passageiro e motorista e cabe em ≤45 palavras', () => {
    renderHero();

    const support = screen.getByTestId('landing-hero-support');
    expect(support.textContent).toMatch(/paragem|táxi|trânsito/i);
    expect(support.textContent).toMatch(/Luanda/);
    expect(support.textContent).toMatch(/Kz/);
    expect(support.textContent).toMatch(/lugares vazios/i);
    expect(countWords(support.textContent)).toBeLessThanOrEqual(45);
  });

  it('mostra logo oficial e eyebrow de boleia casa–trabalho', () => {
    renderHero();

    expect(screen.getByAltText('Boleia Certa')).toHaveAttribute('src', '/boleia-logo.png');
    expect(document.body.textContent).toMatch(/casa–trabalho/i);
  });

  it('mock do produto mostra rota fixa, oferta flexível sem rota marcada e acordo do mês em Kz', () => {
    renderHero();

    expect(screen.getByText(/lugares do motorista/i)).toBeInTheDocument();
    expect(screen.getByText(/oferta flexível/i)).toBeInTheDocument();
    expect(screen.getByText(/sem rota marcada/i)).toBeInTheDocument();
    expect(screen.getByText(/acordo do mês/i)).toBeInTheDocument();
    expect(screen.getByText(/1 motorista · 3 passageiros · mesmo carro/i)).toBeInTheDocument();
    expect(screen.getByText(/25\.000 Kz por passageiro/i)).toBeInTheDocument();
  });

  it('não expõe jargon nem claims proibidos', () => {
    renderHero();
    const text = document.body.textContent ?? '';

    expect(text).not.toMatch(/1:N|1:n|matchmaking|marketplace|matching|custódia/i);
    expect(text).not.toMatch(/N_candidato|N_proposto|N_actual|POR_PASSAGEIRO|TOTAL_ACORDO/);
    expect(text).not.toMatch(/seguro|segurança|verificad|garantid|multicaixa|proxypay/i);
  });

  it('Explorar boleias leva ao browse público', () => {
    renderHero();

    fireEvent.click(screen.getByRole('button', { name: 'Explorar boleias' }));
    expect(mockNavigate).toHaveBeenCalledWith('/explorar');
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
