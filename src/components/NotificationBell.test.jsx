import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import NotificationBell from './NotificationBell';

const deleteNotification = vi.fn();
const markAllAsRead = vi.fn();

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
      {
        id: 'n2',
        mensagem: 'Proposta aceite',
        tipo: 'success',
        lida: true,
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
    unreadCount: 1,
    markAsRead: vi.fn(),
    markAllAsRead,
    deleteNotification,
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

  it('renderiza bottom sheet F7 com handle e Fechar (não side drawer)', () => {
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }));

    const panel = screen.getByTestId('notification-panel');
    expect(screen.getByTestId('sheet-drag-handle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Notificações' })).toBeInTheDocument();
    expect(panel.className).toMatch(/rounded-b-\[20px\]/);
    expect(panel.className).not.toMatch(/translate-x/);
    expect(screen.queryByLabelText(/Fechar notificações/i)).not.toBeInTheDocument();
  });

  it('fecha ao arrastar o handle para baixo', async () => {
    const hadAnimate = Object.prototype.hasOwnProperty.call(HTMLElement.prototype, 'animate');
    const previousAnimate = HTMLElement.prototype.animate;
    HTMLElement.prototype.animate = function animate() {
      const anim = {
        onfinish: /** @type {null | (() => void)} */ (null),
        oncancel: /** @type {null | (() => void)} */ (null),
        playState: 'running',
        cancel() {
          this.playState = 'idle';
          this.oncancel?.();
        },
      };
      queueMicrotask(() => {
        if (anim.playState === 'idle') return;
        anim.playState = 'finished';
        anim.onfinish?.();
      });
      return /** @type {Animation} */ (/** @type {unknown} */ (anim));
    };

    renderBell();
    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }));

    const handle = screen.getByTestId('sheet-drag-handle');
    const panel = screen.getByTestId('notification-panel');
    fireEvent.pointerDown(handle, { clientX: 40, clientY: 100, pointerId: 1, button: 0 });
    fireEvent.pointerMove(handle, { clientX: 40, clientY: 280, pointerId: 1 });

    expect(panel).toBeInTheDocument();
    expect(panel.style.transform).toContain('180px');

    fireEvent.pointerUp(handle, { clientX: 40, clientY: 280, pointerId: 1 });
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByTestId('notification-panel')).not.toBeInTheDocument();
    if (hadAnimate) HTMLElement.prototype.animate = previousAnimate;
    else delete HTMLElement.prototype.animate;
  });

  it('mostra Marcar todas lidas quando há não lidas', () => {
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }));

    expect(screen.getByRole('button', { name: 'Marcar todas lidas' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Apagar todas/i })).not.toBeInTheDocument();
  });

  it('Apagar via kebab apaga imediatamente sem confirmar', () => {
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }));

    const kebabButtons = screen.getAllByRole('button', { name: 'Mais acções da notificação' });
    fireEvent.click(kebabButtons[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: /Apagar/i }));

    expect(deleteNotification).toHaveBeenCalledWith('n1');
    expect(screen.queryByText(/tem a certeza/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirmar/i })).not.toBeInTheDocument();
  });

  it('fecha ao clicar no backdrop', () => {
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }));

    expect(screen.getByTestId('notification-panel')).toBeInTheDocument();

    const shell = screen.getByTestId('notification-backdrop');
    const backdrop = shell.querySelector('[aria-hidden="true"]');
    fireEvent.click(backdrop);

    expect(screen.queryByTestId('notification-panel')).not.toBeInTheDocument();
  });

  it('fecha com tecla Escape', () => {
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }));

    expect(screen.getByTestId('notification-panel')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByTestId('notification-panel')).not.toBeInTheDocument();
  });

  it('mantém o painel aberto ao clicar dentro da lista', () => {
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }));

    fireEvent.mouseDown(screen.getByText('Nova proposta recebida'));

    expect(screen.getByRole('heading', { name: 'Notificações' })).toBeInTheDocument();
  });
});
