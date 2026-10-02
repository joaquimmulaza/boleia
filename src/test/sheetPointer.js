import { act } from '@testing-library/react';

/**
 * @param {HTMLElement} target
 * @param {string} type
 * @param {{ x: number, y: number, id?: number, time?: number }} point
 */
export function dispatchPointer(target, type, { x, y, id = 1, time = 0 }) {
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

/** Termina `element.animate` no microtask seguinte, como nos testes do OverlayShell. */
export function mockSheetMotion() {
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

export async function flushMotion() {
  await act(async () => {
    await Promise.resolve();
  });
}

/**
 * Flick para baixo no alvo (título ou pega), suficiente para fechar.
 * @param {HTMLElement} target
 */
export function flickSheetDown(target) {
  dispatchPointer(target, 'pointerdown', { x: 10, y: 100, time: 1000 });
  dispatchPointer(window, 'pointermove', { x: 12, y: 136, time: 1020 });
  dispatchPointer(window, 'pointerup', { x: 12, y: 136, time: 1024 });
}
