import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import NotificationBell from './NotificationBell';

vi.mock('../hooks/useNotifications', () => ({
  useNotifications: () => ({
    notifications: [
      {
        id: 'n1',
        mensagem: 'Nova proposta recebida',
        tipo: 'info',
        lida: false,
        created_at: new Date().toISOString(),
      },
    ],
    unreadCount: 1,
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    deleteNotification: vi.fn(),
  }),
}));

vi.mock('../hooks/usePushNotifications', () => ({
  usePushNotifications: () => ({
    isSupported: false,
    permission: 'default',
    isSubscribed: false,
    loading: false,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  }),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
  }),
}));

const renderBell = () =>
  render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>,
  );

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza sem lançar ReferenceError ao abrir o painel', () => {
    expect(() => {
      renderBell();
      fireEvent.click(screen.getByRole('button', { name: 'Notificações' }));
    }).not.toThrow();

    expect(screen.getByRole('heading', { name: 'Notificações' })).toBeInTheDocument();
  });

  it('mantém o painel aberto ao clicar dentro do drawer', () => {
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }));

    fireEvent.mouseDown(screen.getByText('Nova proposta recebida'));

    expect(screen.getByRole('heading', { name: 'Notificações' })).toBeInTheDocument();
  });

  it('fecha o painel ao clicar no backdrop', () => {
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }));

    const panel = screen.getByTestId('notification-panel');
    expect(panel).toHaveClass('translate-x-0');

    fireEvent.click(screen.getByTestId('notification-backdrop'));

    expect(panel).toHaveClass('translate-x-full');
  });
});
