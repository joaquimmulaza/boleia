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
    expect(
      screen.getByText(/Sem ligação à Internet/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/cache/i);
  });
});
