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

  it('mostra título e três passos do marketplace', () => {
    render(<LandingHowItWorks />);

    expect(screen.getByRole('heading', { name: /como funciona/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /publica procura ou oferta/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /combina proposta ou grupo/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /acordo 1:N com preço em Kz/i })).toBeInTheDocument();
  });

  it('não expõe jargon interno', () => {
    const { container } = render(<LandingHowItWorks />);
    const text = container.textContent;
    expect(text).not.toMatch(/N_candidato|N_proposto|N_actual|POR_PASSAGEIRO|TOTAL_ACORDO/);
  });
});
