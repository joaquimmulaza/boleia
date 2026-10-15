import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import NotificationListSkeleton from './NotificationListSkeleton';

describe('NotificationListSkeleton', () => {
  it('renderiza 3 linhas no layout da lista', () => {
    render(<NotificationListSkeleton rows={3} />);
    expect(screen.getByTestId('notification-list-skeleton')).toBeInTheDocument();
    expect(screen.getAllByTestId('notification-list-skeleton-row')).toHaveLength(3);
  });
});
