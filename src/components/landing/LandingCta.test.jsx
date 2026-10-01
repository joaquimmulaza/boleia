import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LandingCta from './LandingCta';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderCta() {
  return render(
    <BrowserRouter>
      <LandingCta />
    </BrowserRouter>
  );
}

describe('LandingCta', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('fecha com o mesmo carro e o preço do mês em Kz, sem números inventados', () => {
    renderCta();

    expect(screen.getByRole('heading', { name: /mesmo carro/i })).toBeInTheDocument();
    expect(screen.getByText(/preço do mês em Kz/i)).toBeInTheDocument();
    expect(screen.queryByText(/centenas de pessoas/i)).not.toBeInTheDocument();
  });

  it('não expõe jargon nem claims proibidos', () => {
    const { container } = renderCta();
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/1:N|1:n|matchmaking|marketplace|matching|custódia/i);
    expect(text).not.toMatch(/seguro|segurança|verificad|garantid|multicaixa|proxypay/i);
  });

  it('navega para registo com papel explícito', () => {
    renderCta();

    fireEvent.click(screen.getByRole('button', { name: /Sou Passageiro/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/auth?mode=register&role=passenger');

    fireEvent.click(screen.getByRole('button', { name: /Sou Motorista/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/auth?mode=register&role=driver');
  });
});
