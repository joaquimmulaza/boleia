import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LandingMotoristaStrip from './LandingMotoristaStrip';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('LandingMotoristaStrip', () => {
  afterEach(() => {
    cleanup();
  });

  it('Sou Motorista usa texto escuro sobre verde primário', () => {
    render(
      <BrowserRouter>
        <LandingMotoristaStrip />
      </BrowserRouter>,
    );

    const cta = screen.getByRole('button', { name: 'Sou Motorista' });
    expect(cta.className).toMatch(/text-primary-foreground/);
    expect(cta.className).not.toMatch(/text-white/);
  });
});
