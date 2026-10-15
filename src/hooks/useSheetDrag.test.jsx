import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import OverlayShell from '../components/OverlayShell';
import SheetFecharButton from '../components/SheetFecharButton';

describe('useSheetDrag + SheetFecharButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('não bloqueia clique em Fechar após gesto de arrastar no handle', () => {
    const onDismiss = vi.fn();
    render(
      <OverlayShell variant="bottom" testId="sheet-test" onDismiss={onDismiss}>
        <div data-testid="sheet-drag-handle" className="h-8 bg-slate-200" />
        <SheetFecharButton data-testid="fechar" onClick={onDismiss} />
      </OverlayShell>,
    );

    const handle = screen.getByTestId('sheet-drag-handle');
    const fechar = screen.getByTestId('fechar');

    fireEvent.pointerDown(handle, { clientX: 100, clientY: 200, button: 0, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 100, clientY: 280, button: 0, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 100, clientY: 280, button: 0, pointerId: 1 });

    fireEvent.pointerDown(fechar);
    fireEvent.click(fechar);

    expect(onDismiss).toHaveBeenCalled();
  });

  it('não inicia drag quando o gesto começa na lista flutuante do geocoder', () => {
    const onDismiss = vi.fn();
    render(
      <OverlayShell
        variant="bottom"
        testId="sheet-test"
        dialogLabelledBy="sheet-title"
        onDismiss={onDismiss}
      >
        <h2 id="sheet-title">Sheet</h2>
      </OverlayShell>,
    );

    const portal = screen.getByTestId('geocoder-sheet-portal');
    const list = document.createElement('div');
    list.setAttribute('data-geocoder-floating-list', '');
    list.setAttribute('role', 'listbox');
    list.textContent = 'Sugestões';
    portal.appendChild(list);

    const panel = document.querySelector('[data-geocoder-sheet-boundary]');
    expect(panel).toBeTruthy();

    fireEvent.pointerDown(list, { clientX: 120, clientY: 420, button: 0, pointerId: 9 });
    fireEvent.pointerMove(window, { clientX: 120, clientY: 720, button: 0, pointerId: 9 });
    fireEvent.pointerUp(window, { clientX: 120, clientY: 720, button: 0, pointerId: 9 });

    expect(onDismiss).not.toHaveBeenCalled();
    expect(panel.style.transform).toBe('');
  });
});
