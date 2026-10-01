import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import OverlayShell from './OverlayShell';
import { resetOverlayStackForTests } from '../utils/overlayStack';

describe('OverlayShell', () => {
  afterEach(() => {
    cleanup();
    resetOverlayStackForTests();
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

  it('Escape chama onDismiss', () => {
    const onDismiss = vi.fn();
    render(
      <OverlayShell testId="esc-overlay" onDismiss={onDismiss}>
        <p>Conteúdo</p>
      </OverlayShell>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('Escape só fecha overlay do topo quando empilhados', () => {
    const bottomDismiss = vi.fn();
    const topDismiss = vi.fn();

    render(
      <>
        <OverlayShell testId="bottom-overlay" onDismiss={bottomDismiss}>
          <p>Bottom</p>
        </OverlayShell>
        <OverlayShell testId="top-overlay" onDismiss={topDismiss}>
          <p>Top</p>
        </OverlayShell>
      </>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(topDismiss).toHaveBeenCalledTimes(1);
    expect(bottomDismiss).not.toHaveBeenCalled();
  });
});
