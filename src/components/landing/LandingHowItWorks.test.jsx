import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LandingHowItWorks from './LandingHowItWorks';

describe('LandingHowItWorks', () => {
  it('renderiza secção com id como-funciona', () => {
    const { container } = render(<LandingHowItWorks />);
    const section = container.querySelector('#como-funciona');
    expect(section).toBeInTheDocument();
    expect(section.tagName).toBe('SECTION');
  });

  it('mostra título e três passos: publicar, a outra pessoa aceita, preço registado', () => {
    render(<LandingHowItWorks />);

    expect(screen.getByRole('heading', { name: /^como funciona$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /publica caminho ou lugares/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /a outra pessoa aceita/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /preço do mês registado/i })).toBeInTheDocument();

    const text = document.body.textContent ?? '';
    expect(text).toMatch(/sem rota marcada/i);
    expect(text).toMatch(/só a outra pessoa aceita/i);
    expect(text).toMatch(/quota dos outros não muda/i);
    expect(text).toMatch(/Kz/);
  });

  it('cada passo tem no máximo 20 palavras', () => {
    render(<LandingHowItWorks />);
    const steps = screen.getAllByTestId('como-funciona-passo');
    expect(steps).toHaveLength(3);
    steps.forEach((step) => {
      const words = (step.textContent ?? '').trim().split(/\s+/).filter(Boolean);
      expect(words.length).toBeLessThanOrEqual(20);
    });
  });

  it('não expõe jargon interno nem claims proibidos', () => {
    const { container } = render(<LandingHowItWorks />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/N_candidato|N_proposto|N_actual|POR_PASSAGEIRO|TOTAL_ACORDO/);
    expect(text).not.toMatch(/1:N|1:n|matchmaking|marketplace|matching|custódia/i);
    expect(text).not.toMatch(/seguro|segurança|verificad|garantid|multicaixa|proxypay/i);
  });
});
