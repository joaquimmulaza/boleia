import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LandingBenefits from './LandingBenefits';

describe('LandingBenefits', () => {
  it('renderiza secção com id vantagens', () => {
    const { container } = render(<LandingBenefits />);
    const section = container.querySelector('#vantagens');
    expect(section).toBeInTheDocument();
    expect(section.tagName).toBe('SECTION');
  });

  it('mostra Economia, Pontualidade e Grupo de colegas', () => {
    render(<LandingBenefits />);

    expect(screen.getByRole('heading', { name: /vantagens/i })).toBeInTheDocument();
    expect(screen.getByText(/economia/i)).toBeInTheDocument();
    expect(screen.getByText(/pontualidade/i)).toBeInTheDocument();
    expect(screen.getByText(/grupo de colegas/i)).toBeInTheDocument();
  });

  it('não expõe jargon interno', () => {
    const { container } = render(<LandingBenefits />);
    const text = container.textContent;
    expect(text).not.toMatch(/N_candidato|N_proposto|N_actual|POR_PASSAGEIRO|TOTAL_ACORDO/);
  });
});
