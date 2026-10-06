import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingHero from './LandingHero';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../hooks/useAutocomplete', () => ({
  useAutocomplete: () => ({
    suggestions: [],
    loading: false,
    error: null,
    fetchPredictions: vi.fn(),
    selectPlace: vi.fn(),
    clearSuggestions: vi.fn(),
  }),
}));

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
   * @param {string} [initialRoute]
   * @returns {HTMLElement}
   */
  function renderHero(initialRoute = '/') {
    const { container } = render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <LandingHero />
      </MemoryRouter>,
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

  it('mostra chip de boleia casa–trabalho', () => {
    renderHero();

    expect(document.body.textContent).toMatch(/casa–trabalho/i);
  });

  it('substitui storyboard por cartão de pesquisa OD', () => {
    renderHero();

    expect(screen.queryByTestId('hero-route-storyboard')).not.toBeInTheDocument();
    expect(screen.getByTestId('hero-search-card')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('De onde sais?')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Para onde vais?')).toBeInTheDocument();
  });

  it('não expõe jargon nem claims proibidos', () => {
    renderHero();
    const text = document.body.textContent ?? '';

    expect(text).not.toMatch(/1:N|1:n|matchmaking|marketplace|matching|custódia/i);
    expect(text).not.toMatch(/N_candidato|N_proposto|N_actual|POR_PASSAGEIRO|TOTAL_ACORDO/);
    expect(text).not.toMatch(/seguro|segurança|verificad|garantid|multicaixa|proxypay/i);
  });

  it('não mostra Explorar boleias; Ver boleias está no cartão de pesquisa', () => {
    renderHero();

    expect(screen.queryByRole('button', { name: 'Explorar boleias' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver boleias' })).toBeInTheDocument();
  });

  it('Criar conta leva ao registo', () => {
    renderHero();

    fireEvent.click(screen.getAllByRole('button', { name: 'Criar conta' })[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/auth?mode=register');
  });

  it('preenche pesquisa quando URL traz origem e destino (Editar)', () => {
    renderHero('/?origem=Talatona&destino=Centro&origem_lat=-8.9&origem_lng=13.2&destino_lat=-8.8&destino_lng=13.3');

    expect(screen.getByDisplayValue('Talatona')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Centro')).toBeInTheDocument();
  });

  it('hero não inclui Sou Passageiro nem Sou Motorista', () => {
    renderHero();

    expect(screen.queryByRole('button', { name: 'Sou Passageiro' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sou Motorista' })).not.toBeInTheDocument();
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
