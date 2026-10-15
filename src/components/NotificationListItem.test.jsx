import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import NotificationListItem from './NotificationListItem';

describe('NotificationListItem — título + corpo', () => {
  it('mostra título em cima e mensagem abaixo quando há título de catálogo', () => {
    render(
      <NotificationListItem
        notif={{
          mensagem: 'Ana enviou uma proposta para a tua oferta.',
          tipo: 'info',
          lida: false,
          metadata: { type: 'proposal_received', nome: 'Ana' },
        }}
      />,
    );
    expect(screen.getByText('Nova proposta de Ana')).toBeInTheDocument();
    expect(screen.getByText('Ana enviou uma proposta para a tua oferta.')).toBeInTheDocument();
  });

  it('notificação antiga sem título: só mensagem (sem linha vazia)', () => {
    render(
      <NotificationListItem
        notif={{
          mensagem: 'Recebeste uma proposta de boleia. Revisa e aceita ou recusa.',
          tipo: 'info',
          lida: true,
        }}
      />,
    );
    expect(
      screen.getByText('Recebeste uma proposta de boleia. Revisa e aceita ou recusa.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Boleia Certa')).not.toBeInTheDocument();
  });
});
