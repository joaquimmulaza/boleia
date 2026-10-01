import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LandingFaq from './LandingFaq';

describe('LandingFaq', () => {
  it('renderiza secção com id perguntas', () => {
    const { container } = render(<LandingFaq />);
    const section = container.querySelector('#perguntas');
    expect(section).toBeInTheDocument();
    expect(section.tagName).toBe('SECTION');
  });

  it('tem exactamente três perguntas: grupo incompleto, saída e pagamento', () => {
    const { container } = render(<LandingFaq />);

    expect(screen.getByRole('heading', { name: /^perguntas$/i })).toBeInTheDocument();
    expect(container.querySelectorAll('dt')).toHaveLength(3);

    const text = container.textContent ?? '';
    expect(text).toMatch(/não é preciso lotar o carro/i);
    expect(text).toMatch(/valor mensal dos outros mantém-se/i);
    expect(text).toMatch(/mês seguinte/i);
    expect(text).toMatch(/lugar fica reservado/i);
    expect(text).toMatch(/comprovativo/i);
  });

  it('cada resposta tem no máximo 35 palavras', () => {
    const { container } = render(<LandingFaq />);
    const answers = Array.from(container.querySelectorAll('dd'));
    expect(answers).toHaveLength(3);
    answers.forEach((answer) => {
      const words = (answer.textContent ?? '').trim().split(/\s+/).filter(Boolean);
      expect(words.length).toBeLessThanOrEqual(35);
    });
  });

  it('não expõe jargon nem claims proibidos', () => {
    const { container } = render(<LandingFaq />);
    const text = container.textContent ?? '';

    expect(text).not.toMatch(/centenas de pessoas/i);
    expect(text).not.toMatch(/seguro|segurança|verificad|garantid|multicaixa|proxypay/i);
    expect(text).not.toMatch(/N_candidato|N_proposto|N_actual|POR_PASSAGEIRO|TOTAL_ACORDO/);
    expect(text).not.toMatch(/1:N|1:n|matchmaking|marketplace|matching|custódia/i);
  });
});
