import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DevAppRoutes from './DevAppRoutes.jsx';

describe('DevAppRoutes — hostname prod redirecciona', () => {
  it('não monta captura em boleia-cyan.vercel.app', () => {
    const hostnameSpy = vi.spyOn(window.location, 'hostname', 'get').mockReturnValue('boleia-cyan.vercel.app');
    render(
      <MemoryRouter initialEntries={['/notif-cards-269']}>
        <DevAppRoutes />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('dev-notif-cards-269-capture')).not.toBeInTheDocument();
    hostnameSpy.mockRestore();
  });
});
