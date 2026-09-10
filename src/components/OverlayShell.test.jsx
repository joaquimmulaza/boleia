import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import OverlayShell from './OverlayShell';

describe('OverlayShell', () => {
  afterEach(() => {
    cleanup();
  });

  it('usa z-modal e renderiza via portal', () => {
    render(
      <OverlayShell testId="test-overlay">
        <p>CTA</p>
      </OverlayShell>,
    );

    const shell = screen.getByTestId('test-overlay');
    expect(shell.className).toMatch(/z-modal/);
    expect(document.body.contains(shell)).toBe(true);
  });

  it('variant bottom: painel tem scroll e pb-safe', () => {
    render(
      <OverlayShell variant="bottom" panelTestId="bottom-panel">
        <button type="button">Confirmar</button>
      </OverlayShell>,
    );

    const panel = screen.getByTestId('bottom-panel');
    expect(panel.className).toMatch(/overflow-y-auto/);
    expect(panel.className).toMatch(/pb-safe/);
    expect(panel.className).toMatch(/max-h-\[90dvh\]/);
  });

  it('variant center: content wrapper centrado', () => {
    render(
      <OverlayShell variant="center" testId="center-overlay">
        <div role="dialog">Diálogo</div>
      </OverlayShell>,
    );

    const shell = screen.getByTestId('center-overlay');
    expect(shell.className).toMatch(/items-center/);
  });
});
