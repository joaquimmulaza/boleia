import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import OverlayShell from '../components/OverlayShell';
import { useKebabMenu } from './useKebabMenu';
import { resetOverlayStackForTests } from '../utils/overlayStack';

function TestKebab({ onSheetDismiss = vi.fn() }) {
  const { open, toggle, rootRef, triggerRef, triggerAria, menuProps } = useKebabMenu();

  return (
    <OverlayShell variant="bottom" onDismiss={onSheetDismiss} testId="parent-sheet">
      <div ref={rootRef}>
        <button
          type="button"
          ref={triggerRef}
          {...triggerAria}
          onClick={toggle}
          aria-label="Mais acções"
        >
          Abrir
        </button>
        {open ? (
          <div {...menuProps} data-testid="kebab-menu">
            <button type="button" role="menuitem">
              Acção
            </button>
          </div>
        ) : null}
      </div>
    </OverlayShell>
  );
}

describe('useKebabMenu', () => {
  afterEach(() => {
    cleanup();
    resetOverlayStackForTests();
  });

  it('fecha com segundo toque no botão', () => {
    render(<TestKebab />);
    const trigger = screen.getByRole('button', { name: /Mais acções/i });

    fireEvent.click(trigger);
    expect(screen.getByTestId('kebab-menu')).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(trigger);
    expect(screen.queryByTestId('kebab-menu')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('fecha com toque fora e devolve foco ao botão', () => {
    render(
      <div>
        <button type="button">Fora</button>
        <TestKebab />
      </div>,
    );
    const trigger = screen.getByRole('button', { name: /Mais acções/i });
    fireEvent.click(trigger);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Fora' }));
    expect(screen.queryByTestId('kebab-menu')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it('Enter e Espaço no menuitem activam o clique', () => {
    const onAction = vi.fn();

    function TestKebabAction() {
      const { open, toggle, rootRef, triggerRef, triggerAria, menuProps } = useKebabMenu();
      return (
        <div ref={rootRef}>
          <button type="button" ref={triggerRef} {...triggerAria} onClick={toggle}>
            Abrir
          </button>
          {open ? (
            <div {...menuProps}>
              <button type="button" role="menuitem" onClick={onAction}>
                Acção
              </button>
            </div>
          ) : null}
        </div>
      );
    }

    render(<TestKebabAction />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    const item = screen.getByRole('menuitem', { name: 'Acção' });
    item.focus();
    fireEvent.keyDown(item, { key: 'Enter' });
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('Escape fecha só o menu e não a sheet por baixo', () => {
    const onSheetDismiss = vi.fn();
    render(<TestKebab onSheetDismiss={onSheetDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: /Mais acções/i }));
    expect(screen.getByTestId('kebab-menu')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('kebab-menu')).not.toBeInTheDocument();
    expect(onSheetDismiss).not.toHaveBeenCalled();
    expect(screen.getByTestId('parent-sheet')).toBeInTheDocument();
  });
});
