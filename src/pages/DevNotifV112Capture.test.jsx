import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DevNotifV112Capture from './DevNotifV112Capture';

describe('DevNotifV112Capture', () => {
  it('mostra cards v1.12 em light e dark', () => {
    render(<DevNotifV112Capture />);
    expect(screen.getByTestId('dev-notif-v112-light')).toBeInTheDocument();
    expect(screen.getByTestId('dev-notif-v112-dark')).toBeInTheDocument();
    expect(screen.getAllByText('Ficou um lugar livre').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('A reserva de Maria Silva expirou. O acordo continua.').length).toBe(2);
    expect(screen.getAllByText('A reserva de um passageiro expirou. O acordo continua.').length).toBe(2);
    expect(screen.getAllByText('O motorista retirou-te do acordo, que foi encerrado.').length).toBe(2);
    expect(
      screen.getAllByText(
        'O motorista retirou-te do acordo Talatona → Belas Shopping, que foi encerrado.',
      ).length,
    ).toBe(2);
  });
});
