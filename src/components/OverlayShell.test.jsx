import React, { useState } from 'react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
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

/**
 * @param {HTMLElement} target
 * @param {string} type
 * @param {{ x: number, y: number, id?: number, time?: number }} point
 */
function dispatchPointer(target, type, { x, y, id = 1, time = 0 }) {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    pointerId: id,
    button: 0,
  });
  Object.defineProperty(event, 'timeStamp', { value: time });
  target.dispatchEvent(event);
}

function mockSheetMotion() {
  const hadAnimate = Object.prototype.hasOwnProperty.call(HTMLElement.prototype, 'animate');
  const previous = HTMLElement.prototype.animate;

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

  return () => {
    if (hadAnimate) HTMLElement.prototype.animate = previous;
    else delete HTMLElement.prototype.animate;
  };
}

async function flushMotion() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('OverlayShell drag-to-dismiss', () => {
  afterEach(() => {
    cleanup();
    resetOverlayStackForTests();
    vi.restoreAllMocks();
  });

  /**
   * @param {import('react').ReactNode} children
   * @param {{ onDismiss?: () => void, dismissDisabled?: boolean, variant?: 'bottom' | 'center' }} [props]
   */
  function renderSheet(children, props = {}) {
    const onDismiss = props.onDismiss ?? vi.fn();
    render(
      <OverlayShell
        variant={props.variant ?? 'bottom'}
        onDismiss={onDismiss}
        dismissDisabled={props.dismissDisabled}
        testId="sheet-shell"
        panelTestId="sheet-panel"
      >
        {children}
      </OverlayShell>,
    );
    const panel = screen.getByTestId('sheet-panel');
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 200,
      top: 200,
      left: 0,
      right: 360,
      bottom: 600,
      width: 360,
      height: 400,
      toJSON() {},
    });
    const backdrop = screen.getByTestId('sheet-shell').querySelector('[aria-hidden="true"]');
    return { onDismiss, panel, backdrop };
  }

  it('acompanha o dedo e volta ao lugar se o arrasto for curto', async () => {
    const restoreMotion = mockSheetMotion();
    const { onDismiss, panel, backdrop } = renderSheet(<p>Conteúdo</p>);

    dispatchPointer(panel, 'pointerdown', { x: 20, y: 100, time: 10 });
    dispatchPointer(window, 'pointermove', { x: 20, y: 116, time: 400 });

    expect(onDismiss).not.toHaveBeenCalled();
    expect(panel.style.transform).toBe('translate3d(0, 16px, 0)');
    expect(Number(backdrop?.style.opacity)).toBeCloseTo(0.96);

    dispatchPointer(window, 'pointerup', { x: 20, y: 116, time: 800 });
    await flushMotion();

    expect(onDismiss).not.toHaveBeenCalled();
    expect(panel.style.transform).toBe('');
    expect(backdrop?.style.opacity).toBe('');
    restoreMotion();
  });

  it('fecha quando o arrasto passa o limiar da altura', async () => {
    const restoreMotion = mockSheetMotion();
    const { onDismiss, panel } = renderSheet(<p>Conteúdo</p>);

    dispatchPointer(panel, 'pointerdown', { x: 20, y: 100, time: 10 });
    dispatchPointer(window, 'pointermove', { x: 20, y: 320, time: 80 });
    expect(panel.style.transform).toBe('translate3d(0, 220px, 0)');
    expect(onDismiss).not.toHaveBeenCalled();

    dispatchPointer(window, 'pointerup', { x: 20, y: 320, time: 100 });
    await flushMotion();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    restoreMotion();
  });

  it('fecha num flick rápido para baixo', async () => {
    const restoreMotion = mockSheetMotion();
    const { onDismiss, panel } = renderSheet(<p>Conteúdo</p>);

    dispatchPointer(panel, 'pointerdown', { x: 10, y: 100, time: 1000 });
    dispatchPointer(window, 'pointermove', { x: 12, y: 136, time: 1020 });
    dispatchPointer(window, 'pointerup', { x: 12, y: 136, time: 1024 });
    await flushMotion();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    restoreMotion();
  });

  it('não desloca o painel ao arrastar para cima', () => {
    const { onDismiss, panel } = renderSheet(<p>Conteúdo</p>);

    dispatchPointer(panel, 'pointerdown', { x: 20, y: 180, time: 10 });
    dispatchPointer(window, 'pointermove', { x: 20, y: 80, time: 40 });
    dispatchPointer(window, 'pointerup', { x: 20, y: 80, time: 50 });

    expect(panel.style.transform).toBe('');
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('não fecha com swipe horizontal', () => {
    const { onDismiss, panel } = renderSheet(<p>Conteúdo</p>);

    dispatchPointer(panel, 'pointerdown', { x: 20, y: 180, time: 10 });
    dispatchPointer(window, 'pointermove', { x: 120, y: 188, time: 40 });
    dispatchPointer(window, 'pointerup', { x: 140, y: 190, time: 60 });

    expect(panel.style.transform).toBe('');
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('preserva o scroll quando o conteúdo não está no topo', () => {
    const { onDismiss, panel } = renderSheet(
      <div data-testid="scroller" className="overflow-y-auto">
        <p>Linha</p>
      </div>,
    );
    const scroller = screen.getByTestId('scroller');
    Object.defineProperty(scroller, 'scrollTop', { configurable: true, value: 48 });

    dispatchPointer(screen.getByText('Linha'), 'pointerdown', { x: 20, y: 100, time: 10 });
    dispatchPointer(window, 'pointermove', { x: 20, y: 280, time: 50 });
    dispatchPointer(window, 'pointerup', { x: 20, y: 280, time: 70 });

    expect(panel.style.transform).toBe('');
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('deixa o input e o botão Fechar utilizáveis', () => {
    const onDismiss = vi.fn();
    const { panel } = renderSheet(
      <>
        <input aria-label="Motivo" />
        <button type="button" onClick={onDismiss}>Fechar</button>
      </>,
      { onDismiss },
    );

    const input = screen.getByLabelText('Motivo');
    dispatchPointer(input, 'pointerdown', { x: 20, y: 100, time: 10 });
    dispatchPointer(window, 'pointermove', { x: 20, y: 320, time: 40 });
    dispatchPointer(window, 'pointerup', { x: 20, y: 320, time: 60 });
    fireEvent.change(input, { target: { value: 'atraso' } });

    expect(panel.style.transform).toBe('');
    expect(input).toHaveValue('atraso');

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('não arrasta quando o fecho está desactivado', () => {
    const { onDismiss, panel } = renderSheet(<p>Conteúdo</p>, { dismissDisabled: true });

    dispatchPointer(panel, 'pointerdown', { x: 20, y: 100, time: 10 });
    dispatchPointer(window, 'pointermove', { x: 20, y: 320, time: 40 });
    dispatchPointer(window, 'pointerup', { x: 20, y: 320, time: 60 });

    expect(panel.style.transform).toBe('');
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('variant center ignora o gesto', () => {
    const onDismiss = vi.fn();
    render(
      <OverlayShell variant="center" onDismiss={onDismiss} testId="center-shell">
        <p>Diálogo</p>
      </OverlayShell>,
    );

    dispatchPointer(screen.getByText('Diálogo'), 'pointerdown', { x: 20, y: 100, time: 10 });
    dispatchPointer(window, 'pointermove', { x: 20, y: 320, time: 40 });
    dispatchPointer(window, 'pointerup', { x: 20, y: 320, time: 60 });

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('reabre na posição inicial depois de fechar', async () => {
    const restoreMotion = mockSheetMotion();

    function Harness() {
      const [open, setOpen] = useState(true);
      if (!open) {
        return <button type="button" onClick={() => setOpen(true)}>Abrir</button>;
      }
      return (
        <OverlayShell variant="bottom" onDismiss={() => setOpen(false)} panelTestId="sheet-panel">
          <p>Conteúdo</p>
        </OverlayShell>
      );
    }

    render(<Harness />);
    const panel = screen.getByTestId('sheet-panel');
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 360, bottom: 400, width: 360, height: 400, toJSON() {},
    });

    dispatchPointer(panel, 'pointerdown', { x: 10, y: 50, time: 10 });
    dispatchPointer(window, 'pointermove', { x: 10, y: 260, time: 40 });
    dispatchPointer(window, 'pointerup', { x: 10, y: 260, time: 60 });
    await flushMotion();

    expect(screen.queryByTestId('sheet-panel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(screen.getByTestId('sheet-panel').style.transform).toBe('');
    restoreMotion();
  });
});
