import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DevNotifCards269Capture from './DevNotifCards269Capture';

describe('DevNotifCards269Capture', () => {
  it('mostra as quatro mensagens dos cards v1.11 e v1.10', () => {
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
  });
});
