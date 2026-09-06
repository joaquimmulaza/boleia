import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import OfflineBanner from './OfflineBanner';

describe('OfflineBanner', () => {
  it('não renderiza quando online', () => {
    const { container } = render(<OfflineBanner isOffline={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('mostra aviso Luanda quando offline', () => {
    render(<OfflineBanner isOffline />);
    const banner = screen.getByTestId('offline-banner');
    expect(banner).toHaveAttribute('data-variant', 'offline');
    expect(banner).toHaveTextContent(/Sem ligação à Internet/i);
    expect(screen.getByRole('status')).toHaveTextContent(/cache/i);
    expect(banner.querySelector('svg')).toBeTruthy();
  });
});
