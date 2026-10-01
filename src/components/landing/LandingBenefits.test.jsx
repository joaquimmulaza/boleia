import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import LandingBenefits from './LandingBenefits';

describe('LandingBenefits («O que muda»)', () => {
  it('renderiza secção com id o-que-muda (sem vantagens nem seguranca)', () => {
    const { container } = render(<LandingBenefits />);
    const section = container.querySelector('#o-que-muda');
    expect(section).toBeInTheDocument();
    expect(section.tagName).toBe('SECTION');
    expect(container.querySelector('#vantagens')).not.toBeInTheDocument();
    expect(container.querySelector('#seguranca')).not.toBeInTheDocument();
  });

  it('tem duas colunas, Passageiro e Motorista, com três pontos cada', () => {
    render(<LandingBenefits />);

    expect(screen.getByRole('heading', { name: /^o que muda$/i })).toBeInTheDocument();

    const passageiro = screen.getByTestId('o-que-muda-passageiro');
    const motorista = screen.getByTestId('o-que-muda-motorista');

    expect(within(passageiro).getByRole('heading', { name: /^passageiro$/i })).toBeInTheDocument();
    expect(within(motorista).getByRole('heading', { name: /^motorista$/i })).toBeInTheDocument();
    expect(within(passageiro).getAllByRole('heading', { level: 4 })).toHaveLength(3);
    expect(within(motorista).getAllByRole('heading', { level: 4 })).toHaveLength(3);
  });

  it('coluna Passageiro parte da dor da paragem/táxi e promete preço do mês e mesmo carro', () => {
    render(<LandingBenefits />);
    const text = screen.getByTestId('o-que-muda-passageiro').textContent ?? '';

    expect(text).toMatch(/paragem|táxi/i);
    expect(text).toMatch(/mala/i);
    expect(text).toMatch(/Kz/);
    expect(text).toMatch(/mesmo carro/i);
  });

  it('coluna Motorista fala ao de rota própria e ao de aplicativo/táxi com renda extra', () => {
    render(<LandingBenefits />);
    const text = screen.getByTestId('o-que-muda-motorista').textContent ?? '';

    expect(text).toMatch(/lugares vazios/i);
    expect(text).toMatch(/Yango|aplicativo|táxi/i);
    expect(text).toMatch(/renda extra|rendimento/i);
    expect(text).toMatch(/sem rota marcada/i);
    expect(text).toMatch(/Kz/);
  });

  it('cada ponto tem no máximo 18 palavras', () => {
    render(<LandingBenefits />);
    const points = screen.getAllByTestId('o-que-muda-ponto');
    expect(points).toHaveLength(6);
    points.forEach((point) => {
      const words = (point.textContent ?? '').trim().split(/\s+/).filter(Boolean);
      expect(words.length).toBeLessThanOrEqual(18);
    });
  });

  it('não expõe jargon interno nem claims proibidos', () => {
    const { container } = render(<LandingBenefits />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/N_candidato|N_proposto|N_actual|POR_PASSAGEIRO|TOTAL_ACORDO/);
    expect(text).not.toMatch(/1:N|1:n|matchmaking|marketplace|matching|custódia/i);
    expect(text).not.toMatch(/seguro|segurança|verificad|garantid|multicaixa|proxypay/i);
  });
});
