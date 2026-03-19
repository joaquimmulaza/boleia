import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ThemeToggle from './ThemeToggle';
import * as ThemeContextModule from '../contexts/ThemeContext';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Moon: () => <svg data-testid="moon-icon" />,
  Sun: () => <svg data-testid="sun-icon" />,
}));

describe('ThemeToggle', () => {
  it('renders moon icon when theme is light', () => {
    vi.spyOn(ThemeContextModule, 'useTheme').mockReturnValue({
      theme: 'light',
      toggleTheme: vi.fn(),
    });

    render(<ThemeToggle />);
    expect(screen.getByTestId('moon-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('sun-icon')).not.toBeInTheDocument();
  });

  it('renders sun icon when theme is dark', () => {
    vi.spyOn(ThemeContextModule, 'useTheme').mockReturnValue({
      theme: 'dark',
      toggleTheme: vi.fn(),
    });

    render(<ThemeToggle />);
    expect(screen.getByTestId('sun-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('moon-icon')).not.toBeInTheDocument();
  });

  it('calls toggleTheme when clicked', () => {
    const toggleThemeMock = vi.fn();
    vi.spyOn(ThemeContextModule, 'useTheme').mockReturnValue({
      theme: 'light',
      toggleTheme: toggleThemeMock,
    });

    render(<ThemeToggle />);

    act(() => {
      screen.getByRole('button', { name: /alternar tema/i }).click();
    });

    expect(toggleThemeMock).toHaveBeenCalledTimes(1);
  });
});
