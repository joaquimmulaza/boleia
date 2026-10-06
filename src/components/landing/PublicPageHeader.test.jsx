import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../../contexts/ThemeContext';
import PublicPageHeader from './PublicPageHeader';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('PublicPageHeader', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  function renderHeader() {
    return render(
      <ThemeProvider>
        <BrowserRouter>
          <PublicPageHeader />
        </BrowserRouter>
      </ThemeProvider>,
    );
  }

  it('Criar conta usa texto escuro sobre verde primário', () => {
    renderHeader();
    const cta = screen.getByRole('button', { name: 'Criar conta' });
    expect(cta.className).toMatch(/text-primary-foreground/);
    expect(cta.className).not.toMatch(/text-white/);
  });

  it('menu mobile Sou Passageiro usa texto escuro sobre verde primário', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
    const cta = screen.getByRole('button', { name: 'Sou Passageiro' });
    expect(cta.className).toMatch(/text-primary-foreground/);
    expect(cta.className).not.toMatch(/text-white/);
  });
});
