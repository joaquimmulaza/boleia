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

  it('mostra título e três passos do fluxo boleia casa–trabalho', () => {
    render(<LandingHowItWorks />);

    expect(screen.getByRole('heading', { name: /como funciona/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /diz o teu percurso/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /combinam a proposta/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /fecha o acordo mensal/i })).toBeInTheDocument();
  });

  it('não expõe jargon interno nem fórmulas de produto', () => {
    const { container } = render(<LandingHowItWorks />);
    const text = container.textContent;
    expect(text).not.toMatch(/N_candidato|N_proposto|N_actual|POR_PASSAGEIRO|TOTAL_ACORDO/);
    expect(text).not.toMatch(/1:N|1:n|matchmaking|marketplace/i);
  });
});
