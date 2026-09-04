import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import LoadingSkeleton from './LoadingSkeleton';

describe('LoadingSkeleton', () => {
  it('renderiza variante card por omissão', () => {
    const { container } = render(<LoadingSkeleton />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renderiza variante list com múltiplos itens', () => {
    const { container } = render(<LoadingSkeleton variant="list" count={3} />);
    expect(container.querySelectorAll('[data-testid="skeleton-item"]').length).toBe(3);
  });

  it('renderiza variante profile', () => {
    const { container } = render(<LoadingSkeleton variant="profile" />);
    expect(container.querySelector('[data-testid="skeleton-profile"]')).toBeInTheDocument();
  });
});
