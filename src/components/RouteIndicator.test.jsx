import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RouteIndicator from './RouteIndicator';

describe('RouteIndicator', () => {
  it('marca origem, linha e destino sem ícone e sem imagem', () => {
    const { container } = render(<RouteIndicator />);
    const root = screen.getByTestId('route-indicator');
    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('route-origin-dot')).toBeInTheDocument();
    expect(screen.getByTestId('route-line')).toBeInTheDocument();
    expect(screen.getByTestId('route-destination-dot')).toBeInTheDocument();
    expect(container.querySelector('img, svg')).toBeNull();
  });
});
