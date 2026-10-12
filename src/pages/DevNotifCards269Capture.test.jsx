import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DevNotifCards269Capture from './DevNotifCards269Capture';

describe('DevNotifCards269Capture', () => {
  it('mostra v1.11, v1.10 e #252 (último passageiro removido)', () => {
    render(<DevNotifCards269Capture />);
    expect(
      screen.getByText(/A reserva de Maria Silva expirou e o acordo foi encerrado/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A reserva do último passageiro expirou e o acordo foi encerrado/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/O motorista retirou-te do acordo Talatona → Belas Shopping/),
    ).toBeInTheDocument();
    expect(
      screen.getByText('O motorista retirou-te do acordo. O teu lugar foi libertado.'),
    ).toBeInTheDocument();
    expect(screen.getByText('O teu acordo de boleia foi cancelado.')).toBeInTheDocument();
  });
});
