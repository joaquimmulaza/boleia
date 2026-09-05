import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LandingSecurity from './LandingSecurity';

describe('LandingSecurity', () => {
  it('renderiza secção com id seguranca', () => {
    const { container } = render(<LandingSecurity />);
    const section = container.querySelector('#seguranca');
    expect(section).toBeInTheDocument();
    expect(section.tagName).toBe('SECTION');
  });

  it('fala de perfis, acordos claros e faltas rastreáveis', () => {
    render(<LandingSecurity />);

    expect(screen.getByRole('heading', { name: /segurança/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^perfis$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^acordos claros$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^faltas rastreáveis$/i })).toBeInTheDocument();
  });

  it('não expõe jargon interno', () => {
    const { container } = render(<LandingSecurity />);
    const text = container.textContent;
    expect(text).not.toMatch(/N_candidato|N_proposto|N_actual|POR_PASSAGEIRO|TOTAL_ACORDO/);
  });
});
