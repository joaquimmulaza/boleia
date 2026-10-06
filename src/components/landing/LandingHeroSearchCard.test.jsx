import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LandingHeroSearchCard from './LandingHeroSearchCard';

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

describe('LandingHeroSearchCard', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  function renderCard(props = {}) {
    return render(
      <BrowserRouter>
        <LandingHeroSearchCard {...props} />
      </BrowserRouter>,
    );
  }

  it('mostra campos, swap e CTA Ver boleias', () => {
    renderCard();

    expect(screen.getByText('Procura uma boleia')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('De onde sais?')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Para onde vais?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trocar origem e destino' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver boleias' })).toBeInTheDocument();
  });

  it('CTA Ver boleias usa texto escuro sobre verde primário', () => {
    renderCard();
    const cta = screen.getByRole('button', { name: 'Ver boleias' });
    expect(cta.className).toMatch(/text-primary-foreground/);
    expect(cta.className).not.toMatch(/text-white/);
  });

  it('valida origem e destino antes de navegar', () => {
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'Ver boleias' }));
    expect(screen.getByText('Indica de onde sais.')).toBeInTheDocument();
    expect(screen.getByText('Indica para onde vais.')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navega para explorar com query quando OD tem coordenadas', () => {
    renderCard({
      initialOrigem: 'Talatona',
      initialDestino: 'Centro',
      initialOriginCoords: { lat: -8.916, lng: 13.234 },
      initialDestinationCoords: { lat: -8.809, lng: 13.234 },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Ver boleias' }));
    expect(mockNavigate).toHaveBeenCalledWith(
      '/explorar?origem=Talatona&destino=Centro&origem_lat=-8.916&origem_lng=13.234&destino_lat=-8.809&destino_lng=13.234',
    );
  });

  it('troca origem e destino', () => {
    renderCard({
      initialOrigem: 'Talatona',
      initialDestino: 'Centro',
      initialOriginCoords: { lat: -8.916, lng: 13.234 },
      initialDestinationCoords: { lat: -8.809, lng: 13.234 },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Trocar origem e destino' }));
    expect(screen.getByDisplayValue('Centro')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Talatona')).toBeInTheDocument();
  });
});
