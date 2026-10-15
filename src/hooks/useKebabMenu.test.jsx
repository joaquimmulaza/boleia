import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('Enter e Espaço no menuitem activam o clique uma única vez cada', async () => {
    const user = userEvent.setup();
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
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    const item = screen.getByRole('menuitem', { name: 'Acção' });
    item.focus();
    await user.keyboard('{Enter}');
    expect(onAction).toHaveBeenCalledTimes(1);

    item.focus();
    await user.keyboard(' ');
    expect(onAction).toHaveBeenCalledTimes(2);
  });

  it('Tab fecha o menu e move o foco para o elemento seguinte', async () => {
    function PlainKebab() {
      const { open, toggle, rootRef, triggerRef, triggerAria, menuProps } = useKebabMenu();
      return (
        <div ref={rootRef}>
          <button type="button" ref={triggerRef} {...triggerAria} onClick={toggle}>
            Mais acções
          </button>
          {open ? (
            <div {...menuProps} data-testid="kebab-menu">
              <button type="button" role="menuitem">
                Acção
              </button>
            </div>
          ) : null}
        </div>
      );
    }

    render(
      <div>
        <button type="button" data-testid="antes">
          Antes
        </button>
        <PlainKebab />
        <button type="button" data-testid="depois">
          Depois
        </button>
      </div>,
    );

    const trigger = screen.getByRole('button', { name: /Mais acções/i });
    fireEvent.click(trigger);
    const item = screen.getByRole('menuitem', { name: 'Acção' });
    await waitFor(() => {
      expect(document.activeElement).toBe(item);
    });

    fireEvent.keyDown(document, { key: 'Tab', code: 'Tab', keyCode: 9 });
    expect(screen.queryByTestId('kebab-menu')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByTestId('depois'));
  });

  it('Shift+Tab fecha o menu e move o foco para o elemento anterior', () => {
    render(
      <div>
        <button type="button" data-testid="antes">
          Antes
        </button>
        <TestKebab />
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Mais acções/i }));
    fireEvent.keyDown(document, { key: 'Tab', code: 'Tab', keyCode: 9, shiftKey: true });
    expect(screen.queryByTestId('kebab-menu')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByTestId('antes'));
  });

  it('ArrowDown e ArrowUp movem entre menuitems', async () => {
    function TwoItemsKebab() {
      const { open, toggle, rootRef, triggerRef, triggerAria, menuProps } = useKebabMenu();
      return (
        <div ref={rootRef}>
          <button type="button" ref={triggerRef} {...triggerAria} onClick={toggle}>
            Abrir
          </button>
          {open ? (
            <div {...menuProps}>
              <button type="button" role="menuitem">
                Primeira
              </button>
              <button type="button" role="menuitem">
                Segunda
              </button>
            </div>
          ) : null}
        </div>
      );
    }

    render(<TwoItemsKebab />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    const first = screen.getByRole('menuitem', { name: 'Primeira' });
    const second = screen.getByRole('menuitem', { name: 'Segunda' });
    await waitFor(() => {
      expect(document.activeElement).toBe(first);
    });

    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(first);
  });

  it('Escape devolve foco ao trigger', () => {
    render(<TestKebab />);
    const trigger = screen.getByRole('button', { name: /Mais acções/i });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('kebab-menu')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
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
