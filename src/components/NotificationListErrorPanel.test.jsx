import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import NotificationListErrorPanel, {
  NOTIFICATION_LIST_ERROR_BANNER_ALERT_CLASS,
  NOTIFICATION_LIST_ERROR_BANNER_SHELL_CLASS,
} from './NotificationListErrorPanel';

describe('NotificationListErrorPanel', () => {
  it('faixa banner — shell px-5 e Alert w-full/min-w-0 sem margem horizontal no Alert', () => {
    render(
      <NotificationListErrorPanel layout="banner" retrying={false} onRetry={() => {}} />,
    );

    const shell = screen.getByTestId('notification-list-error-banner-shell');
    expect(shell.className).toContain('px-5');
    expect(shell.className).toContain('min-w-0');
    expect(shell.className).toContain('w-full');
    expect(shell.className).not.toMatch(/\b-m[xylr]-/);
    expect(shell.className).not.toMatch(/\bw-\[/);

    const alert = screen.getByTestId('notification-list-error-banner');
    expect(alert.className).toContain('w-full');
    expect(alert.className).toContain('min-w-0');
    expect(alert.className).toContain('max-w-full');
    expect(alert.className).not.toMatch(/\bmx-/);
    expect(alert.className).not.toMatch(/\bw-\[/);

    expect(NOTIFICATION_LIST_ERROR_BANNER_SHELL_CLASS).not.toMatch(/\bmx-/);
    expect(NOTIFICATION_LIST_ERROR_BANNER_ALERT_CLASS).not.toMatch(/\bmx-/);
    expect(NOTIFICATION_LIST_ERROR_BANNER_ALERT_CLASS).not.toMatch(/\bw-\[/);
  });
});
